import { createTransport } from 'nodemailer';

async function sendMail({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP_HOST is required to send email in production');
    }
    console.log(`\n[DEV MAIL ONLY - NOT SENT] to: ${to}\nsubject: ${subject}\n${text}\n`);
    return { deliveryMode: 'console' };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const smtpPassword = process.env.SMTP_PASS?.replace(/\s/g, '');
  const auth = process.env.SMTP_USER && smtpPassword
    ? { user: process.env.SMTP_USER, pass: smtpPassword }
    : undefined;
  const transporter = createTransport({ host, port, secure: port === 465, auth });
  const result = await transporter.sendMail({
    from: process.env.SMTP_FROM || `"InternArea" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text,
  });
  if (!result.accepted?.length) {
    throw new Error('SMTP server did not accept the message');
  }
  return { deliveryMode: 'email' };
}

export { sendMail };