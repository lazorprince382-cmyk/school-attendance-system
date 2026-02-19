const { createAttendance, getDailyLogsForChild, getTodayLogs, getTodayLogsWithNames, getLogsWithNamesByDate, getDatesWithLogs, getAllLogs } = require('../models/attendanceModel');
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

async function getAttendanceByDate(req, res) {
  const dateStr = (req.query && req.query.date) || '';
  if (!DATE_REGEX.test(dateStr)) {
    return res.status(400).json({ error: 'Query parameter date is required and must be YYYY-MM-DD' });
  }
  const { date, records } = await getLogsWithNamesByDate(dateStr);
  res.json({ date, count: records.length, records });
}

async function getAttendanceDates(req, res) {
  const dates = await getDatesWithLogs();
  res.json({ dates });
}

async function exportAttendanceCsv(req, res) {
  const dateStr = (req.query && req.query.date) || '';
  let rows;
  let filename = 'attendance-export.csv';
  if (DATE_REGEX.test(dateStr)) {
    const { records } = await getLogsWithNamesByDate(dateStr);
    rows = records;
    filename = `departures-${dateStr}.csv`;
  } else {
    rows = await getAllLogs();
  }
  const header = 'id,childId,teacherId,pickerId,action,timestamp,date';
  const dataRows = rows.map((r) => {
    const ts = r.timestamp && (typeof r.timestamp.toISOString === 'function') ? r.timestamp.toISOString() : (r.timestamp || '');
    return [r.id, r.child_id, r.teacher_id || '', r.picker_id != null ? r.picker_id : '', r.action, ts, r.date]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });
  const csv = [header, ...dataRows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = {
  recordAttendance,
  getTodayAttendance,
  getAttendanceByDate,
  getAttendanceDates,
  exportAttendanceCsv,
};

