import { Router } from "express";
import { authLimiter } from "../middlewares/rateLimit.middleware";
import {
  registerUserController,
  loginUserController,
  logoutUserController,
  getMeController,
  forgotPasswordController,
  resetPasswordController,
} from "../controllers/auth.controller";
import { authUser } from "../middlewares/auth.middleware";

const authRouter = Router();

/**
 * @route POST /api/auth/register
 * @description Register a new user
 * @access Public
 */
authRouter.post("/register", authLimiter, registerUserController);

/**
 * @route POST /api/auth/login
 * @description login user with email and password
 * @access Public
 */
authRouter.post("/login", authLimiter, loginUserController);

/**
 * @route GET /api/auth/logout
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
authRouter.get("/logout", logoutUserController);

/**
 * @route GET /api/auth/get-me
 * @description get the current logged in user details
 * @access private
 */
authRouter.get("/get-me", authUser, getMeController);

/**
 * @route POST /api/auth/forgot-password
 * @description email a password reset link if the account exists
 * @access Public
 */
authRouter.post("/forgot-password", authLimiter, forgotPasswordController);

/**
 * @route POST /api/auth/reset-password
 * @description set a new password using the token from the reset email
 * @access Public
 */
authRouter.post("/reset-password", authLimiter, resetPasswordController);

export default authRouter;