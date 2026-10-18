import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { usingEmulators } from "./firebaseAdmin";

// Sends Dovli's emails (today: sign-in codes) through any SMTP service: Gmail with an app
// password, Resend, SendGrid, Amazon SES, Brevo, Postmark… Set either
//   SMTP_URL   e.g. smtps://user:password@smtp.example.com:465
// or SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (SMTP_SECURE=true for port 465),
// plus EMAIL_FROM, e.g.  Dovli <hello@yourdomain.com>
//
// Without SMTP, in development or against the Firebase emulators, the code is printed in the
// server's terminal instead, so sign-in can be tried without an email service. Never in production.

const url = process.env.SMTP_URL;
const host = process.env.SMTP_HOST;
const from = process.env.EMAIL_FROM || "Dovli <no-reply@dovli.app>";

// A user name without its password (say, the Gmail app password isn't pasted in yet) counts as not set up.
export const mailConfigured = Boolean(url || (host && (!process.env.SMTP_USER || process.env.SMTP_PASS)));
export const mailDevLog = !mailConfigured && (process.env.NODE_ENV !== "production" || usingEmulators);

let transport: Transporter | null = null;
function mailer(): Transporter {
  if (!transport) {
    transport = url
      ? nodemailer.createTransport(url)
      : nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        });
  }
  return transport;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendSignInCode(to: string, code: string, minutes: number): Promise<void> {
  if (mailDevLog) {
    console.info(`[dovli] Sign-in code for ${to}: ${code}  (no SMTP set up, so it's shown here instead of emailed)`);
    return;
  }
  if (!mailConfigured) throw new Error("Email isn't set up on this server (SMTP_URL or SMTP_HOST).");
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  await mailer().sendMail({
    from,
    to,
    subject: `${spaced} is your Dovli sign-in code`,
    text: `Your Dovli sign-in code is ${code}.\n\nIt works for ${minutes} minutes. If you didn't ask for it, you can ignore this email: nobody can sign in without the code.`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f5f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#15171d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:440px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 4px;font-size:15px;font-weight:700">Dovli</p>
<p style="margin:0 0 20px;font-size:15px;color:#464b58">Here's your sign-in code:</p>
<p style="margin:0 0 20px;font-size:34px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,Menlo,Consolas,monospace">${escape(code)}</p>
<p style="margin:0 0 8px;font-size:14px;color:#464b58">It works for ${minutes} minutes and only once.</p>
<p style="margin:0;font-size:13px;color:#6e7382">Didn't ask for this? Ignore this email. Nobody can sign in without the code.</p>
</td></tr></table></td></tr></table></body></html>`,
  });
}
