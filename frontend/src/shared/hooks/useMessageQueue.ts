import { useCallback, useRef } from 'react'

/**
 * Manages a batched message update queue to prevent race conditions
 * and ensure ordered message updates without overwhelming React's reconciliation.
 * 
 * Updates are queued and processed in the next microtask to batch rapid changes.
 */
export function useMessageQueue() {
  const updateQueueRef = useRef<Array<() => void>>([])
  const processingQueueRef = useRef(false)
  const queueGenerationRef = useRef(0)

  /**
   * Queue a message update function to be executed in a batch.
   * This prevents race conditions from simultaneous updates.
   */
  const queueMessageUpdate = useCallback((updateFn: () => void) => {
    const generation = queueGenerationRef.current
    
    updateQueueRef.current.push(() => {
      // Skip if queue was cleared (e.g., session changed)
      if (queueGenerationRef.current !== generation) return
      updateFn()
    })

    // Already processing, will pick up new items
    if (processingQueueRef.current) return

    processingQueueRef.current = true
    setTimeout(() => {
      const queue = updateQueueRef.current
      updateQueueRef.current = []
      queue.forEach(fn => fn())
      processingQueueRef.current = false
    }, 0)
  }, [])

  /**
   * Clear the queue and increment generation to invalidate pending updates.
   * Use when session/persona changes and queued updates should be discarded.
   */
  const clearQueue = useCallback(() => {
    queueGenerationRef.current += 1
    updateQueueRef.current = []
    processingQueueRef.current = false
  }, [])

  return {
    queueMessageUpdate,
    clearQueue,
  }
}
