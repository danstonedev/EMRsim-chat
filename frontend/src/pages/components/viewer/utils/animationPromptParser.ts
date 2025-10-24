import { getPose, searchPoses, type Pose } from './poseLibrary'

export type AnimationCommand = {
  type: 'pose' | 'movement' | 'reset' | 'unknown'
  poses: Pose[]
  duration?: number
  description: string
  movement?: string
}

/**
 * Parses natural language prompts into animation commands
 */
export function parseAnimationPrompt(prompt: string): AnimationCommand {
  const normalized = prompt.toLowerCase().trim()

  // Movement-based commands
  if (normalized.includes('walk') || normalized.includes('walking')) {
    return {
      type: 'movement',
      description: 'Walking animation',
      movement: 'walk',
      poses: [],
    }
  }

  if (normalized.includes('wave') || normalized.includes('waving')) {
    return {
      type: 'movement',
      description: 'Waving gesture',
      movement: 'wave',
      poses: [],
    }
  }

  if (normalized.includes('point') || normalized.includes('pointing')) {
    return {
      type: 'movement',
      description: 'Pointing gesture',
      movement: 'point',
      poses: [],
    }
  }

  if (normalized.includes('sit') || normalized.includes('sitting')) {
    return {
      type: 'movement',
      description: 'Sitting position',
      movement: 'sit',
      poses: [],
    }
  }

  if (normalized.includes('idle') || normalized.includes('stand')) {
    return {
      type: 'movement',
      description: 'Idle stance',
      movement: 'idle',
      poses: [],
    }
  }

  // Direct pose lookup
  const directPose = getPose(normalized)
  if (directPose) {
    return {
      type: 'pose',
      poses: [directPose],
      description: `Applying pose: ${directPose.name}`,
    }
  }

  // Pattern matching for common phrases
  if (normalized.match(/balance.*(right|r)/)) {
    const pose = getPose('balance-right')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'Balancing on right foot',
      }
    }
  }

  if (normalized.match(/balance.*(left|l)/)) {
    const pose = getPose('balance-left')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'Balancing on left foot',
      }
    }
  }

  if (normalized.match(/raise.*arm|arm.*up|hands.*up/)) {
    const pose = getPose('arms-raised')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'Raising arms',
      }
    }
  }

  if (normalized.match(/arm.*forward|reach.*forward/)) {
    const pose = getPose('arms-forward')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'Extending arms forward',
      }
    }
  }

  if (normalized.match(/t.?pose|spread.*arm/)) {
    const pose = getPose('t-pose')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'T-pose',
      }
    }
  }

  if (normalized.match(/sit|sitting|seated/)) {
    const pose = getPose('sitting')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'Sitting down',
      }
    }
  }

  if (normalized.match(/stand|neutral|rest|relax/)) {
    const pose = getPose('neutral')
    if (pose) {
      return {
        type: 'pose',
        poses: [pose],
        description: 'Standing neutrally',
      }
    }
  }

  // Search for matching poses
  const matchingPoses = searchPoses(normalized)
  if (matchingPoses.length > 0) {
    return {
      type: 'pose',
      poses: [matchingPoses[0]],
      description: `Found: ${matchingPoses[0].name}`,
    }
  }

  // Unknown command
  return {
    type: 'unknown',
    poses: [],
    description: `Unknown command: "${prompt}". Try: wave, walk, point, sit, idle, or pose-based commands.`,
  }
}

/**
 * Gets suggestions for prompts based on available poses
 */
export function getPromptSuggestions(): string[] {
  return [
    'balance on right foot',
    'balance on left foot',
    'raise arms',
    'arms forward',
    't-pose',
    'sit down',
    'stand neutral',
  ]
}

/**
 * Validates if a prompt is likely to be understood
 */
export function validatePrompt(prompt: string): { valid: boolean; message: string } {
  const command = parseAnimationPrompt(prompt)

  if (command.type === 'unknown') {
    return {
      valid: false,
      message: command.description,
    }
  }

  return {
    valid: true,
    message: command.description,
  }
}
