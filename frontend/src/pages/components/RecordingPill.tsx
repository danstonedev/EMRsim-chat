import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './RecordingPill.css'

export type RecordingPillProps = {
  isRecording?: boolean
  defaultRecording?: boolean
  showTimer?: boolean
  maxSeconds?: number
  allowPause?: boolean
  allowDiscard?: boolean
  waveformSource?: MediaStream | null
  levelSmoothing?: number
  onRequestMic?: () => Promise<MediaStream>
  onStart?: (stream: MediaStream) => void
  onStop?: (blob: Blob, durationMs: number) => void
  onData?: (chunk: Float32Array) => void
  onError?: (err: Error) => void
  className?: string
  bars?: number
  disabled?: boolean
  mode?: 'interactive' | 'passive'
  endSlot?: ReactNode
}

function fmtTime(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (sec % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function useAudioMeter(options: {
  stream: MediaStream | null
  smoothing?: number
  onData?: (chunk: Float32Array) => void
  enabled: boolean
}): number {
  const { stream, smoothing = 0.35, onData, enabled } = options
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const emaRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || !stream || typeof window === 'undefined') return

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    const audioCtx: AudioContext | null = AudioContextCtor ? new AudioContextCtor() : null
    if (!audioCtx) {
      console.warn('[RecordingPill] AudioContext not supported in this browser')
      return () => {}
    }

    audioCtxRef.current = audioCtx
    const src = audioCtx.createMediaStreamSource(stream)
    srcRef.current = src
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0
    analyserRef.current = analyser
    src.connect(analyser)

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const tick = () => {
      if (!analyserRef.current) return
      const analyserNode = analyserRef.current
      const sampleBuffer = new Float32Array(analyserNode.fftSize)
      analyserNode.getFloatTimeDomainData(sampleBuffer)
      let sum = 0
      for (let i = 0; i < sampleBuffer.length; i += 1) {
        const sample = sampleBuffer[i]
        sum += sample * sample
      }
      const rms = Math.sqrt(sum / sampleBuffer.length)
      const clamped = Math.min(1, Math.max(0, rms * 3))
      emaRef.current = smoothing * clamped + (1 - smoothing) * emaRef.current
      const displayLevel = prefersReducedMotion ? clamped : emaRef.current
      setLevel(displayLevel)
      if (onData) onData(sampleBuffer)
      rafRef.current = window.requestAnimationFrame(tick)
    }

    rafRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      try {
        src.disconnect()
      } catch {}
      try {
        analyser.disconnect()
      } catch {}
      try {
        audioCtx.close()
      } catch {}
      audioCtxRef.current = null
      srcRef.current = null
      analyserRef.current = null
      emaRef.current = 0
      setLevel(0)
    }
  }, [enabled, stream, smoothing, onData])

  return level
}

