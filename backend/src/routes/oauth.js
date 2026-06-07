const express = require('express');
const crypto = require('crypto');
const { config } = require('../config');
const users = require('../services/users');
const { signToken } = require('../middleware/auth');

const router = express.Router();

const OAUTH_STATES = new Map();

function oauthCallbackUrl(provider) {
  return `${config.apiPublicUrl}/api/oauth/${provider}/callback`;
}

function storeState(state) {
  OAUTH_STATES.set(state, Date.now());
  for (const [key, ts] of OAUTH_STATES) {
    if (Date.now() - ts > 10 * 60 * 1000) OAUTH_STATES.delete(key);
  }
}

function verifyState(state) {
  if (!state || !OAUTH_STATES.has(state)) return false;
  OAUTH_STATES.delete(state);
  return true;
}

function oauthRedirect(provider, error) {
  const params = new URLSearchParams({ oauth: provider });
  if (error) params.set('error', error);
  return `${config.clientUrl}/login?${params}`;
}

function parseOAuthError(body, provider) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  if (text.includes('redirect_uri_mismatch') || text.includes('invalid_redirect_uri')) {
    return 'redirect_uri_mismatch';
  }
  console.error(`[oauth/${provider}] token exchange failed. redirect_uri=${oauthCallbackUrl(provider)} body=${text}`);
  return 'oauth_failed';
}

async function exchangeGoogleCode(code) {
  const redirectUri = oauthCallbackUrl('google');
  const params = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    const code = parseOAuthError(body, 'google');
    const err = new Error(`Google token exchange failed: ${body}`);
    err.oauthCode = code;
    throw err;
  }

  const tokens = await tokenRes.json();
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error('Google profile fetch failed');

  const profile = await profileRes.json();
  if (!profile.email) throw new Error('Google account has no email');
  return { email: profile.email, oauthId: profile.id };
}

async function exchangeDiscordCode(code) {
  const redirectUri = oauthCallbackUrl('discord');
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    client_secret: config.discordClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    const code = parseOAuthError(body, 'discord');
    const err = new Error(`Discord token exchange failed: ${body}`);
    err.oauthCode = code;
    throw err;
  }

  const tokens = await tokenRes.json();
  const profileRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error('Discord profile fetch failed');

  const profile = await profileRes.json();
  if (!profile.email) throw new Error('Discord account has no email');

  return { email: profile.email, oauthId: profile.id };
}

async function findOrCreateOAuthUser(provider, profile) {
  let user = await users.findByOAuth(provider, profile.oauthId);
  if (user) return user;

  const byEmail = await users.findByEmail(profile.email);
  if (byEmail) {
    await users.linkOAuth(byEmail.id, provider, profile.oauthId);
    return users.findByEmail(profile.email);
  }

  user = await users.createOAuthUser(profile.email, provider, profile.oauthId, {
    termsAccepted: true,
    ageConfirmed: true,
  });
  return user;
}

function redirectWithToken(res, user) {
  const token = signToken(user);
  const fragment = `#token=${encodeURIComponent(token)}&user=${encodeURIComponent(JSON.stringify(users.toPublicUser(user)))}`;
  res.redirect(`${config.clientUrl}/login${fragment}`);
}

router.get('/config', (_req, res) => {
  res.json({
    apiPublicUrl: config.apiPublicUrl,
    clientUrl: config.clientUrl,
    googleRedirectUri: oauthCallbackUrl('google'),
    discordRedirectUri: oauthCallbackUrl('discord'),
    googleConfigured: Boolean(config.googleClientId),
    discordConfigured: Boolean(config.discordClientId),
    setupHint:
      'Register the redirect URIs above in Google Cloud Console and Discord Developer Portal (use port 3000, not 5173).',
  });
});

router.get('/google', (req, res) => {
  if (!config.googleClientId) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  storeState(state);
  const redirectUri = oauthCallbackUrl('google');
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!verifyState(state)) {
      return res.redirect(oauthRedirect('google', 'invalid_state'));
    }
    const profile = await exchangeGoogleCode(code);
    const user = await findOrCreateOAuthUser('google', profile);
    redirectWithToken(res, user);
  } catch (err) {
    const errorCode = err.oauthCode || 'oauth_failed';
    console.error('[oauth/google]', err.message);
    res.redirect(oauthRedirect('google', errorCode));
  }
});

router.get('/discord', (req, res) => {
  if (!config.discordClientId) {
    return res.status(503).json({ error: 'Discord OAuth not configured' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  storeState(state);
  const redirectUri = oauthCallbackUrl('discord');
  const params = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get('/discord/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!verifyState(state)) {
      return res.redirect(oauthRedirect('discord', 'invalid_state'));
    }
    const profile = await exchangeDiscordCode(code);
    const user = await findOrCreateOAuthUser('discord', profile);
    redirectWithToken(res, user);
  } catch (err) {
    const errorCode = err.oauthCode || 'oauth_failed';
    console.error('[oauth/discord]', err.message);
    res.redirect(oauthRedirect('discord', errorCode));
  }
});

module.exports = router;
