# VSPx – Vercel Projects, Root Directories, and Aliases

This note documents the finalized Vercel setup for the VSPx split. It captures project names, root directories, stable aliases, and environment variables so deployments stay predictable.

## Projects and Roots

- Backend
  - Project: `backend`
  - Root Directory: `backend/`
  - Production Branch: `main`
  - Stable alias: <https://vspx-backend.vercel.app>

- Frontend
  - Project: `vspx-frontend`
  - Root Directory: `frontend/`
  - Production Branch: `main`
  - Stable alias: <https://vspx-frontend.vercel.app>

## Environment Variables

- Frontend (vspx-frontend)
  - Production
    - `VITE_API_BASE_URL` = `https://vspx-backend.vercel.app`
  - Preview
    - `VITE_API_BASE_URL` = `https://vspx-backend.vercel.app`

- Backend (backend)
  - Production
    - `FRONTEND_URL` = `https://vspx-frontend.vercel.app`
    - `BACKEND_CORS_ORIGINS` = `https://vspx-frontend.vercel.app`
  - Preview
    - `FRONTEND_URL` = `https://vspx-frontend.vercel.app`
    - `BACKEND_CORS_ORIGINS` = `https://vspx-frontend.vercel.app`

Notes:

- Backend CORS logic additionally allows `*.vercel.app` domains.
- Using stable aliases avoids reconfiguring envs when a deployment URL changes.

## Deployment and CI

- Auto-deploys via GitHub (recommended):
  - In Vercel Dashboard → Project Settings → Git → Connect Repository → `danstonedev/VSPx`
  - Backend Root Directory: `backend/`; Frontend Root Directory: `frontend/`
  - Production Branch: `main`
  - Enable Previews for PRs (optional).

- Manual deploys (CLI): run from each folder already linked with `vercel link`.
  - `vercel deploy --prod`

## Aliases

- Backend: `vspx-backend.vercel.app` → latest production deployment of `backend`
- Frontend: `vspx-frontend.vercel.app` → latest production deployment of `vspx-frontend`

Use `vercel alias set <deployment-url> <alias>` to repoint if needed.

## Smoke Test

- Script: `scripts/prod-smoke-test.mjs`
- Default base points to `https://vspx-backend.vercel.app`
- Use the provided VS Code task "Smoke: Prod Transcript" to run a quick production health check.

## Build Guard and CI hardening

- Root deploy guard: the repo root contains a `vercel.json` that purposely fails any attempt to deploy from the root directory. This prevents accidental monorepo root deploys and enforces sub-project deploys only.
  - File: `/vercel.json`
  - Behavior: `ignoreCommand` echoes a message and exits non-zero so the build never starts from root.
- GitHub Pages workflow archived: `.github/workflows/deploy.yml` is now a no-op and only triggerable via `workflow_call`. It won’t deploy or run unless explicitly invoked by another workflow.
  - Prefer Vercel for all deployments. CI workflows that remain are limited to type-checks/tests and are platform-agnostic.

## Cleanup (optional)

- Legacy Vercel project named `frontend` can be renamed or archived to avoid confusion (the live frontend is now `vspx-frontend`).
