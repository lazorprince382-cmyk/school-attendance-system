const bcrypt = require('bcryptjs');
const { query } = require('../utils/db');

async function findTeacherById(id) {
  const { rows } = await query('SELECT * FROM teachers WHERE id = $1 AND is_active = true', [id]);
  return rows[0] || null;
}

async function findTeacherByPhone(phone) {
  const { rows } = await query('SELECT * FROM teachers WHERE phone = $1 AND is_active = true', [
    phone,
  ]);
  return rows[0] || null;
}

async function listTeachers() {
  const { rows } = await query('SELECT * FROM teachers ORDER BY id ASC', []);
  return rows;
}

async function createTeacher({ name, phone, pin, access }) {
  const pinHash = await bcrypt.hash(pin, 10);
  const accessVal = access === 'scanner' || access === 'admin' ? access : 'both';
  const { rows } = await query(
    `INSERT INTO teachers (name, phone, pin_hash, is_active, access)
     VALUES ($1, $2, $3, true, $4)
     RETURNING *`,
    [name, phone, pinHash, accessVal]
  );
  return rows[0];
}

async function updateTeacher(id, fields) {
  const allowed = ['name', 'phone', 'is_active', 'access'];
  const set = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      const val = key === 'access' && !['scanner', 'admin', 'both'].includes(fields[key])
        ? 'both'
        : fields[key];
      set.push(`${key} = $${idx}`);
      values.push(val);
      idx += 1;
    }
  }
  if (!set.length) return findTeacherById(id);
  values.push(id);
  const { rows } = await query(
    `UPDATE teachers SET ${set.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteTeacher(id) {
  await query('DELETE FROM teachers WHERE id = $1', [id]);
  return true;
}

module.exports = {
  findTeacherById,
  findTeacherByPhone,
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
};

