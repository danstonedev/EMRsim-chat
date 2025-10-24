# EMRsim-chat

[![CI - Type Check](https://github.com/danstonedev/EMRsim-chat/actions/workflows/ci-type-check.yml/badge.svg)](https://github.com/danstonedev/EMRsim-chat/actions/workflows/ci-type-check.yml)

EMRsim-chat is a modern, full-stack chat application.

Core stack:

- Frontend: React + TypeScript (Vite) in `frontend/` with Tailwind and MUI icons
- Backend: Node.js + Express + Socket.IO in `backend/`
- Media/3D: three.js + react-three-fiber
- Data: PostgreSQL (dev-compatible with SQLite), Redis for caching (optional)
- CI: GitHub Actions type checks on PRs and pushes to `main`
- Deployment: Vercel for frontend and backend (see docs)

## Repository layout

```text
EMRsim-chat/
├── frontend/          # React + Vite app (Next.js-like UX, dark mode, responsive chat UI)
├── backend/           # Node.js API + Socket.IO server
├── scripts/           # Utilities (SPS tools, scanning, smoke tests)
├── e2e/               # Playwright tests
├── .github/workflows/ # CI workflow(s)
└── docs & guides      # See DOCS_INDEX.md for an overview
```

## Getting started

1) Install dependencies (from repo root)
   - Use VS Code task “Deps: Install All” or run: the provided scripts install per-package deps

2) Set up environment variables
   - See `ENVIRONMENT.md` for a quick start
   - Templates: `frontend/.env.example` and `backend/.env.example`

3) Run the dev environment
   - Use the default VS Code task “Full-Stack: Dev Environment”
   - Or start manually from each package (`npm run dev` in `frontend/` and `backend/`)

4) Type checks and tests
   - Type checks: “Full-Stack: Type Check All” task
   - Frontend tests: “Frontend: Test” task
   - Backend tests/validators: “Backend: Test & Validate” task

Open the app at <http://localhost:3001> (frontend default) when the dev server is running.

## Frontend notes

- Main chat UI lives in `frontend/src/components/ChatInterface.tsx` with message history, timestamps, and dark mode.
- Emoji icons have been replaced by MUI icons for a more polished look.
- The “Encounter complete” modal stays until you choose an explicit action.
- The “Evaluate” option has been removed; restarting a case does not reopen the builder.

## Deployment

We deploy with Vercel. Start here:

- `VERCEL_DEPLOYMENT_STATUS.md`
- `DEPLOYMENT_QUICK_START.md`
- `DEPLOYMENT_GUIDE.md`

CI runs type checks on PRs and pushes to `main`. Production deploys are manual via Vercel.

## Documentation

- See `DOCS_INDEX.md` for a map of the documentation
- Onboarding env details: `ENVIRONMENT.md`
- Production readiness: `PRODUCTION_READINESS.md`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md`

## Contributing

1. Create a feature branch
2. Make your changes and run type checks/tests
3. Open a PR to `main`

## License

MIT — see [LICENSE](LICENSE)
