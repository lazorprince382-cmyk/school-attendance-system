const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
  findTeacherByPhone,
  listTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} = require('../models/teacherModel');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// Teacher / admin login with phone + 4-digit PIN
async function login(req, res, next) {
  try {
    const { phone, pin } = req.body || {};
    if (!phone || !pin) {
      return res.status(400).json({ error: 'phone and pin are required' });
    }
    if (!/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be a 4-digit string' });
    }

    let teacher;
    try {
      teacher = await findTeacherByPhone(phone);
    } catch (err) {
      // If database is not reachable (e.g. Postgres not running),
      // surface a clear error instead of crashing the app.
      if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
          error: 'Database is not reachable. Please start PostgreSQL or update DATABASE_URL.',
        });
      }
      throw err;
    }

    if (!teacher) {
      return res.status(401).json({ error: 'Invalid phone or PIN' });
    }

    const matches = await bcrypt.compare(pin, teacher.pin_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid phone or PIN' });
    }

    const access = teacher.access === 'scanner' || teacher.access === 'admin' ? teacher.access : 'both';
    const payload = {
      id: teacher.id,
      name: teacher.name,
      role: 'TEACHER',
      access,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.json({
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        phone: teacher.phone,
        access,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// Admin list teachers
async function getTeachers(req, res) {
  const teachers = await listTeachers();
  res.json(teachers);
}

// Admin create teacher
async function createTeacherHandler(req, res) {
  const { name, phone, pin, access } = req.body || {};
  if (!name || !phone || !pin) {
    return res.status(400).json({ error: 'name, phone, and pin are required' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be a 4-digit string' });
  }
  try {
    const teacher = await createTeacher({ name, phone, pin, access });
    return res.json({ success: true, teacher });
  } catch (err) {
    console.error('createTeacherHandler error', err);
    return res.status(500).json({ error: 'Failed to create teacher' });
  }
}

// Admin update teacher
async function updateTeacherHandler(req, res) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid teacher id' });
  }
  const updated = await updateTeacher(id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Teacher not found' });
  return res.json({ success: true, teacher: updated });
}

// Admin delete teacher
async function deleteTeacherHandler(req, res) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid teacher id' });
  }
  await deleteTeacher(id);
  return res.json({ success: true });
}

module.exports = {
  login,
  getTeachers,
  createTeacherHandler,
  updateTeacherHandler,
  deleteTeacherHandler,
};

