import request from "supertest";
import app from "../app";
import { connectTestDB, clearTestDB, closeTestDB } from "./db";

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