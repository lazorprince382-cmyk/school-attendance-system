const { query } = require('../utils/db');
const { todayDateString } = require('../utils/timeUtils');

async function createAttendance({ childId, teacherId, pickerId, action, timestamp }) {
  const dateStr = todayDateString();
  const { rows } = await query(
    `INSERT INTO attendance_logs (child_id, teacher_id, picker_id, action, timestamp, date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [childId, teacherId, pickerId ?? null, action, timestamp, dateStr]
  );
  return rows[0];
}

async function getDailyLogsForChild(childId, dateStr) {
  const { rows } = await query(
    'SELECT * FROM attendance_logs WHERE child_id = $1 AND date = $2 ORDER BY timestamp ASC',
    [childId, dateStr]
  );
  return rows;
}

async function getTodayLogs() {
  const dateStr = todayDateString();
  const { rows } = await query(
    'SELECT * FROM attendance_logs WHERE date = $1 ORDER BY timestamp ASC',
    [dateStr]
  );
  return { date: dateStr, records: rows };
}

async function getTodayLogsWithNames() {
  const dateStr = todayDateString();
  const { rows } = await query(
    `SELECT a.id, a.child_id, a.teacher_id, a.picker_id, a.action, a.timestamp, a.date,
            c.first_name AS child_first_name, c.last_name AS child_last_name,
            c.class_name AS child_class_name,
            t.name AS teacher_name,
            p.name AS picker_name
     FROM attendance_logs a
     LEFT JOIN children c ON c.id = a.child_id
     LEFT JOIN teachers t ON t.id = a.teacher_id
     LEFT JOIN authorized_pickers p ON p.id = a.picker_id
     WHERE a.date = $1
     ORDER BY a.timestamp ASC`,
    [dateStr]
  );
  const records = rows.map(mapRowToRecord);
  return { date: dateStr, records };
}

async function getAllLogs() {
  const { rows } = await query(
    'SELECT * FROM attendance_logs ORDER BY date DESC, timestamp DESC',
    []
  );
  return rows;
}

function mapRowToRecord(r) {
  const childClass = (r.child_class_name != null && String(r.child_class_name).trim() !== '')
    ? String(r.child_class_name).trim()
    : '—';
  return {
    id: r.id,
    child_id: r.child_id,
    teacher_id: r.teacher_id,
    picker_id: r.picker_id,
    action: r.action,
    timestamp: r.timestamp,
    date: r.date,
    child_name: [r.child_first_name, r.child_last_name].filter(Boolean).join(' ').trim() || '—',
    teacher_name: r.teacher_name || '—',
    class_name: childClass,
    child_class: childClass,
    picker_name: r.picker_name || '—',
  };
}

async function getLogsWithNamesByDate(dateStr) {
  const { rows } = await query(
    `SELECT a.id, a.child_id, a.teacher_id, a.picker_id, a.action, a.timestamp, a.date,
            c.first_name AS child_first_name, c.last_name AS child_last_name,
            c.class_name AS child_class_name,
            t.name AS teacher_name,
            p.name AS picker_name
     FROM attendance_logs a
     LEFT JOIN children c ON c.id = a.child_id
     LEFT JOIN teachers t ON t.id = a.teacher_id
     LEFT JOIN authorized_pickers p ON p.id = a.picker_id
     WHERE a.date = $1
     ORDER BY a.timestamp ASC`,
    [dateStr]
  );
  const records = rows.map(mapRowToRecord);
  return { date: dateStr, records };
}

function toDateOnly(val) {
  if (val == null) return null;
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : val;
  }
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
}

async function getDatesWithLogs() {
  const { rows } = await query(
    'SELECT DISTINCT date FROM attendance_logs ORDER BY date DESC',
    []
  );
  return rows.map((r) => toDateOnly(r.date)).filter(Boolean);
}

module.exports = {
  createAttendance,
  getDailyLogsForChild,
  getTodayLogs,
  getTodayLogsWithNames,
  getLogsWithNamesByDate,
  getDatesWithLogs,
  getAllLogs,
};

