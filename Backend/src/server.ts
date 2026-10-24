import "dotenv/config";
import app from "./app";
import connectToDB from "./config/database";

connectToDB();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
