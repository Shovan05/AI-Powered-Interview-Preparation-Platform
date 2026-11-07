import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../repositories/user.repository";
import { blacklistToken } from "../services/tokenBlacklist.service";

interface RegisterBody {
  username?: string;
  email?: string;
  password?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
};

function createToken(id: string, username: string): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in the environment");
  }

  return jwt.sign({ id, username }, secret, { expiresIn: "1d" });
}

// PostgreSQL error code for a unique constraint violation
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "23505"
  );
}

/**
 * @name registerUserController
 * @description register a new user, expects username, email and password in the request body
 * @access Public
 */
async function registerUserController(
  req: Request,
  res: Response
): Promise<void> {
  const { username, email, password } = req.body as RegisterBody;

  if (!username || !email || !password) {
    res.status(400).json({
      message: "Please provide username, email and password",
    });
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  let user;
  try {
    user = await createUser(username, email, hash);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).json({
        message: "Account already exists with this email address",
      });
      return;
    }
    throw err;
  }

  const token = createToken(user.id, user.name);

  res.cookie("token", token, cookieOptions);

  res.status(201).json({
    message: "User registered successfully",
    user: {
      id: user.id,
      username: user.name,
      email: user.email,
    },
  });
}

/**
 * @name loginUserController
 * @description login a user, expects email and password in the request body
 * @access Public
 */
async function loginUserController(
  req: Request,
  res: Response
): Promise<void> {
  const { email, password } = req.body as LoginBody;

  if (!email || !password) {
    res.status(400).json({
      message: "Please provide email and password",
    });
    return;
  }

  const user = await findUserByEmail(email);

  if (!user) {
    res.status(400).json({
      message: "Invalid email or password",
    });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    res.status(400).json({
      message: "Invalid email or password",
    });
    return;
  }

  const token = createToken(user.id, user.name);

  res.cookie("token", token, cookieOptions);

  res.status(200).json({
    message: "User loggedIn successfully.",
    user: {
      id: user.id,
      username: user.name,
      email: user.email,
    },
  });
}

/**
 * @name logoutUserController
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
async function logoutUserController(
  req: Request,
  res: Response
): Promise<void> {
  const token = req.cookies.token;

  if (token) {
    await blacklistToken(token);
  }

  res.clearCookie("token", cookieOptions);

  res.status(200).json({
    message: "User logged out successfully",
  });
}

/**
 * @name getMeController
 * @description get the current logged in user details.
 * @access private
 */
async function getMeController(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({
      message: "Not authenticated",
    });
    return;
  }

  const user = await findUserById(userId);

  if (!user) {
    res.status(404).json({
      message: "User not found",
    });
    return;
  }

  res.status(200).json({
    message: "User details fetched successfully",
    user: {
      id: user.id,
      username: user.name,
      email: user.email,
    },
  });
}

export {
  registerUserController,
  loginUserController,
  logoutUserController,
  getMeController,
};