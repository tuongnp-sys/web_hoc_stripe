const express = require('express');
const rateLimit = require('express-rate-limit');
const users = require('../services/users');
const emailService = require('../services/email');
const { config } = require('../config');
const { signToken, requireAuth, isEmailVerified } = require('../middleware/auth');
const {
  ACCOUNT_SUSPENDED_MESSAGE,
  ACCOUNT_SUSPENDED_CODE,
} = require('../constants/authMessages');
const { validatePassword, validateEmail, validateDeliverableEmail } = require('../utils/validation');

const router = express.Router();

const deliverableOpts = () => ({ allowDevLocal: config.nodeEnv === 'development' });

function attachEmailDelivery(payload, emailResult, linkField) {
  const url = emailResult.verifyUrl || emailResult.resetUrl;
  payload.emailSent = emailResult.sent;

  if (!emailResult.sent) {
    payload[linkField] = emailResult[linkField] || url;
    payload.emailErrorCode = emailResult.emailErrorCode;
    payload.emailErrorHint = emailResult.emailErrorHint;
    payload.allowedSandboxEmail = emailResult.allowedSandboxEmail;
  }

  if (config.nodeEnv === 'development' && url) {
    payload[linkField] = url;
    payload.showInAppLink = true;
  }

  return payload;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, confirmPassword, acceptTerms, confirmAge } = req.body;

    const emailErr = validateDeliverableEmail(email, deliverableOpts());
    if (emailErr) {
      return res.status(400).json({ error: emailErr, code: 'UNDELIVERABLE_EMAIL' });
    }

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ error: passwordErr });

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (!acceptTerms) {
      return res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy' });
    }
    if (!confirmAge) {
      return res.status(400).json({ error: 'You must confirm you are at least 13 years old' });
    }

    const existing = await users.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const user = await users.createUser(email, password, {
      termsAccepted: true,
      ageConfirmed: true,
    });

    const token = emailService.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await users.createVerificationToken(user.id, token, expiresAt);
    const emailResult = await emailService.sendVerificationEmailSafe(user.email, token);

    const jwt = signToken(user);
    const payload = attachEmailDelivery(
      {
        token: jwt,
        user: users.toPublicUser(user),
        message: emailResult.sent
          ? 'Account created. Check your inbox or use the verification link on this page.'
          : 'Account created. Use the verification link on this page (email delivery unavailable).',
      },
      emailResult,
      'devVerifyUrl'
    );
    res.status(201).json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await users.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password_hash) {
      const label =
        user.oauth_provider === 'google'
          ? 'Google'
          : user.oauth_provider === 'discord'
            ? 'Discord'
            : 'social login';
      return res.status(400).json({
        error: `This account uses ${label}. Please use "${label}" to sign in.`,
        code: 'OAUTH_ACCOUNT',
        oauthProvider: user.oauth_provider,
      });
    }

    if (!(await users.verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({
        error: ACCOUNT_SUSPENDED_MESSAGE,
        code: ACCOUNT_SUSPENDED_CODE,
      });
    }

    const token = signToken(user);
    res.json({ token, user: users.toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: users.toPublicUser(req.user) });
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const userId = await users.consumeVerificationToken(token);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    const user = await users.findById(userId);
    res.json({ user: users.toPublicUser(user), message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/resend-verification', authLimiter, requireAuth, async (req, res, next) => {
  try {
    if (isEmailVerified(req.user)) {
      return res.json({ message: 'Email already verified' });
    }

    const token = emailService.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await users.createVerificationToken(req.user.id, token, expiresAt);
    const emailResult = await emailService.sendVerificationEmailSafe(req.user.email, token);

    const payload = attachEmailDelivery(
      {
        message: emailResult.sent
          ? 'Verification email sent. Also use the link below if it does not arrive.'
          : 'Use the verification link below.',
      },
      emailResult,
      'devVerifyUrl'
    );
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/update-email', authLimiter, requireAuth, async (req, res, next) => {
  try {
    if (isEmailVerified(req.user)) {
      return res.status(400).json({ error: 'Email is already verified and cannot be changed here' });
    }
    if (req.user.oauth_provider) {
      return res.status(400).json({
        error: 'Social login accounts cannot change email this way',
        code: 'OAUTH_ACCOUNT',
      });
    }

    const { email } = req.body;
    const emailErr = validateDeliverableEmail(email, deliverableOpts());
    if (emailErr) {
      return res.status(400).json({ error: emailErr, code: 'UNDELIVERABLE_EMAIL' });
    }

    const existing = await users.findByEmail(email);
    if (existing && String(existing.id) !== String(req.user.id)) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const updated = await users.updateEmail(req.user.id, email);
    const token = emailService.generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await users.createVerificationToken(updated.id, token, expiresAt);
    const emailResult = await emailService.sendVerificationEmailSafe(updated.email, token);

    const jwt = signToken(updated);
    const payload = attachEmailDelivery(
      {
        token: jwt,
        user: users.toPublicUser(updated),
        message: emailResult.sent
          ? 'Email updated. Check your inbox or use the link below.'
          : 'Email updated. Use the verification link below.',
      },
      emailResult,
      'devVerifyUrl'
    );
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const emailErr = validateDeliverableEmail(email, deliverableOpts());
    if (emailErr) {
      return res.status(400).json({ error: emailErr, code: 'UNDELIVERABLE_EMAIL' });
    }

    const user = await users.findByEmail(email);
    if (!user) {
      return res.json({
        message: 'If that email exists, a reset link has been sent.',
        emailSent: false,
        notFound: true,
      });
    }

    if (!user.password_hash) {
      const label =
        user.oauth_provider === 'google'
          ? 'Google'
          : user.oauth_provider === 'discord'
            ? 'Discord'
            : 'social login';
      return res.status(400).json({
        error: `This account uses ${label}. Password reset is not available â€” sign in with ${label}.`,
        code: 'OAUTH_ACCOUNT',
      });
    }

    const token = emailService.generateToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await users.createPasswordResetToken(user.id, token, expiresAt);

    const emailResult = await emailService.sendPasswordResetEmailSafe(user.email, token);
    const payload = attachEmailDelivery(
      {
        message: emailResult.sent
          ? 'Reset link sent. Check your email or use the link below (expires in 15 minutes).'
          : 'Use the reset link below (expires in 15 minutes).',
      },
      emailResult,
      'devResetUrl'
    );
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const passwordErr = validatePassword(password);
    if (passwordErr) return res.status(400).json({ error: passwordErr });
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const resetRecord = await users.consumePasswordResetToken(token);
    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    await users.updatePassword(resetRecord.user_id, password);
    await users.markPasswordResetUsed(resetRecord.id);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
