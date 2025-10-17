/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_UND_PRIMARY?: string
  readonly VITE_UND_GRAY?: string
  readonly VITE_VOICE_ENABLED?: string
  readonly VITE_BANNERS_ENABLED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
