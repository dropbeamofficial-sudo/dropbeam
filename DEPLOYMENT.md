Vercel deployment steps (frontend)
=================================

1) Push your repo to GitHub (already done).

2) Configure Vercel project (Dashboard)
   - Import the repository in Vercel (https://vercel.com/new).
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `.`
   - Environment Variables (Project -> Settings -> Environment Variables):
     - `BACKEND_URL` = `https://your-backend.example.com` (set your backend URL here)

3) What the build does
   - During build Vercel runs `npm run build`, which executes `scripts/generate-env.js` and writes `_env.js` containing `window.__BACKEND_URL__` for runtime.
   - `index.html` loads `/_env.js` before `script.js`, so the frontend will target the backend set in `BACKEND_URL`.

4) CORS and backend
   - On the backend (your Node server), set `CLIENT_URL` = the Vercel site URL (e.g., `https://dropbeam.vercel.app`) so `server.js` allows requests from the frontend.
   - Host the backend on a platform that supports WebSockets for Socket.io (Render, Railway, Fly, DigitalOcean App Platform, or a VPS). Vercel's serverless functions are not suitable for persistent Socket.io connections.

5) CLI alternative
   - Install Vercel CLI: `npm i -g vercel`
   - From repo root run: `vercel` and follow prompts. To set env var: `vercel env add BACKEND_URL production`.

6) Verify after deploy
   - Open the Vercel URL and check devtools → Network for `/upload` requests hitting your backend URL.
   - Confirm `_env.js` is served and contains the correct backend value.

7) Troubleshooting
   - If `_env.js` missing: ensure `npm run build` runs and `BACKEND_URL` env var is set in Vercel.
   - If CORS errors: set backend `CLIENT_URL` to the Vercel origin and redeploy backend.

   Render auto-deploy via `render.yaml` (recommended)
   -----------------------------------------------
   1. The repository now includes `render.yaml` which defines a `dropbeam-backend` web
      service. This file allows Render to automatically create and deploy the backend
      when you connect your GitHub repo.

   2. Steps on Render:
      - Create an account and go to New → Import from GitHub.
      - Choose the `dropbeam` repository and Render will detect `render.yaml`.
      - Review service settings and click "Create Web Service". Render will build
        and deploy automatically on pushes to `main`.

   3. The manifest sets these env vars by default (you can change them in the Render dashboard):
      - `CLIENT_URL` → should be your Vercel frontend URL
      - `NODE_ENV=production`, `EXPIRY_MINUTES=15`, `UPLOADS_DIR=/tmp/uploads`

   4. After Render provides a public HTTPS URL, set Vercel's `BACKEND_URL` to that
      URL and redeploy the frontend (Vercel → Project → Redeploy).
