require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

function trimEnv(name, fallback = '') {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return value.trim();
}

const PORT = Number(trimEnv('PORT')) || 3000;
const CLIENT_URL = trimEnv('CLIENT_URL', 'http://localhost:5173').replace(/\/$/, '');
const API_PUBLIC_URL = trimEnv('API_PUBLIC_URL', `http://localhost:${PORT}`).replace(/\/$/, '');

function requireEnv(name) {
  const value = trimEnv(name);
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const config = {
  port: PORT,
  clientUrl: CLIENT_URL,
  apiPublicUrl: API_PUBLIC_URL,
  nodeEnv: trimEnv('NODE_ENV', 'development'),
  databaseUrl: trimEnv('DATABASE_URL') || null,
  stripeSecretKey: trimEnv('STRIPE_SECRET_KEY') || null,
  stripeWebhookSecret: trimEnv('STRIPE_WEBHOOK_SECRET') || null,
  stripeSecretKeyLive: trimEnv('STRIPE_SECRET_KEY_LIVE') || null,
  stripeWebhookSecretLive: trimEnv('STRIPE_WEBHOOK_SECRET_LIVE') || null,
  stripeLiveAllowed: trimEnv('STRIPE_LIVE_ALLOWED') === 'true',
  stripePriceGoldStarter: trimEnv('STRIPE_PRICE_GOLD_STARTER') || null,
  stripePriceGoldPopular: trimEnv('STRIPE_PRICE_GOLD_POPULAR') || null,
  stripePriceGoldPro: trimEnv('STRIPE_PRICE_GOLD_PRO') || null,
  stripePriceGoldMega: trimEnv('STRIPE_PRICE_GOLD_MEGA') || null,
  stripePricePremiumMonthly: trimEnv('STRIPE_PRICE_PREMIUM_MONTHLY') || null,
  jwtSecret: trimEnv('JWT_SECRET', 'dev-jwt-secret-change-in-production'),
  jwtExpiresIn: trimEnv('JWT_EXPIRES_IN', '7d'),
  adminSecret: trimEnv('ADMIN_SECRET') || null,
  resendApiKey: trimEnv('RESEND_API_KEY') || null,
  emailFrom: trimEnv('EMAIL_FROM', 'Gold Rush <onboarding@resend.dev>'),
  googleClientId: trimEnv('GOOGLE_CLIENT_ID') || null,
  googleClientSecret: trimEnv('GOOGLE_CLIENT_SECRET') || null,
  discordClientId: trimEnv('DISCORD_CLIENT_ID') || null,
  discordClientSecret: trimEnv('DISCORD_CLIENT_SECRET') || null,
  stripeTaxEnabled: trimEnv('STRIPE_TAX_ENABLED') === 'true',
};

function validateConfig() {
  requireEnv('STRIPE_SECRET_KEY');
  if (!trimEnv('DATABASE_URL')) {
    console.error('Missing DATABASE_URL — see docs/NEON_SETUP.md');
    process.exit(1);
  }
  requireEnv('JWT_SECRET');
  config.stripeSecretKey = trimEnv('STRIPE_SECRET_KEY');
  config.databaseUrl = trimEnv('DATABASE_URL');
  config.jwtSecret = trimEnv('JWT_SECRET');
  config.stripeWebhookSecret = trimEnv('STRIPE_WEBHOOK_SECRET') || null;
  config.stripeSecretKeyLive = trimEnv('STRIPE_SECRET_KEY_LIVE') || null;
  config.stripeWebhookSecretLive = trimEnv('STRIPE_WEBHOOK_SECRET_LIVE') || null;
  config.stripeLiveAllowed = trimEnv('STRIPE_LIVE_ALLOWED') === 'true';
  config.stripePriceGoldStarter = trimEnv('STRIPE_PRICE_GOLD_STARTER') || null;
  config.stripePriceGoldPopular = trimEnv('STRIPE_PRICE_GOLD_POPULAR') || null;
  config.stripePriceGoldPro = trimEnv('STRIPE_PRICE_GOLD_PRO') || null;
  config.stripePriceGoldMega = trimEnv('STRIPE_PRICE_GOLD_MEGA') || null;
  config.stripePricePremiumMonthly = trimEnv('STRIPE_PRICE_PREMIUM_MONTHLY') || null;
  config.adminSecret = trimEnv('ADMIN_SECRET') || null;
  config.resendApiKey = trimEnv('RESEND_API_KEY') || null;
  config.emailFrom = trimEnv('EMAIL_FROM', config.emailFrom);
  config.clientUrl = trimEnv('CLIENT_URL', 'http://localhost:5173').replace(/\/$/, '');
  config.apiPublicUrl = trimEnv('API_PUBLIC_URL', `http://localhost:${PORT}`).replace(/\/$/, '');
  config.googleClientId = trimEnv('GOOGLE_CLIENT_ID') || null;
  config.googleClientSecret = trimEnv('GOOGLE_CLIENT_SECRET') || null;
  config.discordClientId = trimEnv('DISCORD_CLIENT_ID') || null;
  config.discordClientSecret = trimEnv('DISCORD_CLIENT_SECRET') || null;
  config.stripeTaxEnabled = trimEnv('STRIPE_TAX_ENABLED') === 'true';

  if (config.clientUrl.startsWith('https://') && config.apiPublicUrl.includes('localhost')) {
    console.warn(
      '[config] CLIENT_URL is HTTPS but API_PUBLIC_URL is localhost — OAuth/redirects may fail in production'
    );
  }
}

module.exports = { config, validateConfig, trimEnv };
