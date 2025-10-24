// Silences jsdom "Not implemented: HTMLMediaElement.prototype.play/pause" warnings in tests.
// We only stub minimal behavior; we don't change logic under test.

// Some libraries access these via property descriptors, so define them explicitly.
Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  // simulate the browser behavior of returning a promise
  value: () => Promise.resolve(),
});

Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: () => {},
});

// srcObject isn't implemented by jsdom for media elements; provide a basic shim
Object.defineProperty(globalThis.HTMLMediaElement.prototype, 'srcObject', {
  configurable: true,
  writable: true,
  value: null as unknown as MediaStream | null,
});
