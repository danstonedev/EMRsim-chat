import { ANIMATIONS, DEFAULT_ANIMATION_ID } from './manifest'

export type AnimationMatch = { id: string; caption?: string }

const availableIds = new Set(ANIMATIONS.map(a => a.id))

const has = (id: string): boolean => availableIds.has(id)

// Helpers to detect side/laterality in common clinical phrasing
const hasLeft = (t: string) => /\bleft\b|\bl\s*knee\b|\bl\b\s*(leg|knee)\b|\blle\b/i.test(t)
const hasRight = (t: string) => /\bright\b|\br\s*knee\b|\br\b\s*(leg|knee)\b|\brle\b/i.test(t)

export function matchAnimation(text: string | null | undefined): AnimationMatch | null {
  if (!text) return null
  const t = text.toLowerCase().trim()
  if (!t) return null

  // 1) Walking / Gait (natural phrasing)
  // Examples: "could you walk for me", "walk across the room", "take a few steps", "let me see your gait"
  if (/(\bwalk(ing)?\b|\bgait\b|take a few steps|walk across|walk toward|walk away)/i.test(t)) {
    if (has('Walk.glb')) return { id: 'Walk.glb', caption: 'Demonstration: Walking' }
  }

  // 2) Limp demonstration – only if explicitly requested (do NOT suggest limping)
  // Examples: "show me your limp", "demonstrate how you limp", "walk with a limp"
  if (/(show|demonstrate|simulate)\s+(your\s+)?limp\b|walk\s+with\s+(a\s+)?limp/i.test(t)) {
    if (has('Limp.glb')) return { id: 'Limp.glb', caption: 'Demonstration: Limping' }
  }

  // 3) Sit-to-Stand / Functional squat (proxy)
  // Examples: "sit to stand", "stand up from a chair", "have a seat then stand", "get up and sit down"
  if (/(sit\s*(to|-)\s*stand|stand up( from a chair)?|sit down|have a seat|take a seat|get up)/i.test(t)) {
    if (has('Sit.glb')) return { id: 'Sit.glb', caption: 'Demonstration: Sit-to-Stand (proxy)' }
    if (has('LongSit.glb')) return { id: 'LongSit.glb', caption: 'Demonstration: Long Sit (proxy)' }
  }

  // 4) Knee extension / ROM (side-sensitive if specified)
  // Examples: "extend your left knee", "straighten the right knee", "knee ROM", "bend and straighten your knee"
  const romIntent = /(\brom\b|range of motion|extend|extension|straighten|flex|flexion|bend)/i.test(t) && /\bknee\b/i.test(t)
  if (romIntent) {
    const left = hasLeft(t)
    const right = hasRight(t)
    if (left && has('Sit_Lknee_ex.glb')) return { id: 'Sit_Lknee_ex.glb', caption: 'Demonstration: Knee Extension (Left)' }
    if (right && has('Sit_Rknee_ex.glb')) return { id: 'Sit_Rknee_ex.glb', caption: 'Demonstration: Knee Extension (Right)' }
    // No side specified: choose seated posture or default stand
    if (has('Sit.glb')) return { id: 'Sit.glb', caption: 'Demonstration: Knee ROM (Seated posture)' }
    return { id: DEFAULT_ANIMATION_ID, caption: 'Demonstration: Knee ROM (Neutral)' }
  }

  // 5) Kick (simple functional extension)
  if (/(\bkick(ing)?\b)/i.test(t)) {
    if (has('Manny_Kick.glb')) return { id: 'Manny_Kick.glb', caption: 'Demonstration: Kick' }
    if (has('Kick_pass.glb')) return { id: 'Kick_pass.glb', caption: 'Demonstration: Kick' }
  }

  // 6) Generic posture requests
  if (/(\bstand( still)?\b)/i.test(t)) {
    if (has('Stand.glb')) return { id: 'Stand.glb', caption: 'Demonstration: Stand' }
  }
  if (/(\blong sit\b|legs out straight)/i.test(t) && has('LongSit.glb')) {
    return { id: 'LongSit.glb', caption: 'Demonstration: Long Sit' }
  }

  // No confident match
  return null
}
