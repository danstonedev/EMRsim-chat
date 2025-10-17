import { animationWarn } from '../../../../shared/utils/animationLogging'

// Deprecated: Mini viewer has been removed. This file remains to avoid breakage if accidentally imported.
export default function HumanFigureMini(): null {
  if (import.meta && (import.meta as any).env?.DEV) {
    animationWarn('HumanFigureMini is removed. Use the v2 Viewer or modal instead.')
  }
  return null
}
