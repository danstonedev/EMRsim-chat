# Archived: Deploy Backend on Render (Not Used)

Render is not used. Our production is on Vercel. Use the Vercel deployment docs instead.

## Prereqs

- A Render account (free plan works to start)
- This GitHub repo pushed to your account (Render reads directly from GitHub)

## One-time setup

1. Commit and push your latest changes to GitHub.
2. In Render, click New → Blueprint and choose this repository.
3. Review the plan and click “Apply”. Render will provision a Web Service named `emrsim-backend` from `backend/Dockerfile`.

## Environment Variables (Render → emrsim-backend → Environment)

- `NODE_ENV=production`
- `BACKEND_CORS_ORIGINS=https://YOUR-VERCEL-APP.vercel.app`
  - You can set this after your first deploy once Vercel gives you the URL.
  - Use comma-separated values if you want to allow multiple origins.

The service will listen on `$PORT` (Render injects it). Our Dockerfile already respects `PORT`.

## Health Check

- Path: `/health`
- Render will mark the service healthy when it returns 200.

## Point the frontend to Render

In your Vercel project (frontend):

1. Settings → Environment Variables
2. Add `VITE_API_BASE_URL` = `https://<your-render-service>.onrender.com`
3. Redeploy the frontend (trigger a new build).

Alternatively, you can run `deploy-frontend-vercel.ps1` locally after you update `frontend/.env.production` with the new `VITE_API_BASE_URL`.

## Verify

1. Open the Render URL `/health` to check 200 OK.
2. Open the Vercel frontend and initiate a conversation.
3. Temporarily block the WebSocket in the browser DevTools (Network → WS → Block) to confirm the new socket fallback emits `transcript.*.final.fallback` events.

## Notes

- The previously added Azure GitHub Action is optional and not used by this flow.
- If you prefer Railway or Fly.io, the same Dockerfile works.
