import request from "supertest";
import app from "../app";

describe("API documentation", () => {
  it("serves an OpenAPI document that lists every route", async () => {
    const res = await request(app).get("/api-docs.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(Object.keys(res.body.paths).sort()).toEqual(
      [
        "/api/auth/get-me",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/register",
        "/api/interview",
        "/api/interview/report/{interviewId}",
        "/api/interview/resume/pdf/{interviewReportId}",
      ].sort()
    );
  });

  it("serves the Swagger UI page", async () => {
    const res = await request(app).get("/api-docs/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
  });
});