export function RecordingPill(props: RecordingPillProps) {
  const {
    isRecording: controlledRecording,
    defaultRecording = false,
    showTimer = true,
    maxSeconds = 120,
    allowPause = false,
    allowDiscard = true,
    waveformSource = null,
    levelSmoothing = 0.35,
    onRequestMic,
    onStart,
    onStop,
    onData,
    onError,
    className = '',
    bars,
    disabled = false,
    mode = 'interactive',
    endSlot,
  } = props

  const isControlled = typeof controlledRecording === 'boolean'
  const [internalRecording, setInternalRecording] = useState(defaultRecording)
  const isRecording = isControlled ? !!controlledRecording : internalRecording

  const [isPaused, setIsPaused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const streamRef = useRef<MediaStream | null>(waveformSource)
  const ownsStreamRef = useRef(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  const computedBars = useMemo(() => {
    if (bars && bars > 4) return bars
    const base = 18
    if (typeof window === 'undefined') return base
    try {
      const width = window.innerWidth || 1024
      if (width < 400) return 14
      if (width > 1400) return 24
      return base
    } catch {
      return base
    }
  }, [bars])

  useEffect(() => {
    if (waveformSource) {
      streamRef.current = waveformSource
      ownsStreamRef.current = false
    }
  }, [waveformSource])

  const level = useAudioMeter({
    stream: isRecording ? streamRef.current : null,
    smoothing: levelSmoothing,
    onData,
    enabled: isRecording,
  })

  useEffect(() => {
    if (!isRecording) {
      setIsSpeaking(false)
      return
    }
    const activateThreshold = 0.08
    const releaseThreshold = activateThreshold * 0.6
    setIsSpeaking((prev) => {
      if (level >= activateThreshold) return true
      if (level <= releaseThreshold) return false
      return prev
    })
  }, [isRecording, level])

  useEffect(() => {
    if (!isRecording) return
    startTimeRef.current = performance.now()
    setElapsedMs(0)
    timerRef.current = window.setInterval(() => {
      if (!startTimeRef.current) return
      const now = performance.now()
      setElapsedMs(now - startTimeRef.current)
    }, 1000)
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isRecording])

  useEffect(() => {
    if (!isRecording) return
    if (elapsedMs / 1000 >= maxSeconds) {
      stopRecording()
    }
  }, [elapsedMs, isRecording, maxSeconds])

  const acquireMic = useCallback(async () => {
    if (streamRef.current) return streamRef.current
    if (typeof window === 'undefined') throw new Error('Microphone unavailable')
    try {
      const stream = onRequestMic
        ? await onRequestMic()
        : await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      ownsStreamRef.current = !waveformSource
      return stream
    } catch (e: any) {
      const message = e?.message || 'Microphone permission denied'
      setError(message)
      onError?.(new Error(message))
      throw e
    }
  }, [onRequestMic, onError, waveformSource])

  const releaseOwnedStream = useCallback(() => {
    if (!ownsStreamRef.current || !streamRef.current) return
    const tracks = streamRef.current.getTracks()
    tracks.forEach((track) => {
      try { track.stop() } catch {}
    })
    streamRef.current = null
    ownsStreamRef.current = false
  }, [])

  const startRecording = useCallback(async () => {
    if (disabled) return
    setError(null)
    try {
      const stream = await acquireMic()
      if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder not supported')
      }
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstart = () => {
        if (!isControlled) setInternalRecording(true)
        setIsPaused(false)
        onStart?.(stream)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        const duration = elapsedMs
        chunksRef.current = []
        if (!isControlled) setInternalRecording(false)
        setIsPaused(false)
        setElapsedMs(0)
        startTimeRef.current = null
        onStop?.(blob, duration)
        releaseOwnedStream()
      }
      recorder.onerror = (event: Event & { error?: Error }) => {
        const message = event?.error?.message || 'Recording error'
        setError(message)
        onError?.(new Error(message))
      }
      recRef.current = recorder
      recorder.start(250)
    } catch (err) {
      // acquireMic already handled error state
      if (err instanceof Error) {
        console.warn('[RecordingPill] Failed to start recording', err)
      }
    }
  }, [acquireMic, disabled, elapsedMs, isControlled, onError, onStart, onStop, releaseOwnedStream])

  const stopRecording = useCallback(() => {
    const recorder = recRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (disabled) return
    if (isRecording) stopRecording()
    else startRecording()
  }, [disabled, isRecording, startRecording, stopRecording])

  const pauseOrResume = useCallback(() => {
    if (!allowPause) return
    const recorder = recRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      setIsPaused(true)
    } else if (recorder.state === 'paused') {
      recorder.resume()
      setIsPaused(false)
    }
  }, [allowPause])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      const key = event.key.toLowerCase()
      if (key === ' ' || key === 'enter' || key === 'r') {
        event.preventDefault()
        toggleRecording()
      } else if (key === 'escape' && allowDiscard && isRecording) {
        event.preventDefault()
        const recorder = recRef.current
        if (recorder && recorder.state !== 'inactive') {
          recorder.onstop = () => {
            chunksRef.current = []
            if (!isControlled) setInternalRecording(false)
            setIsPaused(false)
            setElapsedMs(0)
            startTimeRef.current = null
            releaseOwnedStream()
          }
          recorder.stop()
        }
      }
    },
    [allowDiscard, disabled, isControlled, isRecording, toggleRecording, releaseOwnedStream]
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      try {
        recRef.current?.stop()
      } catch {}
      recRef.current = null
      releaseOwnedStream()
    }
  }, [releaseOwnedStream])

  const barsArray = useMemo(() => {
    const list: number[] = []
    const now = Date.now()
    for (let i = 0; i < computedBars; i += 1) {
      const phase = Math.sin((now / 90 + i) * 0.7) * 0.5 + 0.5
      const height = Math.max(0.15, Math.min(1, level * 0.8 + phase * 0.35))
      list.push(height)
    }
    return list
  }, [level, computedBars])

  const state = error ? 'error' : isRecording ? 'recording' : 'idle'
  const ariaLabel = isRecording ? 'Stop recording' : 'Start recording'

  const barsRef = useRef<HTMLSpanElement | null>(null)
  const ariaPressedProps = useMemo(() => {
    return isRecording ? ({ 'aria-pressed': true as const } as const) : ({} as const)
  }, [isRecording])

  useEffect(() => {
    const container = barsRef.current
    if (!container) return
    const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-bar-index]'))
    elements.forEach((element, index) => {
      const value = barsArray[index] ?? 0
      element.style.setProperty('--bar-height', `${Math.round(value * 100)}%`)
    })
  }, [barsArray])

  const content = (
    <>
      <span className="recording-pill__surface">
        {showTimer && (
          <span className="recording-pill__timer" aria-live="off">
            {isRecording ? fmtTime(elapsedMs) : '00:00'}
          </span>
        )}
        <span className="recording-pill__waveform" aria-hidden="true">
          {error ? (
            <svg className="recording-pill__error-icon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 14a1 1 0 0 0 1-1V6a1 1 0 1 0-2 0v7a1 1 0 0 0 1 1Zm0 4a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 12 18Zm9.06 1.94L4.06 2.94 2.94 4.06l17 17 1.12-1.12ZM12 2a6 6 0 0 1 6 6v2.59l-2-2V8a4 4 0 1 0-8 0v.59l-2-2V8a6 6 0 0 1 6-6Z"
              />
            </svg>
          ) : (
            <span className="recording-pill__bars" ref={barsRef}>
              {Array.from({ length: computedBars }).map((_, index) => (
                <i key={index} className="recording-pill__bar" data-bar-index={index} />
              ))}
            </span>
          )}
        </span>
        {endSlot && (
          <span
            className="recording-pill__control"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {endSlot}
          </span>
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {isRecording ? 'Recording started' : 'Recording stopped'}
      </span>
      {allowPause && isRecording && (
        <span className="recording-pill__pause-indicator">{isPaused ? 'Paused' : 'Recording'}</span>
      )}
    </>
  )

  if (mode === 'passive') {
    return (
      <div
        className={['recording-pill', 'recording-pill--passive', disabled ? 'recording-pill--disabled' : '', className].filter(Boolean).join(' ')}
        data-state={state}
        data-speaking={isSpeaking ? 'true' : 'false'}
        aria-label={ariaLabel}
        role="group"
      >
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onClick={toggleRecording}
      onContextMenu={(event) => {
        if (!allowPause) return
        event.preventDefault()
        pauseOrResume()
      }}
      data-state={state}
      data-speaking={isSpeaking ? 'true' : 'false'}
      className={['recording-pill', className, disabled ? 'recording-pill--disabled' : ''].filter(Boolean).join(' ')}
      {...ariaPressedProps}
    >
      {content}
    </button>
  )
}

export default RecordingPill
