import { Router } from "express";
import { authUser } from "../middlewares/auth.middleware";
import { reportLimiter } from "../middlewares/rateLimit.middleware";
import upload from "../middlewares/file.middleware";
import {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  generateResumePdfController,
} from "../controllers/interview.controller";

const interviewRouter = Router();

/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post(
  "/",
  authUser,
  reportLimiter,
  upload.single("resume"),
  generateInterViewReportController
);

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get(
  "/report/:interviewId",
  authUser,
  getInterviewReportByIdController
);

/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authUser, getAllInterviewReportsController);

/**
 * @route POST /api/interview/resume/pdf/:interviewReportId
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */
interviewRouter.post(
  "/resume/pdf/:interviewReportId",
  authUser,
  reportLimiter,
  generateResumePdfController
);

export default interviewRouter;