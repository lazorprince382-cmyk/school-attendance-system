const express = require('express');
const {
  csvUploadMiddleware,
  registerWithPickersUpload,
  importChildrenCsv,
  getChildren,
  createSingleChild,
  registerChildWithPickers,
  getChildByQr,
  updateChildById,
  deleteChildById,
  updateChildQrHidden,
} = require('../controllers/childController');
const {
  pickerPhotoUpload,
  getPickers,
  addPicker,
  updatePickerHandler,
  removePicker,
} = require('../controllers/pickerController');
const { authMiddleware, requireAdmin, requireScanner } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin-only
router.post('/import', authMiddleware, requireAdmin, csvUploadMiddleware(), importChildrenCsv);
router.get('/', authMiddleware, requireAdmin, getChildren);
router.post('/', authMiddleware, requireAdmin, createSingleChild);
router.put('/:id', authMiddleware, requireAdmin, updateChildById);
router.patch('/:id/qr-hidden', authMiddleware, requireAdmin, updateChildQrHidden);
router.delete('/:id', authMiddleware, requireAdmin, deleteChildById);
router.post('/register-with-pickers', authMiddleware, requireAdmin, registerWithPickersUpload(), registerChildWithPickers);

// Scanner-only (teacher portal: lookup by QR)
router.get('/by-qr', authMiddleware, requireScanner, getChildByQr);

// Admin-only: authorized pickers
router.get('/:id/pickers', authMiddleware, requireAdmin, getPickers);
router.post('/:id/pickers', authMiddleware, requireAdmin, pickerPhotoUpload(), addPicker);
router.put('/:id/pickers/:pickerId', authMiddleware, requireAdmin, pickerPhotoUpload(), updatePickerHandler);
router.delete('/:id/pickers/:pickerId', authMiddleware, requireAdmin, removePicker);

module.exports = router;

