const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  getPickersByChildId,
  createPicker,
  updatePicker,
  deletePicker,
  findPickerById,
} = require('../models/authorizedPickerModel');
const { findChildById } = require('../models/childModel');

const { getPickersUploadsDir } = require('../utils/uploadsPath');
const uploadsDir = getPickersUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const childId = req.params.id;
    const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
    const sortOrder = req.body.pickerIndex !== undefined ? req.body.pickerIndex : 0;
    cb(null, `${childId}_${sortOrder}${ext}`);
  },
});
const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed.'), false);
};
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

function pickerPhotoUpload() {
  return upload.single('photo');
}

async function getPickers(req, res) {
  const childId = Number(req.params.id);
  if (Number.isNaN(childId)) return res.status(400).json({ error: 'Invalid child id' });
  const child = await findChildById(childId);
  if (!child) return res.status(404).json({ error: 'Child not found' });
  const pickers = await getPickersByChildId(childId);
  const norm = (url) => (url && typeof url === 'string' && !url.startsWith('http') && !url.startsWith('/') ? '/' + url : url);
  const list = pickers.map((p, idx) => ({
    id: p.id,
    name: (p.name != null && String(p.name).trim() !== '') ? String(p.name).trim() : `Holder ${idx + 1}`,
    relationship: p.relationship,
    photoUrl: norm(p.photo_url) || p.photo_url,
    sortOrder: p.sort_order,
  }));
  return res.json(list);
}

async function addPicker(req, res) {
  const childId = Number(req.params.id);
  if (Number.isNaN(childId)) return res.status(400).json({ error: 'Invalid child id' });
  const child = await findChildById(childId);
  if (!child) return res.status(404).json({ error: 'Child not found' });

  const existing = await getPickersByChildId(childId);
  if (existing.length >= 3) {
    return res.status(400).json({ error: 'Maximum 3 authorized pickers per child' });
  }

  let photoUrl = (req.body && req.body.photoUrl) || '';
  if (req.file && req.file.path) {
    const basename = path.basename(req.file.path);
    photoUrl = `/uploads/pickers/${basename}`;
  }
  if (!photoUrl) {
    return res.status(400).json({ error: 'Either photo (file) or photoUrl is required' });
  }

  const name = (req.body && req.body.name) || '';
  const relationship = (req.body && req.body.relationship) || null;
  const sortOrder = req.body.pickerIndex !== undefined ? Number(req.body.pickerIndex) : existing.length;
  if (!name.trim()) return res.status(400).json({ error: 'name is required' });

  const picker = await createPicker({
    childId,
    name: name.trim(),
    relationship: relationship ? relationship.trim() : null,
    photoUrl,
    sortOrder,
  });
  return res.status(201).json({
    id: picker.id,
    name: picker.name,
    relationship: picker.relationship,
    photoUrl: picker.photo_url,
    sortOrder: picker.sort_order,
  });
}

async function updatePickerHandler(req, res) {
  const childId = Number(req.params.id);
  const pickerId = Number(req.params.pickerId);
  if (Number.isNaN(childId) || Number.isNaN(pickerId)) {
    return res.status(400).json({ error: 'Invalid child or picker id' });
  }
  const picker = await findPickerById(pickerId);
  if (!picker || picker.child_id !== childId) {
    return res.status(404).json({ error: 'Picker not found' });
  }
  const { name, relationship, photoUrl } = req.body || {};
  const updates = {};
  if (name !== undefined) {
    const trimmed = (name != null && String(name).trim() !== '') ? String(name).trim() : null;
    updates.name = trimmed || (picker.sort_order != null ? `Holder ${picker.sort_order + 1}` : 'Holder 1');
  }
  if (relationship !== undefined) updates.relationship = relationship;
  if (req.file && req.file.path) {
    updates.photoUrl = `/uploads/pickers/${path.basename(req.file.path)}`;
  } else if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  const updated = await updatePicker(pickerId, updates);
  return res.json({
    id: updated.id,
    name: updated.name,
    relationship: updated.relationship,
    photoUrl: updated.photo_url,
    sortOrder: updated.sort_order,
  });
}

async function removePicker(req, res) {
  const childId = Number(req.params.id);
  const pickerId = Number(req.params.pickerId);
  if (Number.isNaN(childId) || Number.isNaN(pickerId)) {
    return res.status(400).json({ error: 'Invalid child or picker id' });
  }
  const picker = await findPickerById(pickerId);
  if (!picker || picker.child_id !== childId) {
    return res.status(404).json({ error: 'Picker not found' });
  }
  await deletePicker(pickerId);
  return res.status(204).send();
}

module.exports = {
  pickerPhotoUpload,
  getPickers,
  addPicker,
  updatePickerHandler,
  removePicker,
};
