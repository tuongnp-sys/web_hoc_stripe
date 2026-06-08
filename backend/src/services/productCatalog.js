const { getPool } = require('../db/pool');
const stripeService = require('./stripe');

const CATALOG_SELECT = `
  product_key, name, mode, enabled, updated_at,
  amount_cents, description, badge, savings, sort_order, price_overridden
`;

async function getCatalogRow(productKey) {
  const { rows } = await getPool().query(
    `SELECT ${CATALOG_SELECT} FROM product_catalog WHERE product_key = $1`,
    [productKey]
  );
  return rows[0] || null;
}

async function getAllCatalogRows() {
  const { rows } = await getPool().query(
    `SELECT ${CATALOG_SELECT} FROM product_catalog ORDER BY sort_order, product_key`
  );
  return rows;
}

function mergeProduct(base, catalogRow) {
  if (!base) return null;

  const defaultAmount = base.amount;
  const amount =
    catalogRow?.amount_cents != null ? catalogRow.amount_cents : defaultAmount;

  const merged = {
    key: base.key,
    name: catalogRow?.name?.trim() || base.name,
    description: catalogRow?.description?.trim() || base.description,
    amount,
    defaultAmount,
    currency: base.currency,
    mode: base.mode,
    gold: base.gold || 0,
    energy: base.energy || 0,
    energyMode: base.energyMode || null,
    category: stripeService.getProductCategory(base),
    badge: catalogRow?.badge?.trim() || base.badge || null,
    savings: catalogRow?.savings?.trim() || base.savings || null,
    interval: base.interval || null,
    entitlement: base.entitlement || null,
    priceOverridden: Boolean(catalogRow?.price_overridden),
    sortOrder: catalogRow?.sort_order ?? 0,
    enabled: catalogRow ? catalogRow.enabled : true,
  };

  merged.displayPrice = stripeService.formatPrice(merged);
  return merged;
}

async function resolveProduct(productKey) {
  const base = stripeService.PRODUCTS[productKey];
  if (!base) return null;
  const catalogRow = await getCatalogRow(productKey);
  return mergeProduct(base, catalogRow);
}

async function resolveAllProducts() {
  const catalogRows = await getAllCatalogRows();
  const catalogByKey = new Map(catalogRows.map((r) => [r.product_key, r]));

  const products = Object.keys(stripeService.PRODUCTS)
    .map((key) => mergeProduct(stripeService.PRODUCTS[key], catalogByKey.get(key)))
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));

  return products;
}

async function isProductEnabled(productKey) {
  const row = await getCatalogRow(productKey);
  if (!row) return true;
  return row.enabled;
}

async function getEnabledKeys() {
  const { rows } = await getPool().query(
    'SELECT product_key FROM product_catalog WHERE enabled = TRUE'
  );
  return new Set(rows.map((r) => r.product_key));
}

module.exports = {
  isProductEnabled,
  getEnabledKeys,
  getCatalogRow,
  getAllCatalogRows,
  resolveProduct,
  resolveAllProducts,
  mergeProduct,
};
