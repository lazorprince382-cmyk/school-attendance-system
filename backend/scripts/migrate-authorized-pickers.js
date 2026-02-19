/**
 * One-off migration: create authorized_pickers table if it doesn't exist.
 * Run from backend folder: node scripts/migrate-authorized-pickers.js
 */
require('dotenv').config();
const { query } = require('../src/utils/db');

const SQL = `
-- Authorized pickers (max 3 per child) for gate comparison before release
CREATE TABLE IF NOT EXISTS authorized_pickers (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  photo_url TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (child_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_authorized_pickers_child_id
  ON authorized_pickers (child_id);
`;

async function run() {
  try {
    await query(SQL);
    console.log('Migration complete: authorized_pickers table ready.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

run();
