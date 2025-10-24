# Mixamo mannequin and basic motions

This guide lists a reliable Mixamo mannequin and a minimal animation set, with download/export settings and how to wire them into our v2 viewer.

## Recommended mannequin

- Character: Y Bot (Mixamo’s standard mannequin)
  - Consistent rig and bone names (mixamorig), widely compatible
  - Neutral T‑pose; works well with in‑place motion clips

Place the downloaded character (GLB) at:

```text
frontend/public/models/mixamo-ybot.glb
```

In `frontend/src/pages/v2/manifest.ts` set:

```ts
export const MODEL = {
  baseModelPath: 'models/mixamo-ybot.glb',
  scale: 1,
}
```

## Minimal motion set (in‑place)

Choose the “In Place” variants to avoid root motion drift:

- Idle: “Idle” (no translation)
- Walk: “Walking In Place”
- Run: “Running In Place”
- Jump: “Jump In Place” (one‑shot)
- Turn Left 90: “Standing Turn 90 Left In Place” (optional)
- Turn Right 90: “Standing Turn 90 Right In Place” (optional)

You can start with Walk + Jump; add Run/Turn later.

Download animations as separate files.

## Mixamo download settings

For the character (base model):

- Format: FBX Binary
- Skin: With Skin
- Frames per Second: 30
- Reduce Keyframes: None (or as preferred)

For animations (clips):

- Format: FBX Binary
- Skin: Without Skin (smaller files, we retarget to base model)
- In Place: Enabled (for Walk/Run/Turn/Jump in‑place variants)
- Frames per Second: 30
- Reduce Keyframes: None (or as preferred)

## Convert FBX to GLB

Two common options:

1. Blender

- File → Import → FBX (character and each animation)
- For the character: Export → glTF 2.0 (.glb) with Mesh + Skin + Animations checked
- For each animation FBX (no skin): export to GLB; the file will include animation tracks targeting the Mixamo rig

1. FBX2glTF (CLI)

- Use the official FBX2glTF tool to convert FBX → GLB without opening Blender

Name the outputs consistently and place them here:

```text
frontend/public/models/
  mixamo-ybot.glb
frontend/public/models/animations/
  Idle.glb
  Walk.glb
  Run.glb
  Jump.glb
```

## Wire animations in the manifest

Edit `frontend/src/pages/v2/manifest.ts`:

```ts
const p = (file: string) => `${BASE}models/animations/${file}`

export const ANIMATIONS = [
  { id: 'Walk.glb', path: p('Walk.glb'), loop: 'repeat' },
  { id: 'Jump.glb', path: p('Jump.glb'), loop: 'once' },
  // Optional extras
  // { id: 'Idle.glb', path: p('Idle.glb'), loop: 'repeat' },
  // { id: 'Run.glb',  path: p('Run.glb'),  loop: 'repeat' },
]
```

Ensure at least one `loop: 'repeat'` entry (the default); one‑shots like Jump will auto‑fallback to the repeat clip when finished.

## Notes and tips

- When possible, download all clips from Mixamo against the same mannequin in one session to keep rig settings consistent.
- Prefer “In Place” clips for gameplay‑style control; if you need root motion, disable “In Place” and handle translation in your scene.
- Our viewer retargets clips to the base model and applies the source rest pose before playback to avoid idle pose blending.
