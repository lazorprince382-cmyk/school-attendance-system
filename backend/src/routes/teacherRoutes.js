const express = require('express');
const {
  login,
  getTeachers,
  createTeacherHandler,
  updateTeacherHandler,
  deleteTeacherHandler,
} = require('../controllers/teacherController');
const { authMiddleware, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public login endpoint
router.post('/login', login);

// Admin-only: teacher management
router.get('/', authMiddleware, requireAdmin, getTeachers);
router.post('/', authMiddleware, requireAdmin, createTeacherHandler);
router.put('/:id', authMiddleware, requireAdmin, updateTeacherHandler);
router.delete('/:id', authMiddleware, requireAdmin, deleteTeacherHandler);

module.exports = router;

