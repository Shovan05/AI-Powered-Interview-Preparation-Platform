import { Request, Response } from "express";
import { PDFParse } from "pdf-parse";
import {
  generateInterviewReport,
  generateResumePdf,
} from "../services/ai.service";
import interviewReportModel from "../models/interviewReport.model";

interface GenerateReportBody {
  selfDescription?: string;
  jobDescription?: string;
}

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
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

  const interviewReportByAi = await generateInterviewReport({
    resume: resumeText,
    selfDescription,
    jobDescription,
  });

  const interviewReport = await interviewReportModel.create({
    user: userId,
    resume: resumeText,
    selfDescription,
    jobDescription,
    ...interviewReportByAi,
  });

  res.status(201).json({
    message: "Interview report generated successfully.",
    interviewReport,
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

  const interviewReport = await interviewReportModel.findOne({
    _id: interviewId,
    user: req.user?.id,
  });

  if (!interviewReport) {
    res.status(404).json({
      message: "Interview report not found.",
    });
    return;
  }

  res.status(200).json({
    message: "Interview report fetched successfully.",
    interviewReport,
  });
}

/**
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(
  req: Request,
  res: Response
): Promise<void> {
  const interviewReports = await interviewReportModel
    .find({ user: req.user?.id })
    .sort({ createdAt: -1 })
    .select(
      "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan"
    );

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