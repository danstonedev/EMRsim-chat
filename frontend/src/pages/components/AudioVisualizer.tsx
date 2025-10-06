import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'

interface AudioVisualizerProps {
  stream?: MediaStream
  isActive?: boolean
  height?: number
  barCount?: number
}

export function AudioVisualizer({ 
  stream, 
  isActive = false, 
  height = 60, 
  barCount = 12 
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const analyzerRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!stream || !isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyzerRef.current = null
      return
    }

    try {
      const audioContext = new AudioContext()
      const analyzer = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      
      analyzer.fftSize = 128
      analyzer.smoothingTimeConstant = 0.85
      source.connect(analyzer)
      
      audioContextRef.current = audioContext
      analyzerRef.current = analyzer
      
      const dataArray = new Uint8Array(analyzer.frequencyBinCount)
      
      const animate = () => {
        if (!analyzerRef.current || !canvasRef.current) return
        
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        
        analyzerRef.current.getByteFrequencyData(dataArray)
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        // Draw bars
        const barWidth = canvas.width / barCount
        const maxBarHeight = canvas.height - 4
        
        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * dataArray.length)
          const amplitude = dataArray[dataIndex] / 255
          const barHeight = Math.max(3, amplitude * maxBarHeight)
          
          const x = i * barWidth + barWidth * 0.15
          const y = canvas.height - barHeight
          const width = barWidth * 0.7
          
          // Color based on amplitude
          const hue = 120 + (amplitude * 60) // Green to yellow/orange
          const saturation = 70 + (amplitude * 20)
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, 50%)`
          ctx.fillRect(x, y, width, barHeight)
        }
        
        animationRef.current = requestAnimationFrame(animate)
      }
      
      animate()
      
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
          animationRef.current = null
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {})
          audioContextRef.current = null
        }
        analyzerRef.current = null
      }
    } catch (error) {
      console.error('[AudioVisualizer] Setup failed:', error)
    }
  }, [stream, isActive, barCount])

  if (!isActive) {
    return (
      <Box 
        sx={{ 
          height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: 'rgba(0,0,0,0.05)',
          borderRadius: 1,
          border: '1px dashed rgba(0,0,0,0.2)'
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Audio visualization disabled
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        component="canvas"
        ref={canvasRef}
        width={300}
        height={height}
        sx={{ 
          width: '100%', 
          height: `${height}px`,
          borderRadius: 1,
          backgroundColor: 'rgba(0,0,0,0.02)'
        }}
      />
      <Typography 
        variant="caption" 
        sx={{ 
          position: 'absolute', 
          bottom: 2, 
          right: 4, 
          color: 'rgba(0,0,0,0.4)',
          fontSize: '0.6rem'
        }}
      >
        LIVE
      </Typography>
    </Box>
  )
}