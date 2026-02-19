#!/usr/bin/env bash

set -euo pipefail

# Simple deploy script for Ubuntu server.
# Assumes:
# - App directory: /var/www/school-attendance-system
# - Node + pm2 already installed

APP_DIR="/var/www/school-attendance-system"

echo "Deploying to ${APP_DIR}..."

mkdir -p "${APP_DIR}"

rsync -av --delete ./ "${APP_DIR}/"

cd "${APP_DIR}/backend"

npm install --production

if pm2 describe school-attendance-backend > /dev/null 2>&1; then
  pm2 restart school-attendance-backend
else
  pm2 start server.js --name school-attendance-backend
fi

pm2 save

echo "Deployment complete."

