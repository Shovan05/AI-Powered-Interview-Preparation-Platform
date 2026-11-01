import request from "supertest";
import app from "../app";
import { connectTestDB, clearTestDB, closeTestDB } from "./db";
import {
  generateInterviewReport,
  generateResumePdf,
} from "../services/ai.service";

// Replace the Gemini/Puppeteer service so tests are fast, free and deterministic.
jest.mock("../services/ai.service", () => ({
  generateInterviewReport: jest.fn(),
  generateResumePdf: jest.fn(),
}));

// Replace PDF text extraction so we don't need a real PDF file.
jest.mock("pdf-parse", () => ({
  PDFParse: jest.fn().mockImplementation(() => ({
    getText: jest.fn().mockResolvedValue({ text: "parsed resume text" }),
  })),
}));

const mockGenerateReport = generateInterviewReport as jest.MockedFunction<
  typeof generateInterviewReport
>;
const mockGeneratePdf = generateResumePdf as jest.MockedFunction<
  typeof generateResumePdf
>;

const fakeReport = {
  matchScore: 82,
  title: "Backend Developer",
  technicalQuestions: [
    {
      question: "What is the Node.js event loop?",
      intention: "Checks understanding of async execution",
      answer: "Explain the phases and the callback queue.",
    },
  ],
  behavioralQuestions: [
    {
      question: "Tell me about a hard bug you fixed.",
      intention: "Checks problem solving",
      answer: "Use the STAR format.",
    },
  ],
  skillGaps: [{ skill: "Docker", severity: "medium" as const }],
  preparationPlan: [
    { day: 1, focus: "Node.js basics", tasks: ["Read the event loop guide"] },
  ],
};

const alice = {
  username: "alice",
  email: "alice@example.com",
  password: "Password123",
};

const bob = {
  username: "bob",
  email: "bob@example.com",
  password: "Password123",
};

// The auth cookie is marked Secure, so we read it from the response
// and attach it manually on later requests.
async function registerAndGetCookie(user: typeof alice) {
  const res = await request(app).post("/api/auth/register").send(user);
  return res.headers["set-cookie"];
}

async function waitForReport(cookie: string, id: string) {
  for (let i = 0; i < 100; i++) {
    const res = await request(app)
      .get(`/api/interview/report/${id}`)
      .set("Cookie", cookie);
    const report = res.body.interviewReport;

    if (report?.status === "completed" || report?.status === "failed") {
      return report;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Report did not finish in time");
}

async function createReport(cookie: string): Promise<string> {
  const res = await request(app)
    .post("/api/interview")
    .set("Cookie", cookie)
    .send({ jobDescription: "Backend role", selfDescription: "Fresher" });

  const id = res.body.interviewReport._id as string;
  await waitForReport(cookie, id);
  return id;
}

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateReport.mockResolvedValue(fakeReport);
  mockGeneratePdf.mockResolvedValue(Buffer.from("%PDF-fake"));
});

describe("POST /api/interview", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/interview")
      .send({ jobDescription: "Backend role", selfDescription: "Fresher" });

    expect(res.status).toBe(401);
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("returns 400 when the job description is missing", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", cookie)
      .send({ selfDescription: "Fresher" });

    expect(res.status).toBe(400);
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("returns 400 when there is neither a resume nor a self description", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", cookie)
      .send({ jobDescription: "Backend role" });

    expect(res.status).toBe(400);
    expect(mockGenerateReport).not.toHaveBeenCalled();
  });

  it("accepts a self-description-only request and generates the report in the background", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", cookie)
      .send({ jobDescription: "Backend role", selfDescription: "Fresher" });

    expect(res.status).toBe(202);
    expect(res.body.interviewReport.status).toBe("pending");

    const report = await waitForReport(cookie, res.body.interviewReport._id);

    expect(report.status).toBe("completed");
    expect(report.title).toBe("Backend Developer");
    expect(report.matchScore).toBe(82);
    expect(mockGenerateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        jobDescription: "Backend role",
        selfDescription: "Fresher",
        resume: "",
      })
    );
  });

  it("marks the report as failed when the AI service throws", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const cookie = await registerAndGetCookie(alice);
    mockGenerateReport.mockRejectedValueOnce(new Error("Gemini down"));

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", cookie)
      .send({ jobDescription: "Backend role", selfDescription: "Fresher" });

    const report = await waitForReport(cookie, res.body.interviewReport._id);

    expect(report.status).toBe("failed");
    expect(report.error).toBe("Gemini down");
    errorSpy.mockRestore();
  });

  it("parses an uploaded PDF resume and passes its text to the AI service", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
      .post("/api/interview")
      .set("Cookie", cookie)
      .field("jobDescription", "Backend role")
      .attach("resume", Buffer.from("%PDF-1.4 fake"), "resume.pdf");

    expect(res.status).toBe(202);
    await waitForReport(cookie, res.body.interviewReport._id);
    expect(mockGenerateReport).toHaveBeenCalledWith(
      expect.objectContaining({ resume: "parsed resume text" })
    );
  });
});

