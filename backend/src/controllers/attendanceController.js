const { createAttendance, getDailyLogsForChild, getTodayLogs, getTodayLogsWithNames, getLogsWithNamesByDate, getDatesWithLogs, getAllLogs, getAllLogsWithNames, deleteLogsByDate } = require('../models/attendanceModel');
const { getPickersByChildId } = require('../models/authorizedPickerModel');
const { isValidScanTime, todayDateString } = require('../utils/timeUtils');

async function recordAttendance(req, res) {
  const { childId, action, timestamp, emergency, pickerId } = req.body || {};

  if (!childId || !action) {
    return res.status(400).json({ error: 'childId and action are required' });
  }
  if (action !== 'OUT') {
    return res.status(400).json({ error: 'Only departure (OUT) is allowed. Check-in is disabled.' });
  }
  const isEmergency = emergency === true || emergency === 'true';
  if (!isEmergency && !isValidScanTime('OUT')) {
    return res.status(400).json({
      error: 'Departure allowed only between 14:00–18:00.',
    });
  }

  const numericChildId = Number(childId);
  if (Number.isNaN(numericChildId)) {
    return res.status(400).json({ error: 'childId must be a number' });
  }

  const dateStr = todayDateString();
  const logs = await getDailyLogsForChild(numericChildId, dateStr);
  if (logs.length >= 2) {
    return res.status(429).json({
      error: 'Daily attendance limit reached for this child (max 2 scans).',
    });
  }

  let validPickerId = null;
  if (pickerId != null && pickerId !== '') {
    const numericPickerId = Number(pickerId);
    if (Number.isNaN(numericPickerId)) {
      return res.status(400).json({ error: 'pickerId must be a number' });
    }
    const pickers = await getPickersByChildId(numericChildId);
    const found = pickers.some((p) => p.id === numericPickerId);
    if (!found) {
      return res.status(400).json({ error: 'pickerId must be an authorized picker for this child' });
    }
    validPickerId = numericPickerId;
  }

  const nowIso = new Date().toISOString();
  const record = await createAttendance({
    childId: numericChildId,
    teacherId: req.user && req.user.id,
    pickerId: validPickerId,
    action: 'OUT',
    timestamp: timestamp || nowIso,
  });

  return res.json({ success: true, attendance: record });
}

async function getTodayAttendance(req, res) {
  const { date, records } = await getTodayLogsWithNames();
  res.json({ date, count: records.length, records });
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateParam(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (DATE_REGEX.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function getAttendanceByDate(req, res) {
  const raw = (req.query && req.query.date) || '';
  const dateStr = normalizeDateParam(raw);
  if (!dateStr) {
    return res.status(400).json({ error: 'Query parameter date is required and must be YYYY-MM-DD (or ISO date string)' });
  }
  const { date, records } = await getLogsWithNamesByDate(dateStr);
  res.json({ date, count: records.length, records });
}

async function getAttendanceDates(req, res) {
  const dates = await getDatesWithLogs();
  res.json({ dates });
}

function formatTimestampForCsv(ts) {
  if (ts == null) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${h}:${min}:${s}`;
}

async function exportAttendanceCsv(req, res) {
  const raw = (req.query && req.query.date) || '';
  const dateStr = normalizeDateParam(raw) || raw.trim() || null;
  let records;
  let filename = 'attendance-export.csv';
  if (dateStr) {
    const result = await getLogsWithNamesByDate(dateStr);
    records = result.records;
    filename = `departures-${dateStr}.csv`;
  } else {
    records = await getAllLogsWithNames();
  }
  const header = 'ID,Child,Class,Teacher,Holder who picked,Action,Time';
  const dataRows = records.map((r) => {
    const childName = (r.child_name != null && String(r.child_name).trim() !== '') ? r.child_name : (r.child_id != null ? String(r.child_id) : '—');
    const className = (r.class_name != null && String(r.class_name).trim() !== '') ? r.class_name : (r.child_class != null && String(r.child_class).trim() !== '') ? r.child_class : '—';
    const teacherName = (r.teacher_name != null && String(r.teacher_name).trim() !== '') ? r.teacher_name : '—';
    const pickerName = (r.picker_name != null && String(r.picker_name).trim() !== '') ? r.picker_name : '—';
    const timeStr = formatTimestampForCsv(r.timestamp);
    return [r.id, childName, className, teacherName, pickerName, r.action || 'OUT', timeStr]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [header, ...dataRows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

async function deleteAttendanceByDate(req, res) {
  const raw = (req.query && req.query.date) || '';
  const dateStr = normalizeDateParam(raw);
  if (!dateStr) {
    return res.status(400).json({ error: 'Query parameter date is required and must be YYYY-MM-DD (or ISO date string)' });
  }
  const deleted = await deleteLogsByDate(dateStr);
  return res.json({ success: true, deleted });
}

module.exports = {
  recordAttendance,
  getTodayAttendance,
  getAttendanceByDate,
  getAttendanceDates,
  exportAttendanceCsv,
  deleteAttendanceByDate,
};

