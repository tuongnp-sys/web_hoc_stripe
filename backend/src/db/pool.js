const { Pool } = require('pg');
const { config } = require('../config');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl?.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

module.exports = { getPool };
