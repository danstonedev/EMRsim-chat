export function logControllerWarning(context: string, error: unknown): void {
  console.warn(`[ConversationController] ${context}`, error)
}

export function safeInvoke(action: () => void, context: string): void {
  try {
    action()
  } catch (err) {
    logControllerWarning(context, err)
  }
}
