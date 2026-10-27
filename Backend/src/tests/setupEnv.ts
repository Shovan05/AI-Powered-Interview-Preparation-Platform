process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
// The Gemini client throws on import if no key is set, so give it a dummy.
process.env.GOOGLE_GENAI_API_KEY = "test-key";