// Set an existing teacher's access to 'both' (admin + scanner) by phone.
// Run from backend folder:
//   node scripts/set-teacher-admin.js
//   node scripts/set-teacher-admin.js 0756202977
//
// Or with env: TEACHER_PHONE=0756202977 node scripts/set-teacher-admin.js

require('dotenv').config();

const { query } = require('../src/utils/db');

async function main() {
  const phone = process.argv[2] || process.env.TEACHER_PHONE;
  if (!phone) {
    console.error('Usage: node scripts/set-teacher-admin.js <phone>');
    console.error('Example: node scripts/set-teacher-admin.js 0756202977');
    process.exit(1);
  }

  try {
    const { rowCount, rows } = await query(
      `UPDATE teachers SET access = 'both' WHERE phone = $1 RETURNING id, name, phone, access`,
      [phone.trim()]
    );
    if (rowCount === 0) {
      console.error('No teacher found with phone:', phone);
      process.exit(1);
    }
    console.log('Updated to admin + scanner access:', rows[0]);
    console.log('They must log out and log in again for the change to take effect.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
