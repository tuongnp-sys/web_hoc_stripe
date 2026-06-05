require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Thiếu biến môi trường: ${name}`);
    process.exit(1);
  }
  return value;
}

const config = {
  port: PORT,
  clientUrl: CLIENT_URL,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || null,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || null,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  stripePriceGameUnlock: process.env.STRIPE_PRICE_GAME_UNLOCK || null,
  stripePricePremiumMonthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || null,
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminSecret: process.env.ADMIN_SECRET || null,
};

function validateConfig() {
  requireEnv('STRIPE_SECRET_KEY');
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL — tạo DB trên Neon: docs/NEON_SETUP.md');
    process.exit(1);
  }
  requireEnv('JWT_SECRET');
  config.stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  config.databaseUrl = process.env.DATABASE_URL.trim();
  config.jwtSecret = process.env.JWT_SECRET;
  config.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
  config.stripePriceGameUnlock = process.env.STRIPE_PRICE_GAME_UNLOCK || null;
  config.stripePricePremiumMonthly = process.env.STRIPE_PRICE_PREMIUM_MONTHLY || null;
  config.adminSecret = process.env.ADMIN_SECRET || null;
}

module.exports = { config, validateConfig };
