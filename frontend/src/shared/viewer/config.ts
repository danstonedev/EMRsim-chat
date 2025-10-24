// Centralized viewer configuration and constants
export const BASE_URL: string = (import.meta as any).env?.BASE_URL || '/'

// Base model path under public
export const BASE_MODEL_PATH = 'models/Manny_Static.glb'

// Default playback speed for animations when not overridden by manifest
export const DEFAULT_ANIMATION_SPEED = 0.5

// Helper to build absolute URLs respecting BASE_URL
export const withBase = (relative: string) => `${BASE_URL}${relative.replace(/^\//, '')}`