describe("GET /api/interview", () => {
  it("returns only the logged-in user's reports, newest first, without heavy fields", async () => {
    const aliceCookie = await registerAndGetCookie(alice);
    const bobCookie = await registerAndGetCookie(bob);

    mockGenerateReport.mockResolvedValueOnce({ ...fakeReport, title: "First" });
    await createReport(aliceCookie);
    await new Promise((resolve) => setTimeout(resolve, 10));

    mockGenerateReport.mockResolvedValueOnce({ ...fakeReport, title: "Second" });
    await createReport(aliceCookie);

    mockGenerateReport.mockResolvedValueOnce({ ...fakeReport, title: "Bob's" });
    await createReport(bobCookie);

    const res = await request(app)
      .get("/api/interview")
      .set("Cookie", aliceCookie);

    expect(res.status).toBe(200);
    expect(
      res.body.interviewReports.map((r: { title: string }) => r.title)
    ).toEqual(["Second", "First"]);
    expect(res.body.interviewReports[0].technicalQuestions).toBeUndefined();
    expect(res.body.interviewReports[0].jobDescription).toBeUndefined();
  });
});

describe("GET /api/interview/report/:interviewId", () => {
  it("returns the full report to its owner", async () => {
    const cookie = await registerAndGetCookie(alice);
    const id = await createReport(cookie);

    const res = await request(app)
      .get(`/api/interview/report/${id}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.interviewReport.technicalQuestions).toHaveLength(1);
    expect(res.body.interviewReport.skillGaps[0].skill).toBe("Docker");
  });

  it("returns 404 when another user asks for the report", async () => {
    const aliceCookie = await registerAndGetCookie(alice);
    const bobCookie = await registerAndGetCookie(bob);
    const id = await createReport(aliceCookie);

    const res = await request(app)
      .get(`/api/interview/report/${id}`)
      .set("Cookie", bobCookie);

    expect(res.status).toBe(404);
  });

  it("returns 404 for a well-formed id that does not exist", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
      .get("/api/interview/report/64b7f0f0f0f0f0f0f0f0f0f0")
      .set("Cookie", cookie);

    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed report id", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
        .get("/api/interview/report/not-an-id")
        .set("Cookie", cookie);

    expect(res.status).toBe(400);
    });
});

describe("POST /api/interview/resume/pdf/:interviewReportId", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).post(
      "/api/interview/resume/pdf/64b7f0f0f0f0f0f0f0f0f0f0"
    );

    expect(res.status).toBe(401);
  });

  it("returns a PDF to the owner of the report", async () => {
    const cookie = await registerAndGetCookie(alice);
    const id = await createReport(cookie);

    const res = await request(app)
      .post(`/api/interview/resume/pdf/${id}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`resume_${id}.pdf`);
    expect(mockGeneratePdf).toHaveBeenCalledWith(
      expect.objectContaining({ jobDescription: "Backend role" })
    );
  });

  it("returns 404 and never calls the AI when another user asks for the report", async () => {
    const aliceCookie = await registerAndGetCookie(alice);
    const bobCookie = await registerAndGetCookie(bob);
    const id = await createReport(aliceCookie);

    const res = await request(app)
      .post(`/api/interview/resume/pdf/${id}`)
      .set("Cookie", bobCookie);

    expect(res.status).toBe(404);
    expect(mockGeneratePdf).not.toHaveBeenCalled();
  });
  it("returns 400 for a malformed report id and never calls the AI", async () => {
    const cookie = await registerAndGetCookie(alice);

    const res = await request(app)
        .post("/api/interview/resume/pdf/not-an-id")
        .set("Cookie", cookie);

    expect(res.status).toBe(400);
    expect(mockGeneratePdf).not.toHaveBeenCalled();
    });
});