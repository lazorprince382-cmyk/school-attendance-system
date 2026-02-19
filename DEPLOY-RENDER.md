# Deploy on Render

Use this guide to host the School Attendance app on [Render](https://render.com). Your code stays on GitHub; Render builds and runs the backend and gives you a URL. You can add a custom domain later.

**Prerequisite:** Your project is already on GitHub (e.g. `lazorprince382-cmyk/school-attendance-system`). If not, push it first (see DEPLOY-RAILWAY.md Part A, or you’ve already done this for Railway).

---

## 1. Sign in to Render

- Go to [render.com](https://render.com).
- Click **Get Started** and sign in with **GitHub**.

---

## 2. Create a PostgreSQL database

1. In the Render dashboard, click **New +** → **PostgreSQL**.
2. Choose a name (e.g. `school-attendance-db`), region, and plan (Free or paid).
3. Click **Create Database**.
4. When it’s ready, open the database. In **Connections**, copy the **Internal Database URL** (you’ll use it as `DATABASE_URL` for the app).

---

## 3. Create a Web Service (backend)

1. Click **New +** → **Web Service**.
2. Connect your **GitHub** account if needed, then select the repo **school-attendance-system**.
3. Configure the service:

| Field | Value |
|--------|--------|
| **Name** | `school-attendance-system` (or any name) |
| **Region** | Same as your database (e.g. Oregon) |
| **Branch** | `main` |
| **Root Directory** | **`backend`** ← Important: type `backend` so Render builds from the backend folder. |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` or `node server.js` |

4. Under **Instance Type**, pick **Free** (or a paid plan for always-on).

---

## 4. Add environment variables

In the same Web Service form, open **Environment** (or **Environment Variables**) and add:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Paste the **Internal Database URL** from your Render Postgres (step 2). |
| `JWT_SECRET` | A long random string (at least 16 characters). Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | `12h` |

Do **not** set `PORT`; Render sets it. Leave `CORS_ORIGIN` for after the first deploy (step 6).

Click **Create Web Service**. Render will build and deploy.

---

## 5. Get the app URL and set CORS

1. When the deploy finishes, Render shows a URL like `https://school-attendance-system.onrender.com`.
2. Open the service → **Environment** and add:
   - **Key:** `CORS_ORIGIN`  
   - **Value:** Your app URL (e.g. `https://school-attendance-system.onrender.com`).  
   Save. Render will redeploy.

---

## 6. Set up the database (once)

The app needs tables and at least one teacher to log in. In Render’s **Shell** run these **once**, in order:

1. Open your **Web Service** → **Shell** (left sidebar).
2. Create tables (fresh database only):
   ```bash
   node scripts/init-db.js
   ```
   You should see “Schema created”.
3. Run migrations (adds any extra columns):
   ```bash
   npm run migrate
   ```
   You should see “All migrations completed.”
4. Create an admin teacher so you can log in:
   ```bash
   npm run seed:teacher
   ```
   Default login: **Phone** `0756202977`, **PIN** `5555`. To use your own, set env vars **ADMIN_PHONE** and **ADMIN_PIN** in Render → Environment, then run `npm run seed:teacher` again (use a new phone if one already exists).

---

## 7. Teacher scanner: child + three photos

When you scan a QR in the **deployed** teacher scanner, the child and three holder photos must come from **this app’s** database and server. If nothing useful appears:

1. **Use this site for both admin and teacher**  
   The scanner looks up the child **in this app’s database** by the ID inside the QR. If you have not added any children on the deployed site, the **children** table is empty, so every scan returns “Child not found.”  
   **Fix:** Open the **deployed** Admin Dashboard → **Children & QR** → register at least one child (full name, class, parent phone, **three holder photos**) → click **Generate QRs** → then open the **deployed** Teacher Scanner and scan that QR (or download the QR image and use “Scan from file”). Do not use a QR generated on localhost—that ID exists only in your local DB.

2. **Photos disappear after a redeploy**  
   On Render, the app’s filesystem is ephemeral: uploads are lost on each deploy. So after a redeploy, holder photos may show as broken until you re-add them or use persistent storage.

3. **Optional: keep photos across redeploys**  
   Add a [Render Persistent Disk](https://render.com/docs/disks) and set the env var **`UPLOADS_DIR`** to the path where the disk is mounted (e.g. `/opt/render/project/data/uploads/pickers`). Then uploads are stored on the disk and the three photos will still load after redeploys.

---

## 8. Open the app

Visit your Render URL (e.g. `https://school-attendance-system.onrender.com`). You should see the health check or the teacher/admin pages (e.g. `/teacher`, `/admin`).

---

## 9. (Later) Add a custom domain

- In the Web Service, go to **Settings** → **Custom Domains**.
- Add your domain and follow Render’s DNS instructions.
- In **Environment**, update **`CORS_ORIGIN`** to include your domain (e.g. `https://yourschool.com` or comma-separated with the Render URL).

---

## Quick checklist

- [ ] PostgreSQL created; Internal Database URL copied.
- [ ] Web Service created from GitHub repo **school-attendance-system**.
- [ ] **Root Directory** = **`backend`**.
- [ ] Build: `npm install`, Start: `npm start` (or `node server.js`).
- [ ] Env: `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`; then `CORS_ORIGIN` = your Render URL.
- [ ] Migrations run in Shell: `npm run migrate`.
- [ ] App opens at the Render URL.

If the build fails, check **Logs** for the service. The most common fix is ensuring **Root Directory** is set to **`backend`**.
