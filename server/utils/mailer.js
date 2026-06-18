import nodemailer from 'nodemailer';

// True when the SMTP environment variables needed to send mail are present.
export function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Send an email via the configured SMTP transport. Throws if mail isn't configured.
export async function sendMail({ to, subject, text, html, attachments }) {
  if (!isMailConfigured()) {
    throw new Error('Email is not configured on the server');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });
}
