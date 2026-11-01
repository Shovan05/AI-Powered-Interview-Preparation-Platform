import { Request, Response } from "express";
import { PDFParse } from "pdf-parse";
import { isValidObjectId } from "mongoose";
import { generateResumePdf } from "../services/ai.service";
import interviewReportModel from "../models/interviewReport.model";
import { getCached, setCached } from "../services/cache.service";
import { enqueueReport } from "../queues/report.queue";

const REPORT_TTL_SECONDS = 60 * 60; // reports never change once completed
const LIST_TTL_SECONDS = 10 * 60; // deleted when a report completes

const reportKey = (userId: string, reportId: string): string =>
  `report:${userId}:${reportId}`;
const listKey = (userId: string): string => `reports:${userId}`;

interface GenerateReportBody {
  selfDescription?: string;
  jobDescription?: string;
}

/**
 * @description Controller to start generating an interview report in the background.
 */
async function generateInterViewReportController(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const { selfDescription, jobDescription } = req.body as GenerateReportBody;

  if (!jobDescription) {
    res.status(400).json({ message: "Job description is required." });
    return;
  }

  if (!req.file && !selfDescription) {
    res.status(400).json({
      message: "Please provide either a resume or a self description.",
    });
    return;
  }

  let resumeText = "";

  if (req.file) {
    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    const parsed = await parser.getText();
    resumeText = parsed.text;
  }

  // Save a placeholder now; the worker fills in the real content.
  const report = await interviewReportModel.create({
    user: userId,
    title: "Generating report...",
    resume: resumeText,
    selfDescription,
    jobDescription,
    status: "pending",
  });

  await enqueueReport({
    reportId: String(report._id),
    userId: String(userId),
    resume: resumeText,
    selfDescription,
    jobDescription,
  });

  res.status(202).json({
    message: "Interview report is being generated.",
    interviewReport: { _id: report._id, status: report.status },
  });
}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(
  req: Request,
  res: Response
): Promise<void> {
  const interviewId = req.params.interviewId as string;

  if (!isValidObjectId(interviewId)) {
    res.status(400).json({
      message: "Invalid interview report ID.",
    });
    return;
  }

  const userId = String(req.user?.id);
  const key = reportKey(userId, interviewId);

  const cached = await getCached<unknown>(key);

  if (cached) {
    res.set("X-Cache", "HIT");
    res.status(200).json({
      message: "Interview report fetched successfully.",
      interviewReport: cached,
    });
    return;
  }

  const interviewReport = await interviewReportModel
    .findOne({
      _id: interviewId,
      user: req.user?.id,
    })
    .lean();

  if (!interviewReport) {
    res.status(404).json({
      message: "Interview report not found.",
    });
    return;
  }

  // Only finished reports are cached; pending ones change within seconds.
  if (!interviewReport.status || interviewReport.status === "completed") {
    await setCached(key, interviewReport, REPORT_TTL_SECONDS);
  }

  res.set("X-Cache", "MISS");
  res.status(200).json({
    message: "Interview report fetched successfully.",
    interviewReport,
  });
}

/**
 * @description Controller to get all completed interview reports of logged in user.
 */
async function getAllInterviewReportsController(
  req: Request,
  res: Response
): Promise<void> {
  const userId = String(req.user?.id);
  const key = listKey(userId);

  const cached = await getCached<unknown[]>(key);

  if (cached) {
    res.set("X-Cache", "HIT");
    res.status(200).json({
      message: "Interview reports fetched successfully.",
      interviewReports: cached,
    });
    return;
  }

  const interviewReports = await interviewReportModel
    .find({
      user: req.user?.id,
      status: { $nin: ["pending", "processing", "failed"] },
    })
    .sort({ createdAt: -1 })
    .select(
      "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan"
    )
    .lean();

  await setCached(key, interviewReports, LIST_TTL_SECONDS);

  res.set("X-Cache", "MISS");
  res.status(200).json({
    message: "Interview reports fetched successfully.",
    interviewReports,
  });
}

/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(
  req: Request,
  res: Response
): Promise<void> {
  const interviewReportId = req.params.interviewReportId as string;

  if (!isValidObjectId(interviewReportId)) {
    res.status(400).json({
      message: "Invalid interview report ID.",
    });
    return;
  }

  // Only the owner of a report may generate a PDF from it.
  const interviewReport = await interviewReportModel.findOne({
    _id: interviewReportId,
    user: req.user?.id,
  });

  if (!interviewReport) {
    res.status(404).json({
      message: "Interview report not found.",
    });
    return;
  }

  if (interviewReport.status !== "completed") {
    res.status(409).json({
      message: "Interview report is not ready yet.",
    });
    return;
  }

  const { resume, jobDescription, selfDescription } = interviewReport;

  const pdfBuffer = await generateResumePdf({
    resume,
    jobDescription,
    selfDescription,
  });

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`,
  });

  res.send(pdfBuffer);
}

export {
  generateInterViewReportController,
  getInterviewReportByIdController,
  getAllInterviewReportsController,
  generateResumePdfController,
};