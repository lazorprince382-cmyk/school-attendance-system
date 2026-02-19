// Reset a teacher's PIN (e.g. for Render when login keeps failing).
// Use Render's External Database URL in .env, then:
//   node scripts/reset-teacher-pin.js
// Default: phone 0756202977, new PIN 5555. Override with env:
//   TEACHER_PHONE=0756202977 NEW_PIN=5555 node scripts/reset-teacher-pin.js

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../src/utils/db');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Use Render External Database URL in .env for production.');
    process.exit(1);
  }
  const phone = process.env.TEACHER_PHONE || '0756202977';
  const newPin = process.env.NEW_PIN || '5555';
  if (!/^\d{4}$/.test(newPin)) {
    console.error('NEW_PIN must be 4 digits.');
    process.exit(1);
  }
  const pinHash = await bcrypt.hash(newPin, 10);
  const { rowCount } = await query(
    'UPDATE teachers SET pin_hash = $1 WHERE phone = $2',
    [pinHash, phone]
  );
  if (rowCount === 0) {
    console.error('No teacher found with phone', phone);
    process.exit(1);
  }
  console.log('PIN updated for', phone, '→ use PIN', newPin, 'to log in.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
