// One-time: create tables in a fresh PostgreSQL (e.g. on Render).
// Run from backend folder: node scripts/init-db.js
// Then run: npm run migrate  and  npm run seed:teacher

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('../src/utils/db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const sqlPath = path.join(__dirname, 'init-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await query(sql);
    console.log('Schema created (tables already exist is OK).');
  } catch (err) {
    console.error('Init failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
