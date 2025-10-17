# UND Simulated-Patient Chatbot

This repo implements the walking skeleton (v0.1) for a UND-themed simulated patient chatbot with streamed text.

## Run locally

Backend

```powershell
cd backend
npm i
copy .env.example .env
npm run dev
```

Frontend

```powershell
cd frontend
npm i
copy .env.local.example .env.local
npm run dev
```

Open `http://localhost:5173`.

## What works in v0.1

- Streaming chat over `/api/sessions/:id/message` (SSE-like fetch stream)
- Personas loaded from SQLite; seed of 2 personas on first run
- TTFT metric displayed in header chip

## Docs

📚 **[DOCS_INDEX.md](DOCS_INDEX.md)** - **START HERE** for complete documentation navigation

Quick links:

- Architecture overview: [docs/README.md](docs/README.md)
- Ops docs landing: [ops/docs/README.md](ops/docs/README.md)
- Build guide: [ops/docs/BUILD_GUIDE.md](ops/docs/BUILD_GUIDE.md)
- API contracts: [ops/docs/API_CONTRACTS.md](ops/docs/API_CONTRACTS.md)
- Testing guide: [TESTING_GUIDE.md](TESTING_GUIDE.md)
- Production readiness: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md)
