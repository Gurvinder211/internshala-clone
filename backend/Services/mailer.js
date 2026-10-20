import { createTransport } from 'nodemailer';

function senderAddress(from) {
  const match = from.match(/^(.*?)\s*<([^<>]+)>$/);
  return match
    ? { email: match[2], name: match[1].trim().replace(/^["']|["']$/g, '') }
    : { email: from };
}

async function sendWithSendGrid({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    const error = new Error('EMAIL_FROM is required when SENDGRID_API_KEY is configured');
    error.code = 'EMAIL_FROM_NOT_CONFIGURED';
    throw error;
  }

  let response;
  try {
    response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: senderAddress(from),
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    const error = new Error('Could not reach the email API', { cause });
    error.code = 'EMAIL_API_UNAVAILABLE';
    throw error;
  }

  if (!response.ok) {
    const details = await response.text();
    console.error(`Email API rejected the message (${response.status}): ${details}`);
    const error = new Error('Email API rejected the message');
    error.code = 'EMAIL_API_REJECTED';
    throw error;
  }

  return { deliveryMode: 'email' };
}

async function sendWithResend({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) {
    const error = new Error('EMAIL_FROM is required when RESEND_API_KEY is configured');
    error.code = 'EMAIL_FROM_NOT_CONFIGURED';
    throw error;
  }

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    const error = new Error('Could not reach the email API', { cause });
    error.code = 'EMAIL_API_UNAVAILABLE';
    throw error;
  }

  if (!response.ok) {
    const details = await response.text();
    console.error(`Email API rejected the message (${response.status}): ${details}`);
    const error = new Error('Email API rejected the message');
    error.code = 'EMAIL_API_REJECTED';
    throw error;
  }

  return { deliveryMode: 'email' };
}

async function sendMail({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST;
  if (host) {
    const port = Number(process.env.SMTP_PORT) || 587;
    const smtpPassword = process.env.SMTP_PASS?.replace(/\s/g, '');
    const auth = process.env.SMTP_USER && smtpPassword
      ? { user: process.env.SMTP_USER, pass: smtpPassword }
      : undefined;
    const transporter = createTransport({
      host,
      port,
      secure: port === 465,
      // Some Render runtimes cannot route IPv6 SMTP connections. Force DNS
      // resolution/connection over IPv4 so smtp.gmail.com remains reachable.
      family: 4,
      auth,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
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

  if (process.env.SENDGRID_API_KEY) {
    return sendWithSendGrid({ to, subject, html, text });
  }

  if (process.env.RESEND_API_KEY) {
    return sendWithResend({ to, subject, html, text });
  }

  if (process.env.NODE_ENV === 'production') {
    const error = new Error('SMTP_HOST, SENDGRID_API_KEY, or RESEND_API_KEY is required to send email in production');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  console.log(`\n[DEV MAIL ONLY - NOT SENT] to: ${to}\nsubject: ${subject}\n${text}\n`);
  return { deliveryMode: 'console' };
}

export { sendMail };
