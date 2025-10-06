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

See `ops/docs/README.md`, `ops/docs/BUILD_GUIDE.md`, and `ops/docs/API_CONTRACTS.md` for roadmap and contracts.
