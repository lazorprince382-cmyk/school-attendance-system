/**
 * Generate self-signed HTTPS certificate for local/LAN access.
 * Run once: node scripts/generate-cert.js
 * Creates backend/cert/key.pem and backend/cert/cert.pem
 */
const fs = require('fs');
const path = require('path');

const certDir = path.join(__dirname, '..', 'cert');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

function main() {
  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch (e) {
    console.error('Run: npm install selfsigned --save-dev');
    process.exit(1);
  }

  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const attrs = [{ name: 'commonName', value: 'The Ocean Of Knowledge School' }];
  const options = {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
  };

  const pems = selfsigned.generate(attrs, options);

  fs.writeFileSync(keyPath, pems.private, 'utf8');
  fs.writeFileSync(certPath, pems.cert, 'utf8');

  console.log('Certificate generated:');
  console.log('  ', certPath);
  console.log('  ', keyPath);
  console.log('\nStart the server with: node server.js');
  console.log('Then open https://<this-pc-ip>:4000/teacher/ (accept the browser security warning for camera).');
}

main();
