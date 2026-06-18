import nodemailer from 'nodemailer';
import dns from 'node:dns';

// Some SMTP hosts resolve to IPv6 first; prefer IPv4 to avoid ENETUNREACH on the
// SMTP fallback path (used for local development).
dns.setDefaultResultOrder('ipv4first');

const hasSendGrid = () => !!process.env.SENDGRID_API_KEY;
const hasSMTP = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

// True when any mail transport is configured.
export function isMailConfigured() {
  return hasSendGrid() || hasSMTP();
}

// The verified "from" address. SendGrid requires this to be a verified sender/domain.
function fromAddress() {
  return process.env.SENDGRID_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
}

/**
 * Send an email. Prefers the SendGrid HTTPS API (works on hosts that block SMTP, e.g.
 * Render); falls back to SMTP when only SMTP_* is configured (handy for local dev).
 *
 * @param {Object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.text]
 * @param {string} [opts.html]
 * @param {Array<{ filename: string, content: string, contentType?: string }>} [opts.attachments]
 *        `content` is a base64-encoded string.
 */
export async function sendMail(opts) {
  if (hasSendGrid()) return sendViaSendGrid(opts);
  if (hasSMTP()) return sendViaSMTP(opts);
  throw new Error('Email is not configured on the server');
}

async function sendViaSendGrid({ to, subject, text, html, attachments }) {
  const from = fromAddress();
  if (!from) {
    throw new Error('No sender address configured. Set SENDGRID_FROM to a verified sender.');
  }

  const content = [];
  if (text) content.push({ type: 'text/plain', value: text });
  if (html) content.push({ type: 'text/html', value: html });
  if (content.length === 0) content.push({ type: 'text/plain', value: ' ' });

  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: from },
    subject: subject || '',
    content,
  };

  if (attachments && attachments.length) {
    payload.attachments = attachments.map(a => ({
      content: a.content, // already base64
      filename: a.filename || 'attachment',
      type: a.contentType || 'application/octet-stream',
      disposition: 'attachment',
    }));
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`SendGrid responded ${response.status}: ${detail || response.statusText}`);
  }

  return { messageId: response.headers.get('x-message-id') || 'sendgrid-ok' };
}

async function sendViaSMTP({ to, subject, text, html, attachments }) {
  const host = process.env.SMTP_HOST;

  // Resolve the host to IPv4 ourselves so Node's "Happy Eyeballs" can't fall back to an
  // unreachable IPv6 address. tls.servername keeps certificate validation on the hostname.
  let connectHost = host;
  try {
    const { address } = await dns.promises.lookup(host, { family: 4 });
    connectHost = address;
  } catch {
    // Fall back to the hostname if IPv4 lookup fails.
  }

  const transporter = nodemailer.createTransport({
    host: connectHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { servername: host },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  return transporter.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
    attachments: (attachments || []).map(a => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    })),
  });
}
