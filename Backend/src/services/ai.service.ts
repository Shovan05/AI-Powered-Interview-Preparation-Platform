import { GoogleGenAI, Schema } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import puppeteer from "puppeteer";

const MODEL = "gemini-3-flash-preview";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

function makeQuestionSchema(kind: "technical" | "behavioral") {
  return z.object({
    question: z
      .string()
      .describe(`The ${kind} question can be asked in the interview`),
    intention: z
      .string()
      .describe("The intention of interviewer behind asking this question"),
    answer: z
      .string()
      .describe(
        "How to answer this question, what points to cover, what approach to take etc."
      ),
  });
}

const interviewReportSchema = z.object({
  matchScore: z
    .number()
    .describe(
      "A score between 0 and 100 indicating how well the candidate's profile matches the job describe"
    ),
  technicalQuestions: z
    .array(makeQuestionSchema("technical"))
    .describe(
      "Technical questions that can be asked in the interview along with their intention and how to answer them"
    ),
  behavioralQuestions: z
    .array(makeQuestionSchema("behavioral"))
    .describe(
      "Behavioral questions that can be asked in the interview along with their intention and how to answer them"
    ),
  skillGaps: z
    .array(
      z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z
          .enum(["low", "medium", "high"])
          .describe(
            "The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances"
          ),
      })
    )
    .describe("List of skill gaps in the candidate's profile along with their severity"),
  preparationPlan: z
    .array(
      z.object({
        day: z
          .number()
          .describe("The day number in the preparation plan, starting from 1"),
        focus: z
          .string()
          .describe(
            "The main focus of this day in the preparation plan, e.g. data structures, system design,mock interviews etc."
          ),
        tasks: z
          .array(z.string())
          .describe(
            "List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc."
          ),
      })
    )
    .describe(
      "A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"
    ),
  title: z
    .string()
    .describe("The title of the job for which the interview report is generated"),
});

const resumePdfSchema = z.object({
  html: z
    .string()
    .describe(
      "The HTML content of the resume which can be converted to PDF using any library like puppeteer"
    ),
});

export type InterviewReportAI = z.infer<typeof interviewReportSchema>;

export interface ReportInput {
  resume?: string;
  selfDescription?: string;
  jobDescription: string;
}

// zod-to-json-schema returns a generic JSON schema type; Gemini's SDK expects its own Schema type.
function toResponseSchema(schema: z.ZodTypeAny): Schema {
  return zodToJsonSchema(schema) as unknown as Schema;
}

async function generateJson<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T
): Promise<z.output<T>> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: toResponseSchema(schema),
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response");
  }

  // Never trust model output: validate it against the schema before using it.
  return schema.parse(JSON.parse(response.text));
}

async function generateInterviewReport({
  resume,
  selfDescription,
  jobDescription,
}: ReportInput): Promise<InterviewReportAI> {
  const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}
`;

  return generateJson(prompt, interviewReportSchema);
}

async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

async function generateResumePdf({
  resume,
  selfDescription,
  jobDescription,
}: ReportInput): Promise<Buffer> {
  const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visuallyappealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `;

  const { html } = await generateJson(prompt, resumePdfSchema);

  return generatePdfFromHtml(html);
}

export { generateInterviewReport, generateResumePdf };