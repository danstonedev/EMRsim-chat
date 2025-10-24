# GLTF loader configuration

This viewer supports optional DRACO and KTX2 decoders, enabled automatically when the decoder assets are present under:

- public/draco/
- public/basis/

No code changes are required — the loader is configured at runtime. If your GLB is not encoded with DRACO or KTX2, these files are not necessary.

Meshopt is not wired by default to avoid additional dependencies; enable later if needed.
