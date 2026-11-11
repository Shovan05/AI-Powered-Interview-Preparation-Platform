const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const credentialsBody = (fields: string[]) => ({
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: fields,
        properties: {
          username: { type: "string", example: "alice" },
          email: { type: "string", format: "email", example: "alice@example.com" },
          password: { type: "string", example: "Password123" },
        },
      },
    },
  },
});

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "AI Interview Prep API",
    version: "1.0.0",
    description:
      "Backend for the AI-Powered Interview Preparation Platform.\n\n" +
      "**Trying it out:** call `POST /api/auth/register` or `POST /api/auth/login` first. " +
      "The server sets an httpOnly `token` cookie, and your browser sends it automatically on the " +
      "other requests. Report generation is asynchronous: `POST /api/interview` returns `202` and " +
      "you poll `GET /api/interview/report/{interviewId}` until `status` is `completed` or `failed`.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth", description: "Registration, login and session" },
    { name: "Interview", description: "Interview reports and tailored resume PDFs" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "token" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { message: { type: "string" } },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "6ae61db4843c49d7b84d32ce" },
          username: { type: "string" },
          email: { type: "string", format: "email" },
        },
      },
      Question: {
        type: "object",
        properties: {
          question: { type: "string" },
          intention: { type: "string" },
          answer: { type: "string" },
        },
      },
      SkillGap: {
        type: "object",
        properties: {
          skill: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
      PreparationDay: {
        type: "object",
        properties: {
          day: { type: "integer" },
          focus: { type: "string" },
          tasks: { type: "array", items: { type: "string" } },
        },
      },
      InterviewReport: {
        type: "object",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "processing", "completed", "failed"],
          },
          error: { type: "string", description: "Set when status is failed" },
          matchScore: { type: "integer", minimum: 0, maximum: 100 },
          jobDescription: { type: "string" },
          selfDescription: { type: "string" },
          resume: { type: "string" },
          technicalQuestions: {
            type: "array",
            items: { $ref: "#/components/schemas/Question" },
          },
          behavioralQuestions: {
            type: "array",
            items: { $ref: "#/components/schemas/Question" },
          },
          skillGaps: {
            type: "array",
            items: { $ref: "#/components/schemas/SkillGap" },
          },
          preparationPlan: {
            type: "array",
            items: { $ref: "#/components/schemas/PreparationDay" },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ReportSummary: {
        type: "object",
        description: "A report without the heavy fields, used in the history list",
        properties: {
          _id: { type: "string" },
          title: { type: "string" },
          status: { type: "string" },
          matchScore: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description: "Creates the user and sets the auth cookie. Limited to 10 attempts per 15 minutes per IP.",
        requestBody: credentialsBody(["username", "email", "password"]),
        responses: {
          "201": {
            description: "User registered",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "400": errorResponse("Missing fields, or the username or email already exists"),
          "429": errorResponse("Too many attempts"),
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        description: "Sets the auth cookie. Limited to 10 attempts per 15 minutes per IP.",
        requestBody: credentialsBody(["email", "password"]),
        responses: {
          "200": {
            description: "Logged in",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "400": errorResponse("Missing fields, or invalid email or password"),
          "429": errorResponse("Too many attempts"),
        },
      },
    },
    "/api/auth/logout": {
      get: {
        tags: ["Auth"],
        summary: "Log out",
        description:
          "Clears the cookie and blacklists the token in Redis with a TTL equal to its remaining life (MongoDB when Redis is not configured).",
        responses: {
          "200": {
            description: "Logged out",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { message: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/get-me": {
      get: {
        tags: ["Auth"],
        summary: "Get the logged-in user",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          "401": errorResponse("Missing, invalid or blacklisted token"),
          "404": errorResponse("User not found"),
        },
      },
    },
    "/api/interview": {
      post: {
        tags: ["Interview"],
        summary: "Start generating an interview report",
        description:
          "Saves a pending report and queues the AI generation, returning immediately. " +
          "Poll `GET /api/interview/report/{interviewId}` for the result. " +
          "Provide a resume PDF, a self description, or both. Limited to 10 per hour per user.",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["jobDescription"],
                properties: {
                  jobDescription: { type: "string" },
                  selfDescription: { type: "string" },
                  resume: { type: "string", format: "binary", description: "PDF resume (max 3 MB)" },
                },
              },
            },
          },
        },
        responses: {
          "202": {
            description: "Report accepted and queued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    interviewReport: {
                      type: "object",
                      properties: {
                        _id: { type: "string" },
                        status: { type: "string", enum: ["pending"] },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": errorResponse("Job description missing, or neither a resume nor a self description"),
          "401": errorResponse("Not authenticated"),
          "429": errorResponse("Report limit reached"),
        },
      },
      get: {
        tags: ["Interview"],
        summary: "List my completed reports, newest first",
        description: "Cached in Redis; the `X-Cache` response header shows HIT or MISS.",
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Report summaries",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    interviewReports: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ReportSummary" },
                    },
                  },
                },
              },
            },
          },
          "401": errorResponse("Not authenticated"),
        },
      },
    },
    "/api/interview/report/{interviewId}": {
      get: {
        tags: ["Interview"],
        summary: "Get one report, including its generation status",
        description:
          "Only the owner can read a report. Completed reports are cached; the `X-Cache` header shows HIT or MISS.",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "interviewId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The report",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    interviewReport: { $ref: "#/components/schemas/InterviewReport" },
                  },
                },
              },
            },
          },
          "400": errorResponse("Malformed report id"),
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("Report not found, or it belongs to another user"),
        },
      },
    },
    "/api/interview/resume/pdf/{interviewReportId}": {
      post: {
        tags: ["Interview"],
        summary: "Generate a tailored resume PDF for a completed report",
        description: "Limited to 10 per hour per user.",
        security: [{ cookieAuth: [] }],
        parameters: [
          {
            name: "interviewReportId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The PDF file",
            content: {
              "application/pdf": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "400": errorResponse("Malformed report id"),
          "401": errorResponse("Not authenticated"),
          "404": errorResponse("Report not found, or it belongs to another user"),
          "409": errorResponse("The report is not completed yet"),
          "429": errorResponse("Report limit reached"),
        },
      },
    },
    "/api/auth/forgot-password": {
      post: {
        summary: "Send a password reset link",
        description:
          "Emails a reset link if the account exists. The response is the same whether or not the email is registered.",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Reset link sent if the account exists" },
          "400": { description: "Email missing" },
          "429": { description: "Too many requests" },
        },
      },
    },
    "/api/auth/reset-password": {
      post: {
        summary: "Set a new password using a reset token",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: {
                  token: { type: "string", description: "Token from the reset email" },
                  newPassword: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password updated" },
          "400": { description: "Missing fields, short password, or invalid/expired/used token" },
          "429": { description: "Too many requests" },
        },
      },
    },
  },
};