import nodemailer from 'nodemailer';
import dns from 'node:dns';

// Some SMTP hosts (e.g. smtp.gmail.com) resolve to an IPv6 address first. On networks
// without IPv6 connectivity that causes "connect ENETUNREACH <ipv6>". Preferring IPv4
// makes the SMTP connection use an IPv4 address instead.
dns.setDefaultResultOrder('ipv4first');

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
    // Fail fast instead of hanging forever when the SMTP host is unreachable/misconfigured.
    connectionTimeout: 15000, // ms to establish the TCP connection
    greetingTimeout: 15000,   // ms to wait for the server greeting
    socketTimeout: 30000,     // ms of inactivity before giving up
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
