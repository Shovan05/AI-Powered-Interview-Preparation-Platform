import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { isTokenBlacklisted } from "../services/tokenBlacklist.service";

async function authUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies.token;

  if (!token) {
    res.status(401).json({
      message: "Token not provided.",
    });
    return;
  }

  if (await isTokenBlacklisted(token)) {
    res.status(401).json({
      message: "token is invalid",
    });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not defined in the environment");
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    req.user = decoded;

    next();
  } catch (err) {
    res.status(401).json({
      message: "Invalid token.",
    });
  }
}

export { authUser };