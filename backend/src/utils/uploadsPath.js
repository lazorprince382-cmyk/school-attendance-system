const path = require('path');
const fs = require('fs');

/**
 * Directory for picker photos. Use UPLOADS_DIR on Render to point to a
 * Persistent Disk so uploads survive redeploys (e.g. /opt/render/project/data/uploads/pickers).
 */
function getPickersUploadsDir() {
  const dir =
    process.env.UPLOADS_DIR ||
    path.join(__dirname, '..', '..', 'public', 'uploads', 'pickers');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

module.exports = { getPickersUploadsDir };
