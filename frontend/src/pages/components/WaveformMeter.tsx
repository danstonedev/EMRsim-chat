import { useEffect, useMemo, useRef } from 'react'

interface WaveformMeterProps {
  level?: number
  stream?: MediaStream | null
  barCount?: number
  height?: number
  className?: string
  isPaused?: boolean
}

/**
 * A lightweight waveform-style meter that renders symmetrical bars driven by the
 * most recent microphone level. The component smooths level changes to avoid
 * jitter while still feeling responsive.
 */
export function WaveformMeter({
  level,
  stream,
  barCount = 24,
  height = 36,
  className,
  isPaused = false,
}: WaveformMeterProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const levelRef = useRef(0)
  const rafRef = useRef<number>(0)
  const previousHeightsRef = useRef<number[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sampleRafRef = useRef<number>(0)

  const useExternalLevel = !stream

  useEffect(() => {
    if (!useExternalLevel) return
    levelRef.current = Number.isFinite(level ?? 0) ? Math.min(1, Math.max(0, level ?? 0)) : 0
  }, [level, useExternalLevel])

  const bars = useMemo(() => Array.from({ length: Math.max(4, barCount) }, (_, i) => i), [barCount])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.style.setProperty('--waveform-height', `${height}px`)
  }, [height])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.style.setProperty('--waveform-bar-count', `${Math.max(4, barCount)}`)
  }, [barCount])

  useEffect(() => {
    if (!stream) {
      if (sampleRafRef.current) {
        cancelAnimationFrame(sampleRafRef.current)
        sampleRafRef.current = 0
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null
      if (!useExternalLevel) {
        levelRef.current = 0
      }
      return
    }

    try {
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.86
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioCtx
      analyserRef.current = analyser
      const buffer = new Uint8Array(analyser.frequencyBinCount)

      const sample = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i += 1) {
          const centered = (buffer[i] - 128) / 128
          sum += centered * centered
        }
        const rms = Math.sqrt(sum / buffer.length)
        levelRef.current = Math.min(1, Math.max(0, rms))
        sampleRafRef.current = window.requestAnimationFrame(sample)
      }

      sampleRafRef.current = window.requestAnimationFrame(sample)

      return () => {
        if (sampleRafRef.current) {
          cancelAnimationFrame(sampleRafRef.current)
          sampleRafRef.current = 0
        }
        try { source.disconnect() } catch {}
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {})
          audioContextRef.current = null
        }
        analyserRef.current = null
      }
    } catch (error) {
      console.warn('[WaveformMeter] Failed to analyze stream', error)
    }
  }, [stream, useExternalLevel])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const elements = Array.from(container.querySelectorAll<HTMLDivElement>('[data-bar-index]'))
    if (!elements.length) return

    const totalBars = elements.length
    const centerIndex = (totalBars - 1) / 2
    const previous = (previousHeightsRef.current = new Array(totalBars).fill(0))

    const render = () => {
      const targetLevel = levelRef.current
      const decay = isPaused ? 0.12 : 0.22
      const jitterStrength = isPaused ? 0.02 : 0.05

      for (let i = 0; i < totalBars; i += 1) {
        const element = elements[i]
        const distanceFromCenter = Math.abs(i - centerIndex) / (centerIndex || 1)
        const envelope = 0.35 + (1 - Math.pow(distanceFromCenter, 1.8)) * 0.65
        const jitter = (Math.random() - 0.5) * jitterStrength
        const goal = Math.max(0.05, Math.min(1, (targetLevel + jitter) * envelope))
        const eased = previous[i] + (goal - previous[i]) * decay
        previous[i] = eased
        element.style.setProperty('--waveform-bar-scale', eased.toFixed(4))
        element.style.setProperty('--waveform-bar-opacity', (0.4 + envelope * 0.6).toFixed(3))
      }

      rafRef.current = window.requestAnimationFrame(render)
    }

    rafRef.current = window.requestAnimationFrame(render)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [barCount, isPaused])

  return (
    <div
      ref={containerRef}
      className={['waveform-meter', className].filter(Boolean).join(' ')}
      data-paused={isPaused ? 'true' : 'false'}
      aria-hidden="true"
    >
      {bars.map((index) => (
        <div key={index} className="waveform-meter__bar" data-bar-index={index} />
      ))}
    </div>
  )
}
