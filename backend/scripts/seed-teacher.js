// Seed an admin-capable teacher so you can log in and use the admin dashboard.
// Run from backend folder:
//   npm run seed:teacher
//
// Or with custom name/phone/PIN (from project root):
//   node school-attendance-system/backend/scripts/seed-teacher.js
//
// Make sure:
// - PostgreSQL is running
// - DATABASE_URL is set in .env
// - database schema and migrations have been applied (teachers.access column exists)

require('dotenv').config();

const {
  createTeacher,
  listTeachers,
} = require('../src/models/teacherModel');

async function main() {
  try {
    const name = process.env.ADMIN_NAME || 'Admin';
    const phone = process.env.ADMIN_PHONE || '0756202977';
    const pin = process.env.ADMIN_PIN || '5555';

    console.log('Seeding admin teacher...');
    const teacher = await createTeacher({
      name,
      phone,
      pin,
      access: 'both',
    });

    console.log('Created teacher (admin + scanner access):');
    console.log({
      id: teacher.id,
      name: teacher.name,
      phone: teacher.phone,
      access: teacher.access || 'both',
    });

    console.log('\nCurrent teachers in DB:');
    const all = await listTeachers();
    console.table(
      all.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        access: t.access || 'both',
        is_active: t.is_active,
      })),
    );

    console.log('\nLog in at /admin/login.html with:');
    console.log(`  Phone: ${phone}`);
    console.log(`  PIN:   ${pin}`);
    console.log('  Choose "Admin Dashboard" to manage teachers and children.');
  } catch (err) {
    if (err.code === '23505') {
      console.error('A teacher with that phone number already exists. Use a different ADMIN_PHONE or update the existing teacher\'s access in the dashboard.');
    } else {
      console.error('Seed failed:', err);
    }
  } finally {
    process.exit(0);
  }
}

main();

