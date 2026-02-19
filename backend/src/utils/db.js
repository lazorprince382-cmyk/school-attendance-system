const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const useSsl =
  connectionString &&
  !connectionString.includes('localhost') &&
  !connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  ssl: useSsl ? { rejectUnauthorized: true } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PG error', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'test') {
    console.log('executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}

module.exports = {
  pool,
  query,
};

