const { getPool } = require('../db/pool');

async function isProductEnabled(productKey) {
  const { rows } = await getPool().query(
    'SELECT enabled FROM product_catalog WHERE product_key = $1',
    [productKey]
  );
  if (!rows[0]) return true;
  return rows[0].enabled;
}

async function getEnabledKeys() {
  const { rows } = await getPool().query(
    'SELECT product_key FROM product_catalog WHERE enabled = TRUE'
  );
  return new Set(rows.map((r) => r.product_key));
}

module.exports = { isProductEnabled, getEnabledKeys };
