import "dotenv/config";
import { setServers } from "node:dns";
import app from "./app";
import connectToDB from "./config/database";

if (process.env.NODE_ENV !== "production") {
  setServers(["8.8.8.8", "1.1.1.1"]);
}

connectToDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
