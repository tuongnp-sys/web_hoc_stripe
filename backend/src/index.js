const { config, validateConfig } = require('./config');
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
app.use('/api/admin', adminRoutes);

app.use(errorHandler);

async function start() {
  await migrate();
  app.listen(config.port, () => {
    console.log(`API:    http://localhost:${config.port}`);
    console.log(`Client: ${config.clientUrl}`);
    if (!config.stripeWebhookSecret) {
      console.log(`Webhook (local): stripe listen --forward-to localhost:${config.port}/webhook`);
    }
  });
}

start().catch((err) => {
  console.error('Không khởi động được server:', err.message);
  process.exit(1);
});
