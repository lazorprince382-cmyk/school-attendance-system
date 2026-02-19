const { query } = require('../utils/db');

async function createChild({ externalId, firstName, lastName, className, guardianPhone }) {
  const { rows } = await query(
    `INSERT INTO children (external_id, first_name, last_name, class_name, guardian_phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [externalId, firstName, lastName, className, guardianPhone]
  );
  return rows[0];
}

async function bulkCreateChildren(children) {
  const results = [];
  for (const c of children) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await createChild(c));
  }
  return results;
}

async function listChildren() {
  const { rows } = await query('SELECT * FROM children ORDER BY id ASC', []);
  return rows;
}

async function findChildById(id) {
  const { rows } = await query('SELECT * FROM children WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findChildByQrPayload(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const trimmed = payload.trim();

  // Plain numeric ID (smallest QR, best for camera scan)
  if (/^\d+$/.test(trimmed)) {
    const childId = Number(trimmed);
    if (!Number.isNaN(childId)) return findChildById(childId);
    return null;
  }

  // JSON format: { id, ... }
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed);
      const childId = Number(data.id);
      if (Number.isNaN(childId)) return null;
      return findChildById(childId);
    } catch (e) {
      return null;
    }
  }

  // Legacy format: UGSCHOOL|childId|externalId
  const parts = trimmed.split('|');
  if (parts.length < 2 || parts[0] !== 'UGSCHOOL') return null;
  const childId = Number(parts[1]);
  if (Number.isNaN(childId)) return null;
  return findChildById(childId);
}

async function updateChild(id, { firstName, lastName, className, guardianPhone }) {
  const updates = [];
  const values = [];
  let idx = 1;
  if (firstName !== undefined) {
    updates.push(`first_name = $${idx}`);
    values.push(firstName);
    idx += 1;
  }
  if (lastName !== undefined) {
    updates.push(`last_name = $${idx}`);
    values.push(lastName);
    idx += 1;
  }
  if (className !== undefined) {
    updates.push(`class_name = $${idx}`);
    values.push(className);
    idx += 1;
  }
  if (guardianPhone !== undefined) {
    updates.push(`guardian_phone = $${idx}`);
    values.push(guardianPhone);
    idx += 1;
  }
  if (updates.length === 0) {
    return findChildById(id);
  }
  values.push(id);
  const { rows } = await query(
    `UPDATE children SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0] || null;
}

async function deleteChild(id) {
  await query('DELETE FROM children WHERE id = $1', [id]);
  return true;
}

module.exports = {
  createChild,
  bulkCreateChildren,
  listChildren,
  findChildById,
  findChildByQrPayload,
  updateChild,
  deleteChild,
};

