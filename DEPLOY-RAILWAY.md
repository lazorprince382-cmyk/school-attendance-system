# Deploy on Railway

**Order of operations:** You first put your project on a **GitHub repo**, then sign in to **Railway with GitHub** and connect Railway to that repo. Railway will build and run your app from GitHub. You’ll get a free URL from Railway; when you buy a domain, you add it in Railway.

---

# Part A — Put the project on GitHub first

## 1. Create a new repo on GitHub

- Go to [github.com](https://github.com) and sign in.
- Click **“+”** → **“New repository”**.
- Choose a name (e.g. `school-attendance-system` or `web-app`), set it to **Public**, leave “Add a README” unchecked if you already have code.
- Click **“Create repository”**.

## 2. Push your project to that repo

On your machine, open a terminal and run these from the folder that contains your app. Use your real GitHub username and repo name.

**If your repo will contain only the app** (so the repo root has `backend/`, `frontend/`, etc.):

```bash
cd c:\Users\DELL\Desktop\prince\school-attendance-system
git init
git add .
git status
```
Check that `backend/.env` does **not** appear (it must be in `.gitignore`). If it appears, do **not** add it; remove it from staging and ensure `.gitignore` has `.env`.

```bash
git commit -m "Initial commit - School Attendance System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username (e.g. `Lazor256`) and `YOUR_REPO_NAME` with the repo you just created (e.g. `school-attendance-system` or `web-app`).

**If your repo will contain the whole workspace** (e.g. a `prince` folder with `school-attendance-system` inside):

```bash
cd c:\Users\DELL\Desktop\prince
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

When this is done, your project lives on GitHub and Railway will use this repo next.

---

# Part B — Railway: sign in with GitHub and deploy from that repo

## 3. Sign in to Railway with GitHub

- Go to [railway.app](https://railway.app).
- Click **“Login”** and choose **“Login with GitHub”**.
- Authorize Railway when GitHub asks. You’re not “deploying to GitHub”—GitHub is only where your code lives; Railway will read from it and run the app.

## 4. Create a project and connect your GitHub repo

1. In Railway, click **“New Project”**.
2. Choose **“Deploy from GitHub repo”**.
3. Select your **GitHub account** and the **repository** you pushed in Part A (e.g. `school-attendance-system` or `web-app`).
4. Railway creates a **service** from that repo and starts a build. You’ll configure it in the next steps.

## 5. Add PostgreSQL

1. In the **same project**, click **“New”** → **“Database”** → **“PostgreSQL”**.
2. Wait until the database is ready. You’ll use its `DATABASE_URL` for the app in the next step.

## 6. Configure the app service (Root Directory and variables)

**You must set Root Directory.** The app code lives in the `backend` folder; Railway must build from that folder. If you don’t set it, you’ll see “Error creating build plan with Railpack” or “can’t cd to backend”.

1. Click the **app service** (the one from your repo, not the Postgres service).
2. Open **Settings** (gear icon or “Settings” tab).
3. In the **right sidebar** click **Source** (the first item). On the Source page, find **Root Directory** and set it to:
   - If the **repo root** is the app folder (you pushed from `school-attendance-system`): set **`backend`** (no leading slash).
   - If the **repo root** is the workspace (you pushed from `prince`): set **`school-attendance-system/backend`**.
   Save if needed, then trigger a new deploy (e.g. **Deploy** or **Apply changes**).
4. Open **Variables** and add:

| Variable         | Value |
|------------------|--------|
| `NODE_ENV`       | `production` |
| `DATABASE_URL`   | Click **“Add reference”** / **“Variable reference”** and select the **Postgres** service’s **`DATABASE_URL`**. |
| `JWT_SECRET`     | A long random string (at least 16 characters). Example: run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste the output. |
| `JWT_EXPIRES_IN` | `12h` |

Do **not** set `PORT` (Railway sets it). Leave `CORS_ORIGIN` for after you have the app URL (step 7).

5. Save. Railway will redeploy with these variables.

## 7. Get the app URL and set CORS

1. In the **same app service**, go to **Settings** → **Networking** (or **Generate domain**).
2. Click **“Generate domain”**. Copy the URL (e.g. `https://something.up.railway.app`).
3. In **Variables**, add **`CORS_ORIGIN`** with that URL (e.g. `https://something.up.railway.app`). Save so the app accepts requests from that origin.
4. Open the URL in your browser; you should see the app (e.g. health check or teacher/admin pages).

## 8. Run database migrations (once)

The app needs the DB schema. Run migrations once using Railway’s CLI (so they use the same `DATABASE_URL` as the app):

1. Install the CLI: [railway.app/docs/develop/cli](https://docs.railway.app/develop/cli) (e.g. `npm i -g @railway/cli`).
2. In a terminal:

```bash
cd c:\Users\DELL\Desktop\prince\school-attendance-system\backend
railway login
railway link
```

Choose the **project** and the **app (backend) service**, not the Postgres service.

3. Run migrations:

```bash
railway run npm run migrate
```

You should see something like “All migrations completed.” After that, the app and DB are in sync.

---

# Part C — (Later) Add your own domain

When you buy a domain from any registrar:

- In Railway: **app service** → **Settings** → **Networking** / **Domains** → **Custom domain** → add your domain (e.g. `app.yourschool.com`). Railway will show the **CNAME** (or A) record.
- At the **registrar**, add that record. After DNS propagates, Railway will provide HTTPS.
- In **Variables**, update **`CORS_ORIGIN`** to include `https://your-domain.com` (comma-separated if you keep the Railway URL).

---

# Quick checklist

**Part A — GitHub**  
- [ ] New repo created on GitHub  
- [ ] Project pushed from your machine (`git push`)  
- [ ] `backend/.env` not in the repo  

**Part B — Railway**  
- [ ] Logged in to Railway with GitHub  
- [ ] New project → Deploy from GitHub repo → your repo selected  
- [ ] PostgreSQL added to the project  
- [ ] App service: Root Directory set (`backend` or `school-attendance-system/backend`)  
- [ ] Variables: `NODE_ENV`, `DATABASE_URL` (reference), `JWT_SECRET`, `JWT_EXPIRES_IN`, then `CORS_ORIGIN` (Railway URL)  
- [ ] Domain generated; app opens in browser  
- [ ] Migrations run: `railway run npm run migrate`  

**Part C — When you have a domain**  
- [ ] Custom domain added in Railway and DNS set at registrar  
- [ ] `CORS_ORIGIN` updated to include the new domain  

If a step fails, check the **Deploy logs** and **Service logs** for that service in the Railway dashboard.

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| **“Error creating build plan with Railpack”**, **“Railpack could not determine how to build”**, or **“can’t cd to backend”** | You must set **Root Directory** so the build runs from the `backend` folder. In the app service go to **Settings** → **Source** (right sidebar) → **Root Directory** = **`backend`**. Save and redeploy. Do not rely on a root-level railpack that uses `cd backend`; the build context may not include it. |
| **Variables not loading** | Ensure `NODE_ENV` = `production` and `DATABASE_URL` is a **reference** to the Postgres service’s `DATABASE_URL` (use “Add reference” / “Variable reference”), not a literal string. |
| **App crashes or 503** | Check **Deploy logs** and **Service logs**. Often caused by missing `JWT_SECRET` (must be 16+ characters in production) or wrong `DATABASE_URL`. |
