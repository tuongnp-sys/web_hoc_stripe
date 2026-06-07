const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must include uppercase, lowercase, number, and special character';
  }
  return null;
}

const BLOCKED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'test.local',
  'lab.local',
  'localhost',
  'invalid.com',
  'fake.com',
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'yopmail.com',
]);

function isDevLocalEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  const domain = normalized.split('@')[1];
  return domain === 'localhost' || domain === '127.0.0.1';
}

function validateEmail(email, { allowDevLocal = false } = {}) {
  if (!email) return 'Valid email is required';
  const normalized = email.trim().toLowerCase();
  if (allowDevLocal && isDevLocalEmail(normalized)) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return 'Valid email is required';
  }
  return null;
}

function validateDeliverableEmail(email, { allowDevLocal = false } = {}) {
  const formatErr = validateEmail(email, { allowDevLocal });
  if (formatErr) return formatErr;

  const normalized = email.trim().toLowerCase();
  const [, domain] = normalized.split('@');

  if (allowDevLocal && isDevLocalEmail(normalized)) {
    return null;
  }
  if (!domain || domain.length < 4 || !domain.includes('.')) {
    return 'Use a real email address with a valid domain (e.g. gmail.com)';
  }

  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return 'Use a real email address with a valid domain';
  }

  if (BLOCKED_EMAIL_DOMAINS.has(domain)) {
    return 'This email domain cannot receive mail. Use your real inbox (Gmail, Outlook, etc.)';
  }

  if (domain.endsWith('.local') || domain.endsWith('.test') || domain.endsWith('.invalid')) {
    return 'Use a real email address — .local/.test domains cannot receive verification mail';
  }

  return null;
}

module.exports = {
  validatePassword,
  validateEmail,
  validateDeliverableEmail,
  isDevLocalEmail,
  PASSWORD_REGEX,
  BLOCKED_EMAIL_DOMAINS,
};
