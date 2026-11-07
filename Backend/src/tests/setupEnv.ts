import { config } from "dotenv";
import path from "path";

// Read only TEST_DATABASE_URL from Backend/.env, without loading anything else into the test environment.
const { parsed } = config({
  path: path.join(__dirname, "../../.env"),
  processEnv: {},
  quiet: true,
});
if (!process.env.TEST_DATABASE_URL && parsed?.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = parsed.TEST_DATABASE_URL;
}


process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
// The Gemini client throws on import if no key is set, so give it a dummy.
process.env.GOOGLE_GENAI_API_KEY = "test-key";