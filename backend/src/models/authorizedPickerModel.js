const { query } = require('../utils/db');

async function getPickersByChildId(childId) {
  const { rows } = await query(
    'SELECT * FROM authorized_pickers WHERE child_id = $1 ORDER BY sort_order ASC LIMIT 3',
    [childId]
  );
  return rows;
}

async function createPicker({ childId, name, relationship, photoUrl, sortOrder }) {
  const { rows } = await query(
    `INSERT INTO authorized_pickers (child_id, name, relationship, photo_url, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [childId, name, relationship || null, photoUrl, sortOrder ?? 0]
  );
  return rows[0];
}

async function updatePicker(id, { name, relationship, photoUrl }) {
  const updates = [];
  const values = [];
  let idx = 1;
  if (name !== undefined) {
    updates.push(`name = $${idx}`);
    values.push(name);
    idx += 1;
  }
  if (relationship !== undefined) {
    updates.push(`relationship = $${idx}`);
    values.push(relationship);
    idx += 1;
  }
  if (photoUrl !== undefined) {
    updates.push(`photo_url = $${idx}`);
    values.push(photoUrl);
    idx += 1;
  }
  if (updates.length === 0) {
    const { rows } = await query('SELECT * FROM authorized_pickers WHERE id = $1', [id]);
    return rows[0] || null;
  }
  values.push(id);
  const { rows } = await query(
    `UPDATE authorized_pickers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deletePicker(id) {
  await query('DELETE FROM authorized_pickers WHERE id = $1', [id]);
  return true;
}

async function findPickerById(id) {
  const { rows } = await query('SELECT * FROM authorized_pickers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function deletePickersByChildId(childId) {
  await query('DELETE FROM authorized_pickers WHERE child_id = $1', [childId]);
  return true;
}

module.exports = {
  getPickersByChildId,
  createPicker,
  updatePicker,
  deletePicker,
  findPickerById,
  deletePickersByChildId,
};
