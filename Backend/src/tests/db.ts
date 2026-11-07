import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectPostgres, closePostgres, getPool } from "../config/postgres";
import { runMigrations } from "../db/runMigrations";

let mongo: MongoMemoryServer;

export async function connectTestDB(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL;

  // Safety: clearTestDB empties tables, so never run against a non-test database.
  if (!url || !url.includes("_test")) {
    throw new Error(
      "TEST_DATABASE_URL must be set and point to a database whose name contains _test"
    );
  }

  process.env.DATABASE_URL = url;

  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  await connectPostgres();
  await runMigrations(getPool());
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;

  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }

  await getPool().query("TRUNCATE TABLE users");
}

export async function closeTestDB(): Promise<void> {
  await mongoose.disconnect();
  await mongo.stop();
  await closePostgres();
}