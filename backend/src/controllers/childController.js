const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  createChild,
  bulkCreateChildren,
  listChildren,
  findChildById,
  findChildByQrPayload,
  updateChild,
  deleteChild,
} = require('../models/childModel');
const { getPickersByChildId, createPicker } = require('../models/authorizedPickerModel');

const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed.'), false);
};
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const { getPickersUploadsDir } = require('../utils/uploadsPath');
const pickersUploadsDir = getPickersUploadsDir();

function csvUploadMiddleware() {
  return uploadCsv.single('file');
}

function registerWithPickersUpload() {
  return uploadImages.fields([
    { name: 'photo1', maxCount: 1 },
    { name: 'photo2', maxCount: 1 },
    { name: 'photo3', maxCount: 1 },
  ]);
}

async function importChildrenCsv(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required (field name: file)' });
  }
  const content = req.file.buffer.toString('utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    return res.status(400).json({ error: 'CSV must contain a header and at least one row' });
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const required = ['externalId', 'firstName', 'lastName', 'className', 'guardianPhone'];
  const missing = required.filter((c) => !header.includes(c));
  if (missing.length) {
    return res.status(400).json({ error: `Missing columns: ${missing.join(', ')}` });
  }

  const children = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    if (!row.trim()) continue;
    const cols = row.split(',').map((c) => c.trim());
    const obj = {};
    header.forEach((col, idx) => {
      obj[col] = cols[idx] || '';
    });
    children.push({
      externalId: obj.externalId,
      firstName: obj.firstName,
      lastName: obj.lastName,
      className: obj.className,
      guardianPhone: obj.guardianPhone,
    });
  }

  const imported = await bulkCreateChildren(children);
  return res.json({ success: true, importedCount: imported.length, children: imported });
}

async function getChildren(req, res) {
  const children = await listChildren();
  res.json(children);
}

async function createSingleChild(req, res) {
  const { externalId, firstName, lastName, className, guardianPhone } = req.body || {};

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'firstName and lastName are required' });
  }

  try {
    const child = await createChild({
      externalId: externalId || null,
      firstName,
      lastName,
      className: className || null,
      guardianPhone: guardianPhone || null,
    });
    return res.json({ success: true, child });
  } catch (err) {
    console.error('createSingleChild error', err);
    return res.status(500).json({ error: 'Failed to create child' });
  }
}

function parseFullName(fullName) {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, firstSpace).trim(),
    lastName: trimmed.slice(firstSpace + 1).trim(),
  };
}

async function registerChildWithPickers(req, res) {
  const fullName = (req.body && req.body.fullName) || '';
  const className = (req.body && (req.body.class || req.body.className)) || '';
  const parentPhone = (req.body && (req.body.parentPhone || req.body.guardianPhone)) || '';
  const files = req.files || {};
  const photo1 = files.photo1 && files.photo1[0];
  const photo2 = files.photo2 && files.photo2[0];
  const photo3 = files.photo3 && files.photo3[0];

  if (!fullName.trim()) {
    return res.status(400).json({ error: 'Full name is required' });
  }
  if (!photo1 || !photo2 || !photo3) {
    return res.status(400).json({ error: 'All three holder photos are required' });
  }

  const { firstName, lastName } = parseFullName(fullName);

  try {
    const child = await createChild({
      externalId: null,
      firstName,
      lastName,
      className: className.trim() || null,
      guardianPhone: parentPhone.trim() || null,
    });
    const childId = child.id;

    const photos = [photo1, photo2, photo3];
    for (let i = 0; i < photos.length; i += 1) {
      const file = photos[i];
      const ext = (file.originalname && path.extname(file.originalname)) || '.jpg';
      const nameFromFile = path.basename(file.originalname || '', ext).trim();
      const pickerName = nameFromFile || `Holder ${i + 1}`;
      const basename = `${childId}_${i}${ext}`;
      const filePath = path.join(pickersUploadsDir, basename);
      fs.writeFileSync(filePath, file.buffer);
      const photoUrl = `/uploads/pickers/${basename}`;
      await createPicker({
        childId,
        name: pickerName,
        relationship: null,
        photoUrl,
        sortOrder: i,
      });
    }

    return res.status(201).json({ success: true, child });
  } catch (err) {
    console.error('registerChildWithPickers error', err);
    return res.status(500).json({ error: 'Failed to register child with pickers' });
  }
}

async function getChildByQr(req, res) {
  const { code } = req.query || {};
  if (!code) return res.status(400).json({ error: 'QR code is required' });
  try {
    const child = await findChildByQrPayload(code);
    if (!child) {
      console.log('[by-qr] code=%s → child not in database', String(code).slice(0, 50));
      return res.status(404).json({
        error: 'Child not found for this QR code. Add this child (with 3 holder photos) in Admin Dashboard on this site, then generate and scan the QR here.',
      });
    }
    const pickers = await getPickersByChildId(child.id);
    const norm = (url) => (url && typeof url === 'string' && !url.startsWith('http') && !url.startsWith('/') ? '/' + url : url);
    const authorizedPickers = pickers.map((p, idx) => ({
      id: p.id,
      name: (p.name != null && String(p.name).trim() !== '') ? String(p.name).trim() : `Holder ${idx + 1}`,
      relationship: p.relationship,
      photoUrl: norm(p.photo_url) || p.photo_url,
    }));
    return res.json({
      id: child.id,
      fullName: `${child.first_name} ${child.last_name}`,
      className: child.class_name,
      schoolName: 'The Ocean Of Knowledge School',
      authorizedPickers,
    });
  } catch (err) {
    console.error('[by-qr] lookup failed for code=%s', String(code).slice(0, 50), err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }
}

async function updateChildById(req, res) {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid child id' });
  const child = await findChildById(id);
  if (!child) return res.status(404).json({ error: 'Child not found' });
  const { firstName, lastName, className, guardianPhone } = req.body || {};
  const updates = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (className !== undefined) updates.className = className;
  if (guardianPhone !== undefined) updates.guardianPhone = guardianPhone;
  try {
    const updated = await updateChild(id, updates);
    return res.json(updated);
  } catch (err) {
    console.error('updateChildById error', err);
    return res.status(500).json({ error: err.message || 'Failed to update child' });
  }
}

async function deleteChildById(req, res) {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid child id' });
    const child = await findChildById(id);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    await deleteChild(id);
    return res.status(204).send();
  } catch (err) {
    console.error('deleteChildById error', err);
    return res.status(500).json({ error: err.message || 'Failed to delete child' });
  }
}

module.exports = {
  csvUploadMiddleware,
  registerWithPickersUpload,
  importChildrenCsv,
  getChildren,
  createSingleChild,
  registerChildWithPickers,
  getChildByQr,
  updateChildById,
  deleteChildById,
};

