# School Attendance System

Backend and frontends for a school attendance system (QR scan, departures, authorized pickers, admin and teacher dashboards).

## Requirements

- Node.js (LTS)
- PostgreSQL

## Environment variables

Copy `backend/.env.example` to `backend/.env` and set values.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default `4000`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g. `postgres://user:password@localhost:5432/attendance_db`) |
| `JWT_SECRET` | Yes in production | Secret for JWT; must be at least 16 characters. Omit or weak value in production will cause the server to exit at startup. |
| `JWT_EXPIRES_IN` | No | Token expiry (e.g. `12h`) |
| `NODE_ENV` | No | `development` or `production`; affects CORS, error responses, and JWT enforcement |
| `HOST` | No | Bind address (default `0.0.0.0`) |
| `SSL_KEY_PATH` | No | Path to TLS key (optional HTTPS) |
| `SSL_CERT_PATH` | No | Path to TLS certificate (optional HTTPS) |
| `CORS_ORIGIN` | Yes in production | Comma-separated allowed origins (e.g. `https://admin.school.example.com`) |

## Database migrations

From the `backend` directory:

```bash
npm run migrate
```

Run after cloning and whenever new migration files are added.

## Deploy on Railway

For step-by-step hosting on Railway (account, Postgres, env vars, migrations, custom domain), see **[DEPLOY-RAILWAY.md](DEPLOY-RAILWAY.md)**.

## Running the app

From the `backend` directory:

- **Development:** `npm run dev` (nodemon, auto-restart)
- **Production:** `npm start` (sets `NODE_ENV=production` and runs `node server.js`)

For a single server you can run with `node server.js` directly. For process management and restarts on crash, use PM2 (see below).

## Process manager (PM2)

To run the backend under PM2 for restarts and logs:

```bash
cd backend
npm install -g pm2
pm2 start server.js --name school-attendance
pm2 save
pm2 startup   # optional: start on boot
```

Use `pm2 logs school-attendance` and `pm2 restart school-attendance` as needed. You can add an `ecosystem.config.js` for more options.

## Backups

Back up PostgreSQL regularly. Example with `pg_dump`:

```bash
pg_dump -U your_user -d attendance_db -F c -f backup_$(date +%Y%m%d).dump
```

Restore with:

```bash
pg_restore -U your_user -d attendance_db -c backup_YYYYMMDD.dump
```

Recommendation: run a daily backup (e.g. via cron or Task Scheduler) and keep at least 7–30 days. Store backups off the application server.

## Project layout

- `backend/` – Express API, migrations, static frontends
- `backend/server.js` – Entry point
- `backend/scripts/run-migration.js` – Runs SQL files from `database/migrations/`
- `backend/public/uploads/pickers/` – Uploaded picker photos
