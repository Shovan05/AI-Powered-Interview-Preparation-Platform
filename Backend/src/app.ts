
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routes/auth.routes";
import interviewRouter from "./routes/interview.routes";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "./docs/openapi";

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://ai-interview-preperation-guide.vercel.app",
  "https://ai-interview-prep-mu-five.vercel.app",
];

app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Disallowed origins receive no CORS headers.
        callback(null, false);
      }
    },
    credentials: true,
  })
);

// Swagger documentation
app.get("/api-docs.json", (_req, res) => {
  res.json(openApiSpec);
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "AI Interview Prep API",
  })
);

// API routes
app.use("/api/auth", authRouter);
app.use("/api/interview", interviewRouter);

// Root route
app.get("/", (_req: Request, res: Response) => {
  res.send("Backend is running 🚀");
});

export default app;
