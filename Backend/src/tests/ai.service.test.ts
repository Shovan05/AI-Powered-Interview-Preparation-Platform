import { ZodError } from "zod";
import {
  generateInterviewReport,
  generateResumePdf,
} from "../services/ai.service";

const mockGenerateContent = jest.fn();
const mockLaunch = jest.fn();

// Replace the Gemini client so no network call is made. The mock is read lazily,
// because ai.service creates the client as soon as it is imported.
jest.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    };
  },
}));

// Replace Puppeteer so no browser is started.
jest.mock("puppeteer", () => ({
  __esModule: true,
  default: { launch: (...args: unknown[]) => mockLaunch(...args) },
}));

const validReport = {
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
  skillGaps: [{ skill: "Docker", severity: "medium" }],
  preparationPlan: [
    { day: 1, focus: "Node.js basics", tasks: ["Read the event loop guide"] },
  ],
};

const input = { jobDescription: "Backend role", selfDescription: "Fresher" };

const reply = (data: unknown) => ({ text: JSON.stringify(data) });

const page = { setContent: jest.fn(), pdf: jest.fn() };
const browser = { newPage: jest.fn(), close: jest.fn() };

beforeEach(() => {
  mockGenerateContent.mockReset();
  mockLaunch.mockReset();
  page.setContent.mockReset().mockResolvedValue(undefined);
  page.pdf.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  browser.newPage.mockReset().mockResolvedValue(page);
  browser.close.mockReset().mockResolvedValue(undefined);
  mockLaunch.mockResolvedValue(browser);
});

describe("generateInterviewReport", () => {
  it("returns the validated report and asks Gemini for structured JSON", async () => {
    mockGenerateContent.mockResolvedValue(reply(validReport));

    const report = await generateInterviewReport(input);

    expect(report).toEqual(validReport);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.stringContaining("Backend role"),
        config: expect.objectContaining({
          responseMimeType: "application/json",
        }),
      })
    );
  });

  it("throws when Gemini returns an empty response", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    await expect(generateInterviewReport(input)).rejects.toThrow(
      "Gemini returned an empty response"
    );
  });

  it("throws when the response is not valid JSON", async () => {
    mockGenerateContent.mockResolvedValue({ text: "not json {" });

    await expect(generateInterviewReport(input)).rejects.toThrow();
  });

  it("rejects a skill gap with an unknown severity", async () => {
    mockGenerateContent.mockResolvedValue(
      reply({
        ...validReport,
        skillGaps: [{ skill: "Docker", severity: "urgent" }],
      })
    );

    await expect(generateInterviewReport(input)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("rejects a report with a missing required field", async () => {
    const { title: _title, ...withoutTitle } = validReport;
    mockGenerateContent.mockResolvedValue(reply(withoutTitle));

    await expect(generateInterviewReport(input)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("rejects a field with the wrong type", async () => {
    mockGenerateContent.mockResolvedValue(
      reply({ ...validReport, matchScore: "high" })
    );

    await expect(generateInterviewReport(input)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("rejects a match score outside 0 to 100", async () => {
    mockGenerateContent.mockResolvedValue(
      reply({ ...validReport, matchScore: 150 })
    );

    await expect(generateInterviewReport(input)).rejects.toBeInstanceOf(
      ZodError
    );
  });

  it("passes on errors from the Gemini API", async () => {
    mockGenerateContent.mockRejectedValue(new Error("quota exceeded"));

    await expect(generateInterviewReport(input)).rejects.toThrow(
      "quota exceeded"
    );
  });
});

describe("generateResumePdf", () => {
  it("builds a PDF buffer from the HTML Gemini returns", async () => {
    mockGenerateContent.mockResolvedValue(reply({ html: "<h1>Resume</h1>" }));

    const pdf = await generateResumePdf(input);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(page.setContent).toHaveBeenCalledWith(
      "<h1>Resume</h1>",
      expect.anything()
    );
    expect(browser.close).toHaveBeenCalled();
  });

  it("closes the browser even when PDF creation fails", async () => {
    mockGenerateContent.mockResolvedValue(reply({ html: "<h1>Resume</h1>" }));
    page.pdf.mockRejectedValue(new Error("render failed"));

    await expect(generateResumePdf(input)).rejects.toThrow("render failed");
    expect(browser.close).toHaveBeenCalled();
  });

  it("rejects without starting a browser when the html field is missing", async () => {
    mockGenerateContent.mockResolvedValue(reply({}));

    await expect(generateResumePdf(input)).rejects.toBeInstanceOf(ZodError);
    expect(mockLaunch).not.toHaveBeenCalled();
  });
});