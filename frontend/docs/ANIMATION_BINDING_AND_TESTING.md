# Animation Binding & Testing Notes

- Always bind `useAnimations` to the mounted group ref that actually contains the scene you render. Do not bind to the raw GLTF scene object — the mixer needs to target the live node in the render tree.
- Update the mixer in `useFrame((_, delta) => mixer.update(delta))`. No per-frame skeleton hacks are needed when bound to the mounted group.
- Use a manifest of animation GLBs and name cloned clips by filename (e.g., `Standing.glb`). Keep loop policy declarative (repeat vs once), and set one-shots to return to a default clip on `mixer` `finished`.
- Tests (jsdom):
  - Partially mock `@react-three/fiber` to include a no-op `useFrame` and override `useLoader` to return simple `AnimationClip`s.
  - Persist action instances across renders in mocks to simulate real mixer behavior.
  - Assert play/pause toggles do not create extra `play()` calls unnecessarily and switching clips stops others before playing the new one.
