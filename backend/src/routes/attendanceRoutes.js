const express = require('express');
const {
  recordAttendance,
  getTodayAttendance,
  getAttendanceByDate,
  getAttendanceDates,
  exportAttendanceCsv,
} = require('../controllers/attendanceController');
const { authMiddleware, requireAdmin, requireScanner } = require('../middleware/authMiddleware');

const router = express.Router();

// Scanner-only: record departure
router.post('/', authMiddleware, requireScanner, recordAttendance);

// Admin-only
router.get('/today', authMiddleware, requireAdmin, getTodayAttendance);
router.get('/dates', authMiddleware, requireAdmin, getAttendanceDates);
router.get('/by-date', authMiddleware, requireAdmin, getAttendanceByDate);
router.get('/export', authMiddleware, requireAdmin, exportAttendanceCsv);

module.exports = router;

