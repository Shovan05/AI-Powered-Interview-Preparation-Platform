import mongoose from "mongoose";

async function connectToDB(): Promise<void> {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is not defined in the environment");
  }

  try {
    await mongoose.connect(uri);
    console.log("Connected to Database");
  } catch (err) {
    console.log(err);
  }
}

export default connectToDB;