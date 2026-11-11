import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  if (provider === "gmail") {
    await getTransporter().sendMail({
      from: `"AI Interview Prep" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return;
  }

  // "console" provider: print instead of sending (tests, fresh clones, Render free tier)
  console.log(`[email:console] To: ${to}\nSubject: ${subject}\n${text}`);
}