import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userModel from "../models/user.model";
import tokenBlacklistModel from "../models/blacklist.model";

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

  const isUserAlreadyExists = await userModel.findOne({
    $or: [{ username }, { email }],
  });

  if (isUserAlreadyExists) {
    res.status(400).json({
      message: "Account already exists with this email address or username",
    });
    return;
  }

  const hash = await bcrypt.hash(password, 10);

  const user = await userModel.create({
    username,
    email,
    password: hash,
  });

  const token = createToken(user._id.toString(), user.username);

  res.cookie("token", token, cookieOptions);

  res.status(201).json({
    message: "User registered successfully",
    user: {
      id: user._id,
      username: user.username,
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

  const user = await userModel.findOne({ email });

  if (!user) {
    res.status(400).json({
      message: "Invalid email or password",
    });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    res.status(400).json({
      message: "Invalid email or password",
    });
    return;
  }

  const token = createToken(user._id.toString(), user.username);

  res.cookie("token", token, cookieOptions);

  res.status(200).json({
    message: "User loggedIn successfully.",
    user: {
      id: user._id,
      username: user.username,
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
    await tokenBlacklistModel.create({ token });
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

  const user = await userModel.findById(userId);

  if (!user) {
    res.status(404).json({
      message: "User not found",
    });
    return;
  }

  res.status(200).json({
    message: "User details fetched successfully",
    user: {
      id: user._id,
      username: user.username,
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