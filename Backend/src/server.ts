import "dotenv/config";
import { setServers } from "node:dns";
import app from "./app";
import connectToDB from "./config/database";
import { connectRedis } from "./config/redis";

// Development only: some networks can't resolve Atlas SRV records,
// so use public DNS servers. Skipped in production (Render, Docker).
if (process.env.NODE_ENV !== "production") {
  setServers(["8.8.8.8", "1.1.1.1"]);
}

const PORT = process.env.PORT || 3000;

const start = async (): Promise<void> => {
  await connectToDB();
  await connectRedis();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
