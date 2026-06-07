const crypto = require('crypto');
const { config } = require('../config');

async function sendEmail({ to, subject, html, text }) {
  if (!config.resendApiKey) {
    const plain = text || html?.replace(/<[^>]+>/g, '');
    console.log('[email:dev]', { to, subject, text: plain });
    return { id: 'dev-mode', devMode: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.emailFrom,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw };
    }
    const err = new Error(parsed.message || `Email send failed (${res.status})`);
    err.resendError = true;
    err.statusCode = res.status;
    err.resendBody = parsed;
    throw err;
  }

  return res.json();
}

function classifyEmailError(err) {
  const msg = (err.message || '').toLowerCase();
  if (
    msg.includes('only send testing emails') ||
    msg.includes('verify a domain') ||
    msg.includes('onboarding@resend.dev')
  ) {
    const match = msg.match(/your own email address \(([^)]+)\)/i);
    return {
      code: 'RESEND_SANDBOX_RESTRICTED',
      hint: match
        ? `Resend test mode only delivers to ${match[1]}. Use that address or verify a domain at resend.com/domains.`
        : 'Resend test mode only delivers to the Resend account owner. Verify a domain to send to any address.',
      allowedSandboxEmail: match ? match[1] : null,
    };
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return {
      code: 'INVALID_RECIPIENT',
      hint: 'This email address cannot receive mail. Enter a real inbox you can access.',
    };
  }
  return {
    code: 'DELIVERY_FAILED',
    hint: 'Email could not be delivered. Check the address or try again later.',
  };
}

function verificationEmailHtml(verifyUrl) {
  return `
    <h2>Verify your email</h2>
    <p>Click the link below to verify your Gold Rush Mini Game account:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in 24 hours.</p>
  `;
}

function resetPasswordEmailHtml(resetUrl) {
  return `
    <h2>Reset your password</h2>
    <p>Click the link below to reset your password:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in 15 minutes. If you did not request this, ignore this email.</p>
  `;
}

function buildVerifyUrl(token) {
  return `${config.clientUrl}/verify-email?token=${token}`;
}

function buildResetUrl(token) {
  return `${config.clientUrl}/reset-password?token=${token}`;
}

/** Never throws — returns link for UI fallback when Resend rejects (e.g. sandbox). */
async function sendVerificationEmailSafe(email, token) {
  const verifyUrl = buildVerifyUrl(token);
  try {
    await sendEmail({
      to: email,
      subject: 'Verify your Gold Rush account',
      html: verificationEmailHtml(verifyUrl),
      text: `Verify your account: ${verifyUrl}`,
    });
    return { sent: true, verifyUrl };
  } catch (err) {
    const { code, hint, allowedSandboxEmail } = classifyEmailError(err);
    console.error('[email] verification to', email, ':', err.message);
    console.log('[email:fallback] verification link:', verifyUrl);
    return {
      sent: false,
      verifyUrl,
      devVerifyUrl: verifyUrl,
      emailErrorCode: code,
      emailErrorHint: hint,
      allowedSandboxEmail,
    };
  }
}

/** Never throws — returns link for UI fallback when Resend rejects. */
async function sendPasswordResetEmailSafe(email, token) {
  const resetUrl = buildResetUrl(token);
  try {
    await sendEmail({
      to: email,
      subject: 'Reset your Gold Rush password',
      html: resetPasswordEmailHtml(resetUrl),
      text: `Reset password: ${resetUrl}`,
    });
    return { sent: true, resetUrl };
  } catch (err) {
    console.error('[email] reset to', email, ':', err.message);
    console.log('[email:fallback] reset link:', resetUrl);
    const { code, hint } = classifyEmailError(err);
    return {
      sent: false,
      resetUrl,
      devResetUrl: resetUrl,
      emailErrorCode: code,
      emailErrorHint: hint,
    };
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  sendEmail,
  sendVerificationEmailSafe,
  sendPasswordResetEmailSafe,
  buildVerifyUrl,
  buildResetUrl,
  generateToken,
};
