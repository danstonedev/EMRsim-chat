# Environment configuration

This repo uses two .env templates to make local setup predictable and safe:

- frontend/.env.example — copy to frontend/.env.local for local dev
- backend/.env.example — copy to backend/.env for local dev

Quick start (Windows PowerShell):

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env
```

Key variables

- Frontend
  - VITE_API_BASE_URL — Backend base URL (default <http://localhost:3002>)
  - VITE_VOICE_ENABLED — Show/enable mic controls
  - VITE_SPS_ENABLED — Scenario guidance/features
  - Optional: VITE_API_TIMEOUT_MS, VITE_VOICE_AUTOSTART*, VITE_ICE_* for advanced tuning
- Backend
  - OPENAI_API_KEY — Required for text/voice generation
  - OPENAI_REALTIME_MODEL, OPENAI_TTS_VOICE — Realtime + TTS
  - DATABASE_URL or SQLITE_PATH — Local SQLite path (file:./dev.db is fine)
  - Optional: REDIS_URL for durable sessions; BACKEND_CORS_ORIGINS/FRONTEND_URL for CORS

Notes

- Do not commit real secrets. Only the *.example templates are tracked.
- The app defaults are tuned for dev: SQLite + in‑memory sessions (no Redis).
- Voice features can be disabled safely via flags if you don’t have a key yet.
