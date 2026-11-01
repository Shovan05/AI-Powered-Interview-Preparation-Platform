import { Queue, Worker, Job, ConnectionOptions } from "bullmq";
import interviewReportModel from "../models/interviewReport.model";
import { generateInterviewReport } from "../services/ai.service";
import { deleteCached } from "../services/cache.service";

export interface ReportJobData {
  reportId: string;
  userId: string;
  resume: string;
  selfDescription?: string;
  jobDescription: string;
}

const QUEUE_NAME = "report-generation";

let queue: Queue<ReportJobData> | null = null;
let worker: Worker<ReportJobData> | null = null;

// Plain connection options (not a client instance) avoid ioredis version clashes.
const connectionFrom = (url: string): ConnectionOptions => {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password || undefined,
    tls: u.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
};

async function markFailed(reportId: string, message: string): Promise<void> {
  await interviewReportModel.updateOne(
    { _id: reportId },
    { status: "failed", error: message }
  );
}

// The actual work: used by the worker, and directly when Redis is not configured.
async function processReport(data: ReportJobData): Promise<void> {
  await interviewReportModel.updateOne(
    { _id: data.reportId },
    { status: "processing" }
  );

  const result = await generateInterviewReport({
    resume: data.resume,
    selfDescription: data.selfDescription,
    jobDescription: data.jobDescription,
  });

  await interviewReportModel.updateOne(
    { _id: data.reportId },
    { ...result, status: "completed" }
  );

  // The history list now has a new completed report.
  await deleteCached(`reports:${data.userId}`);
}

export function startReportQueue(): void {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.log("REDIS_URL not set, reports will be generated in-process");
    return;
  }

  queue = new Queue<ReportJobData>(QUEUE_NAME, {
    connection: connectionFrom(url),
  });

  worker = new Worker<ReportJobData>(
    QUEUE_NAME,
    async (job: Job<ReportJobData>) => processReport(job.data),
    { connection: connectionFrom(url), concurrency: 2 }
  );

  // After the last retry, mark the report as failed.
  worker.on("failed", async (job, err) => {
    console.error(
      `Report job ${job?.id} failed (attempt ${job?.attemptsMade}):`,
      err.message
    );

    // After the last retry, mark the report as failed.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await markFailed(job.data.reportId, err.message);
    }
  });

  worker.on("completed", (job) => {
    console.log(`Report job ${job.id} completed`);
  });

  worker.on("error", (err) => console.error("Report worker error:", err.message));

  console.log("Report queue started");
}

export async function enqueueReport(data: ReportJobData): Promise<void> {
  if (queue) {
    await queue.add("generate", data, {
      attempts: 2,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
    return;
  }

  // No Redis: run in the background of this process, without making the request wait.
  processReport(data).catch(async (err: Error) => {
    console.error("Report generation failed:", err.message);
    await markFailed(data.reportId, err.message);
  });
}