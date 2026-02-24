// Run migrations so the DB has required columns.
// Usage (from backend folder): node scripts/run-migration.js
// Or: npm run migrate

require('dotenv').config();

const { query } = require('../src/utils/db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Check your .env file.');
    process.exit(1);
  }
  try {
    await query(`
      ALTER TABLE teachers
      ADD COLUMN IF NOT EXISTS access TEXT NOT NULL DEFAULT 'both'
    `);
    console.log('Migration: teachers.access column is ready.');

    await query(`
      ALTER TABLE attendance_logs
      ADD COLUMN IF NOT EXISTS picker_id INTEGER REFERENCES authorized_pickers(id) ON DELETE SET NULL
    `);
    console.log('Migration: attendance_logs.picker_id column is ready.');

    await query(`
      ALTER TABLE children
      ADD COLUMN IF NOT EXISTS qr_hidden BOOLEAN NOT NULL DEFAULT false
    `);
    console.log('Migration: children.qr_hidden column is ready.');

    console.log('All migrations completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
