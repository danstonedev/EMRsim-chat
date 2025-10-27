# Vercel Monorepo Guard

This repo deploys to Vercel using TWO separate projects:

- frontend/ (Vite app)
- backend/ (@vercel/node server)

Do NOT point a Vercel project at the repository root. Configure each Vercel project as follows:

- Root Directory: `frontend` (UI) or `backend` (API)
- Production Branch: `main`
- Environment Variables: use the Vercel dashboard (avoid committing secrets); use a stable production domain for cross-service URLs (avoid per-deploy `*.vercel.app` IDs)

Why this matters:

- Root deployments may pick up legacy Next.js config intended for GitHub Pages, not Vercel.
- Per-deploy URLs couple the frontend and backend to ephemeral deployments.

Recovery steps if misconfigured:

1. In Vercel, edit each project: set Root Directory to `frontend/` or `backend/`, set Production Branch to `main`, and ensure env vars reference the stable production domain for the other service

1. Trigger a fresh Production deploy for both projects

1. Re-run `node scripts/prod-smoke-test.mjs` locally to validate Production

Safe rollback:

- An annotated safety tag `recovery-2025-10-27` has been created at current `main`.

Additional best practices applied in this repo:

- Removed hardcoded `VITE_API_BASE_URL` from `frontend/vercel.json`. Configure this in the Vercel dashboard for the Frontend project to point at your stable Backend domain.
- Pruned URL-specific variables from `backend/vercel.json` to avoid coupling to ephemeral deployment URLs; backend CORS already permits `*.vercel.app` and can be extended via dashboard envs if needed.
- Avoid committing production `.env` files; use `.env.local` for development and Vercel dashboard variables for Production.

## Production configuration checklist (live domains)

Use these stable Vercel domains for Production:

- Frontend (UI): <https://frontend-ruby-one-10.vercel.app>
- Backend (API): <https://backend-six-rho-54.vercel.app>

In the Vercel dashboard, configure each project:

Frontend project (Root Directory: `frontend`, Production Branch: `main`)

- Environment Variables (Production):
  - VITE_API_BASE_URL = <https://backend-six-rho-54.vercel.app>
  - Optional flags already set in `frontend/vercel.json` (VITE_VOICE_ENABLED, VITE_SPS_ENABLED, etc.)

Backend project (Root Directory: `backend`, Production Branch: `main`)

- Environment Variables (Production):
  - FRONTEND_URL = <https://frontend-ruby-one-10.vercel.app>
  - BACKEND_CORS_ORIGINS = <https://frontend-ruby-one-10.vercel.app>
  - OPENAI_REALTIME_MODEL = gpt-realtime-mini-2025-10-06 (already in `backend/vercel.json`)

Redeploy and verify

1. Trigger Production redeploys for Backend then Frontend.
2. Run the local smoke test: use the task "Smoke: Prod Transcript" or run `node scripts/prod-smoke-test.mjs`. Expect 200/201 on health/session/save/turns and a transcript length in output JSON.

Notes

- Backend CORS also allows `*.vercel.app` by default; the explicit FRONTEND_URL/BACKEND_CORS_ORIGINS further tightens allowed origins to the stable UI domain.
- Prefer custom domains (e.g., `app.example.com`, `api.example.com`) when ready; the same configuration applies.
