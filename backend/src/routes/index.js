const express = require('express');

const teacherRoutes = require('./teacherRoutes');
const childRoutes = require('./childRoutes');
const attendanceRoutes = require('./attendanceRoutes');

const router = express.Router();

router.use('/teachers', teacherRoutes);
router.use('/children', childRoutes);
router.use('/attendance', attendanceRoutes);

module.exports = router;

