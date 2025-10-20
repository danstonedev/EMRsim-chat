# Frontend (Vite + React)

## Quickstart

```powershell
cd frontend
npm i
npm run dev
```

- Opens `http://localhost:5173`
- Expects backend at `http://localhost:3001` (config: `VITE_API_BASE_URL`)
- On Windows the dev server falls back to file-polling; set `CHOKIDAR_USEPOLLING=1` if you need tighter reloads.

## Env

Copy `.env.local.example` to `.env.local` and adjust as needed.

### Voice UI

- Set `VITE_VOICE_ENABLED=true` (frontend) and `VOICE_ENABLED=true` (backend) to show the mic controls.
- Voice sessions request their own short-lived session and WebRTC token; ensure the backend is reachable at the configured base URL.

#### Additional Voice Configuration

Add these to `.env.local` (see `.env.local.example`):

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `VITE_VOICE_BARGE_IN` | `true` \| `false` (truthy strings) | `false` | When true, relaxes echo/noise suppression to improve capturing speech while assistant is talking. |
| `VITE_STT_FALLBACK_MS` | Number (milliseconds) | `800` | Forces a final transcript commit if the provider never sends `completed`. Lower values shorten visible lag. |
| `VITE_ADAPTIVE_VAD` | `true` \| `false` | `true` | Learns mic noise/SNR and auto-tunes server VAD threshold/silence and local STT fallbacks to reduce stuck turns in noisy or hesitant speech. |
| `VITE_ADAPTIVE_VAD_DEBUG` | `true` \| `false` | `false` | Emits periodic debug events describing adaptive noise level, SNR, and chosen VAD params. |
| `VITE_ADAPTIVE_VAD_BADGE` | `true` \| `false` | `false` | Shows a small "Quiet/Noisy/Very Noisy" badge next to the waveform for quick operator visibility. |

Behavior notes:

- Enabling barge‑in may increase audible echo on open speakers; prefer a headset for best quality.
- With adaptive VAD on, the app will occasionally send `session.update` to the realtime model with tuned `turn_detection` values when the environment changes. Updates are rate-limited to avoid churn.
- The badge only renders when `VITE_ADAPTIVE_VAD_BADGE=true` (or when `VITE_ADAPTIVE_VAD_DEBUG=true`) and the voice session is connected.

Testing sequence:

1. Enable overlap test: set `VITE_VOICE_BARGE_IN=true`, restart dev server, then talk while the assistant is mid‑reply—your transcript should continue updating instead of being suppressed.
2. Validate finalization under background noise: set `VITE_ADAPTIVE_VAD_BADGE=true`, open a session, and observe the badge switch between Quiet/Noisy/Very Noisy as you introduce ambient noise. Turns should finalize reliably without having to over-emphasize sentence endings.

## 3D Viewer debug HUD

You can enable a lightweight on-screen HUD for the 3D viewer to help diagnose animation playback and model metrics.

- Where: open the viewer at `/3d-viewer`
- Enable via URL: append `?viewerDebug=1` (or `?debug=1`)
  - Example: `http://localhost:5173/3d-viewer?viewerDebug=1`
- Enable via env: set `VITE_VIEWER_DEBUG=true` in `frontend/.env.local` and restart the dev server

What it shows:

- Model metrics: scale factor and bounding sphere radius
- Playback snapshot: current animation id, time (s), speed, and whether the system is animating

Notes:

- The HUD is off by default and only appears when the flag is set.
- If the HUD shows time stuck at `0.00` for a selected clip, that animation likely didn’t bind to the rig. Try a different clip, or check the browser console for retargeting/remap logs.
- The animation selector filters out clips that don’t report a valid duration on the current rig to avoid T‑pose selections.

## 3D Viewer performance toggles

These flags let you trade visuals for FPS on integrated GPUs or high‑DPI displays. Defaults are conservative and safe; enable case‑by‑case when profiling or demoing.

Add to `frontend/.env.local`:

| Variable | Default | Effect |
|----------|---------|--------|
| `VITE_VIEWER_PERF_MODE` | `false` | Simplifies lights (ambient + key only), reduces grid complexity, defers secondary lights by one frame to reduce time‑to‑first‑pixel. |
| `VITE_VIEWER_AA` | `false` | Enables antialiasing. Leave off for best FPS on iGPU. |
| `VITE_VIEWER_SHADOWS` | `false` | Enables shadows. Leave off for best FPS; enable for demos. |
| `VITE_RENDER_METRICS` | `false` | Turns on React Profiler summaries (commit counts, durations) in the console via `RenderProfiler`. |

Runtime hints the app also uses:

- Device pixel ratio clamped to `[1, 1.75]` to control fill‑rate costs on high‑DPI displays.
- WebGL `powerPreference: 'high-performance'` when creating the context.

Try it quickly:

```powershell
cd frontend
echo "VITE_VIEWER_PERF_MODE=true`nVITE_RENDER_METRICS=true" >> .env.local
npm run dev
```

Open the 3D viewer and watch the console for `[render-metrics]` tables while interacting.
