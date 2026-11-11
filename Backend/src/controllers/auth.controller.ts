import { Request, Response, CookieOptions } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "../repositories/user.repository";
import { blacklistToken } from "../services/tokenBlacklist.service";
import crypto from "crypto";
import { createResetToken, resetPasswordWithToken } from "../repositories/passwordReset.repository";
import { sendEmail } from "../services/email.service";

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

interface ForgotPasswordBody {
  email?: string;
}

interface ResetPasswordBody {
  token?: string;
  newPassword?: string;
}

const RESET_TOKEN_MINUTES = 15;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * @name forgotPasswordController
 * @description emails a password reset link if the account exists
 * @access Public
 */
async function forgotPasswordController(
  req: Request,
  res: Response
): Promise<void> {
  const { email } = req.body as ForgotPasswordBody;

  if (!email) {
    res.status(400).json({ message: "Please provide your email" });
    return;
  }

  const user = await findUserByEmail(email);

  if (user) {
    // The token goes in the email; only its hash is stored.
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
    await createResetToken(user.id, hashToken(token), expiresAt);

    const baseUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    const link = `${baseUrl}/reset-password?token=${token}`;

    // Not awaited: the response time is the same whether or not the account exists,
    // and a slow or failing mail server cannot make this request fail.
    sendEmail(
      user.email,
      "Reset your password",
      `<p>Hi ${user.name},</p>
       <p>Click the link below to choose a new password. It expires in ${RESET_TOKEN_MINUTES} minutes and works once.</p>
       <p><a href="${link}">Reset password</a></p>
       <p>If you did not ask for this, you can ignore this email.</p>`,
      `Hi ${user.name},\n\nChoose a new password (expires in ${RESET_TOKEN_MINUTES} minutes, works once):\n${link}\n\nIf you did not ask for this, ignore this email.`
    ).catch((err) => console.error("Failed to send reset email:", err));
  }

  // Same answer either way, so nobody can use this to find out who is registered.
  res.status(200).json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
}

/**
 * @name resetPasswordController
 * @description sets a new password using the token from the reset email
 * @access Public
 */
async function resetPasswordController(
  req: Request,
  res: Response
): Promise<void> {
  const { token, newPassword } = req.body as ResetPasswordBody;

  if (!token || !newPassword) {
    res.status(400).json({ message: "Please provide token and newPassword" });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({
      message: "New password must be at least 8 characters",
    });
    return;
  }

  const hash = await bcrypt.hash(newPassword, 10);
  const ok = await resetPasswordWithToken(hashToken(token), hash);

  if (!ok) {
    res.status(400).json({
      message: "This reset link is invalid or has expired",
    });
    return;
  }

  res.status(200).json({
    message: "Password has been reset. Please log in.",
  });
}

export {
  registerUserController,
  loginUserController,
  logoutUserController,
  getMeController,
  forgotPasswordController,
  resetPasswordController,
};