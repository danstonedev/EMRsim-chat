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
