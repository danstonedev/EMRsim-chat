import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { Message, nextSequenceId, sortMessages } from '../../pages/chatShared'
import type { MediaReference } from '../../shared/types'
import { api } from '../api'
import { voiceDebug, voiceWarn } from '../utils/voiceLogging'

interface UseTextMessagesOptions {
	sessionId: string | null
	queueMessageUpdate: (updateFn: () => void) => void
	setMessages: Dispatch<SetStateAction<Message[]>>
	messages: Message[]
	firstDeltaRef: MutableRefObject<number | null>
	textUserStartTimeRef: MutableRefObject<number | null>
	voiceUserStartTimeRef: MutableRefObject<number | null>
	setTtftMs: Dispatch<SetStateAction<number | null>>
	setPersistenceError: Dispatch<SetStateAction<{ message: string; timestamp: number } | null>>
	updateVoiceMessage: (
		role: 'user' | 'assistant',
		text: string,
		isFinal: boolean,
		timestamp: number,
		media?: MediaReference
	) => void
}

interface UpdateAssistantTextMessageOptions {
	append?: boolean
	preserveOnFinalEmpty?: boolean
}

export function useTextMessages({
	sessionId,
	queueMessageUpdate,
	setMessages,
	messages,
	firstDeltaRef,
	textUserStartTimeRef,
	voiceUserStartTimeRef,
	setTtftMs,
	setPersistenceError,
	updateVoiceMessage,
}: UseTextMessagesOptions) {
	const textAssistantIdRef = useRef<string | null>(null)

	const updateAssistantTextMessage = useCallback(
		(
			text: string,
			isFinal: boolean,
			timestamp: number,
			media?: MediaReference,
			opts?: UpdateAssistantTextMessageOptions
		) => {
			const id = textAssistantIdRef.current

			if (!id) {
				updateVoiceMessage('assistant', text, isFinal, timestamp, media)
				return
			}

			queueMessageUpdate(() => {
				setMessages(prev => {
					let found = false
					const updated = prev.map(msg => {
						if (msg.id !== id) return msg
						found = true

						const stampedTimestamp = msg.timestamp && msg.timestamp > 0 ? msg.timestamp : timestamp
						const stampedSequence = msg.sequenceId && msg.sequenceId > 0 ? msg.sequenceId : nextSequenceId()

						let nextText = text
						if (opts?.append && !isFinal) {
							nextText = (msg.text || '') + (text || '')
						} else if (isFinal && opts?.preserveOnFinalEmpty && (!text || text.length === 0)) {
							nextText = msg.text || ''
						}

						const nextMessage: Message = {
							...msg,
							text: nextText,
							pending: !isFinal,
							timestamp: stampedTimestamp,
							sequenceId: stampedSequence,
						}

						if (media !== undefined) {
							return { ...nextMessage, media: media ?? msg.media }
						}
						return nextMessage
					})

					return sortMessages(found ? updated : prev)
				})
			})

			if (!isFinal && firstDeltaRef.current == null) {
				firstDeltaRef.current = timestamp
				const voiceStart = voiceUserStartTimeRef.current
				const typedStart = textUserStartTimeRef.current
				const start = voiceStart ?? typedStart
				if (start != null) {
					setTtftMs(timestamp - start)
				}
			}

			if (isFinal && sessionId) {
				const payloadText = text && text.trim() ? text : messages.find(m => m.id === id)?.text || ''
				if (payloadText && payloadText.trim()) {
					voiceDebug('[useTextMessages] Persisting assistant text turn:', {
						channel: 'text',
						textLength: payloadText.length,
						timestamp,
					})

					api
						.saveSpsTurns(sessionId, [
							{
								role: 'assistant',
								text: payloadText,
								channel: 'text',
								timestamp_ms: timestamp,
							},
						])
						.then(res => {
							voiceDebug('[useTextMessages] Assistant turn persisted:', {
								saved: res.saved,
								duplicates: res.duplicates,
							})
						})
						.catch(err => {
							voiceWarn('[useTextMessages] Assistant turn persist failed:', err)
							setPersistenceError({
								message: 'Failed to save transcript',
								timestamp: Date.now(),
							})
						})
				}

				textAssistantIdRef.current = null
			}
		},
		[
			sessionId,
			queueMessageUpdate,
			setMessages,
			messages,
			firstDeltaRef,
			voiceUserStartTimeRef,
			textUserStartTimeRef,
			setTtftMs,
			setPersistenceError,
			updateVoiceMessage,
		]
	)

	return {
		updateAssistantTextMessage,
		textAssistantIdRef,
	}
}

