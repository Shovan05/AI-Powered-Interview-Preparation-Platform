import request from "supertest";
import app from "../app";
import { connectTestDB, clearTestDB, closeTestDB } from "./db";
import { getPool } from "../config/postgres";
import { sendEmail } from "../services/email.service";

// Never send real email from tests.
jest.mock("../services/email.service", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

const user = {
  username: "alice",
  email: "alice@example.com",
  password: "Password123",
};

// The auth cookie is marked Secure, so Supertest will not resend it over http.
// We read it from the response and attach it manually instead.
async function registerAndGetCookie() {
  const res = await request(app).post("/api/auth/register").send(user);
  return res.headers["set-cookie"];
}

describe("POST /api/auth/register", () => {
  it("registers a new user and sets an auth cookie", async () => {
    const res = await request(app).post("/api/auth/register").send(user);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.password).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects a request with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: user.email });

    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email or username", async () => {
    await request(app).post("/api/auth/register").send(user);
    const res = await request(app).post("/api/auth/register").send(user);

    expect(res.status).toBe(400);
  });

    it("treats emails as case-insensitive", async () => {
    await request(app).post("/api/auth/register").send(user);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...user, username: "alice2", email: "ALICE@example.com" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(user);
  });

  it("logs in with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "wrong-password" });

    expect(res.status).toBe(400);
  });

  it("rejects an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: user.password });

    expect(res.status).toBe(400);
  });

    it("logs in when the email is typed in a different case", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Alice@Example.com", password: user.password });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/get-me", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/get-me");

    expect(res.status).toBe(401);
  });

  it("returns the current user with a valid token", async () => {
    const cookie = await registerAndGetCookie();

    const res = await request(app).get("/api/auth/get-me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(user.username);
  });
});

describe("GET /api/auth/logout", () => {
  it("blacklists the token so it can no longer be used", async () => {
    const cookie = await registerAndGetCookie();

    const logout = await request(app).get("/api/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);

    const res = await request(app).get("/api/auth/get-me").set("Cookie", cookie);
    expect(res.status).toBe(401);
  });
});

describe("forgot and reset password", () => {
  beforeEach(async () => {
    mockSendEmail.mockClear();
    await request(app).post("/api/auth/register").send(user);
  });

  // The email text contains the reset link; pull the token out of it.
  function tokenFromLastEmail(): string {
    const calls = mockSendEmail.mock.calls;
    const text = calls[calls.length - 1][3];
    const match = text.match(/token=([a-f0-9]{64})/);
    if (!match) throw new Error("No token found in the email");
    return match[1];
  }

  async function requestReset(): Promise<string> {
    await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });
    return tokenFromLastEmail();
  }

  it("rejects forgot-password without an email", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({});

    expect(res.status).toBe(400);
  });

  it("sends a reset email for a registered address", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });

    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0]).toBe(user.email);
  });

  it("gives the same answer for an unknown address and sends nothing", async () => {
    const known = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });
    mockSendEmail.mockClear();

    const unknown = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("resets the password: the old one stops working and the new one works", async () => {
    const token = await requestReset();

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPass1" });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });
    expect(oldLogin.status).toBe(400);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "BrandNewPass1" });
    expect(newLogin.status).toBe(200);
  });

  it("only lets a reset link be used once", async () => {
    const token = await requestReset();

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPass1" });
    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "AnotherPass22" });

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const token = await requestReset();
    await getPool().query(
      "UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'"
    );

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPass1" });

    expect(res.status).toBe(400);
  });

  it("rejects an unknown token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(64), newPassword: "BrandNewPass1" });

    expect(res.status).toBe(400);
  });

  it("rejects a short new password without using the token", async () => {
    const token = await requestReset();

    const short = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "short" });
    expect(short.status).toBe(400);

    const valid = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPass1" });
    expect(valid.status).toBe(200);
  });

  it("rejects reset-password with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "abc" });

    expect(res.status).toBe(400);
  });
});