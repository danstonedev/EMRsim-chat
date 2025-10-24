import { animationWarn } from '../../../shared/utils/animationLogging'

// Deprecated legacy component; returns null and logs a warning in dev.
export type HumanFigurePlaybackAPI = unknown
export default function HumanFigureMinimal(): null {
  if (import.meta && (import.meta as any).env?.DEV) {
    animationWarn('HumanFigure.fixed is removed. Use v2 Scene/Model instead.')
  }
  return null
}
