const { config, validateConfig, hydrateOAuthFromDb } = require('./config');
validateConfig();

const express = require('express');
const cors = require('cors');
const { migrate } = require('./db/migrate');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const checkoutRoutes = require('./routes/checkout');
const entitlementsRoutes = require('./routes/entitlements');
const webhookRoutes = require('./routes/webhook');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const portalRoutes = require('./routes/portal');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');
const walletRoutes = require('./routes/wallet');
const refundsRoutes = require('./routes/refunds');
const invoicesRoutes = require('./routes/invoices');
const oauthRoutes = require('./routes/oauth');
const stripeRoutes = require('./routes/stripe');
const gameRoutes = require('./routes/game');
const policyRoutes = require('./routes/policy');
const { refreshRefundWindowCache } = require('./services/appSettings');

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = new Set([
        config.clientUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]);
      if (process.env.EXTRA_CORS_ORIGINS) {
        process.env.EXTRA_CORS_ORIGINS.split(',').forEach((o) => allowed.add(o.trim()));
      }
      if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        allowed.add(origin);
      }
      if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }
      callback(null, allowed.has(origin));
    },
    credentials: true,
  })
);

app.use('/webhook', webhookRoutes);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, clientUrl: config.clientUrl });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/entitlements', entitlementsRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/refunds', refundsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/policy', policyRoutes);

app.use(errorHandler);

const { ensureDevAdmin } = require('./services/devSeed');

async function start() {
  await migrate();
  await hydrateOAuthFromDb();
  await ensureDevAdmin();
  await refreshRefundWindowCache();
  app.listen(config.port, () => {
    console.log(`API:    http://localhost:${config.port}`);
    console.log(`Client: ${config.clientUrl}`);
    if (config.googleClientId) {
      console.log(`Google OAuth callback: ${config.apiPublicUrl}/api/oauth/google/callback`);
    }
    if (config.discordClientId) {
      console.log(`Discord OAuth callback: ${config.apiPublicUrl}/api/oauth/discord/callback`);
    }
    if (!config.stripeWebhookSecret) {
      console.log(`Webhook test (local): stripe listen --forward-to localhost:${config.port}/webhook`);
    }
    if (config.stripeWebhookSecretLive) {
      console.log(`Webhook live: POST ${config.apiPublicUrl}/webhook/live`);
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
