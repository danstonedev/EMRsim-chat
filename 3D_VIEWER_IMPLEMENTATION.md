# 3D Viewer Implementation (Current State)

This document reflects the CURRENT production 3D viewer. Legacy procedural/prototype content has been retired (see Historical Note at bottom).

## High-Level Summary

The viewer loads a rigged GLTF base model (Manny) plus external animation clips via a manifest. A Playback Modal provides:

- Play / Pause
- Timeline scrubbing (seek)
- Per‑clip speed control (0.25×–2×)
- Animation selection (dropdown tied to manifest)

## Core Files

```text
frontend/src/pages/Viewer3D.tsx                # Page wiring + modal integration
frontend/src/pages/components/viewer/Scene.tsx # Scene, lighting, controls, ref pass-through
frontend/src/pages/components/viewer/HumanFigure.fixed.tsx # GLTF model + useAnimations + playback API
frontend/src/pages/components/viewer/PlaybackModal.tsx      # UI for playback & selection
frontend/src/pages/components/viewer/animations/manifest.ts # Animation manifest (clipName, loop, speed)
frontend/src/pages/components/viewer/hooks/useAnimationClips.ts # Loads base + animations & resolves clip
frontend/src/pages/components/viewer/utils/debugFlags.ts    # viewerDebugEnabled()
frontend/src/pages/components/viewer/utils/mixerController.ts # Play, loop policy, speeds, logging
```

## Animation Manifest

Located at `animations/manifest.ts` — each entry defines:

```ts
export type AnimationSpec = {
  id: string            // filename (unique id)
  path: string          // public/models/... path
  clipName?: string     // preferred internal clip name
  clipIndex?: number    // fallback numeric index
  loop?: 'repeat' | 'once' | 'pingpong'
  speed?: number        // initial timeScale (default 1)
}
```

Clip resolution precedence:

1. `clipName`
2. `clipIndex`
3. Filename stem heuristic (case‑insensitive substring contains)
4. First clip

Shipped animations (Manny set):

- Manny_Swim.glb (clipName: Swim)
- Manny_Kick.glb (clipName: Kick)
- Kick_pass.glb (clipName: Kick)

Default animation: Manny_Swim.glb

## Playback API

`HumanFigure.fixed.tsx` exposes via `forwardRef`:

```ts
type HumanFigurePlaybackAPI = {
  getDuration(id?: string): number | null
  getCurrentTime(): number
  setSpeed(s: number): void
  getSpeed(): number
  seek(t: number): void
}
```

The modal polls `getCurrentTime()` (rAF) to update the slider; scrubbing calls `seek(t)`; speed buttons update timeScale via `setSpeed()` while preserving manifest baseline.

## Debug Logging

Enable verbose logs by either:

1. `VITE_VIEWER_DEBUG=1` in environment
2. `?debug=1` (or `?viewerDebug=1`) URL parameter

Debug output includes clip selection, metrics, mixer play details. Always-on (even without debug):

- `Prepared animations:` summary
- `Playing animation: <name>` on clip switch

## Scene & Scaling

One-time metrics compute bounding box & scale Manny to 1.8m target height (applied to wrapper group). This keeps different future models consistent in world units.

## Loop & Speed

Loop policy & initial speed applied when playing an action (see `mixerController.ts`). Runtime speed changes override action effective timeScale without mutating manifest data.

## Removing Legacy Code

- Deprecated procedural walking figure & limb sine oscillations removed from runtime.
- All selection & playback now manifest + mixer API driven.

## Access & Usage

Navigate to `/3d-viewer` or click the navigation entry. Open the Playback button/modal to control animations. All state lives client-side; no network calls after asset load.

## Testing

- Viewer-only tests: `npm run test:viewer`
- Ensure debug off during snapshot tests to avoid noisy console output (debug logs are gated).

## Future Focus (Post-Playback Modal)

Short-term priorities now that multi-clip + controls are done:

- Anatomical/medical annotation layer
- Additional medical motion clips (ROM tests, gait variants)
- Camera preset system
- Lightweight performance profiling (skeleton draw calls)

## Dependencies (Key 3D)

```text
three, @react-three/fiber, @react-three/drei
```

Branding and styling remain UND green (#009A44) consistent with broader application.

Status: CURRENT & MAINTAINED

---

## Historical Note

Earlier iterations used a procedural placeholder (boxes/capsule + sine-based limb motion). That approach was intentionally removed in favor of GLTF + `useAnimations` for correctness, maintainability, and easier expansion to medical/clinical motion sets. If you need to resurrect it for demonstration, browse git history for `HumanFigure.tsx` prior to the forwardRef conversion.
