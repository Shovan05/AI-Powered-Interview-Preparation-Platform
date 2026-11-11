import "dotenv/config";
import { sendEmail } from "../services/email.service";

sendEmail(
  process.env.EMAIL_USER as string,
  "Test email",
  "<p>It works.</p>",
  "It works."
)
  .then(() => console.log("sent"))
  .catch((e) => console.error(e));