import { parseAnimationPrompt } from './animationPromptParser'
import type { ProceduralAnimator } from './proceduralAnimator'
import type { MovementController } from './movementSystem'
import { animationDebug, animationError } from '../../../../shared/utils/animationLogging'

type Callbacks = {
  onPromptResult?: (msg: string) => void
  log?: (msg: string, ...args: any[]) => void
}

export function routeAnimationPrompt(
  prompt: string,
  animator: ProceduralAnimator | null,
  movement: MovementController | null,
  cb: Callbacks = {}
) {
  const { onPromptResult, log = animationDebug } = cb
  if (!prompt) return

  log('📝 Processing animation prompt:', prompt)
  const command = parseAnimationPrompt(prompt)
  log('🎯 Parsed command:', command)

  if (command.type === 'unknown') {
    onPromptResult?.(command.description)
    return
  }

  if (command.type === 'movement' && command.movement) {
    if (movement) {
      log(`🎬 Playing movement: ${command.movement}`)
      movement.playMovement(command.movement, {
        fadeIn: 0.5,
        fadeOut: 0.5,
        onComplete: () => {
          log(`✅ Movement complete: ${command.movement}`)
          onPromptResult?.(`✅ Completed: ${command.description}`)
        },
      })
      onPromptResult?.(`▶️ Playing: ${command.description}`)
    } else {
      animationError('MovementController not initialized')
    }
    return
  }

  if (command.type === 'pose' && command.poses.length > 0) {
    if (animator) {
      log('🎬 Playing pose animation')
      const pose = command.poses[0]
      animator.transitionToPose(pose, 0.5, () => {
        log('✅ Pose animation complete')
        onPromptResult?.(`✅ ${command.description}`)
      })
    } else {
      animationError('ProceduralAnimator not initialized')
    }
    return
  }

  if (command.type === 'reset') {
    if (movement) {
      log('🔄 Resetting to idle')
      movement.stop()
      movement.playMovement('idle', { fadeIn: 0.5 })
    }
    onPromptResult?.('✅ Reset to idle position')
  }
}
