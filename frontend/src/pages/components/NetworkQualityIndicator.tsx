import { useEffect, useState } from 'react'
import { Box, Chip, Tooltip } from '@mui/material'
import { SignalWifi4Bar, SignalWifi3Bar, SignalWifi2Bar, SignalWifi1Bar, SignalWifiOff } from '@mui/icons-material'

interface NetworkQualityProps {
  peerConnection?: RTCPeerConnection
  updateInterval?: number
}

type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline'

interface QualityMetrics {
  level: QualityLevel
  rtt?: number
  packetLoss?: number
  jitter?: number
  bytesReceived?: number
  bytesSent?: number
}

const qualityConfig = {
  excellent: { 
    icon: <SignalWifi4Bar />, 
    color: '#2e7d32', 
    label: 'Excellent',
    description: 'Perfect connection quality'
  },
  good: { 
    icon: <SignalWifi3Bar />, 
    color: '#388e3c', 
    label: 'Good',
    description: 'Good connection quality'
  },
  fair: { 
    icon: <SignalWifi2Bar />, 
    color: '#f57c00', 
    label: 'Fair',
    description: 'Connection may have minor delays'
  },
  poor: { 
    icon: <SignalWifi1Bar />, 
    color: '#d32f2f', 
    label: 'Poor',
    description: 'Poor connection quality, audio may be choppy'
  },
  offline: { 
    icon: <SignalWifiOff />, 
    color: '#424242', 
    label: 'Offline',
    description: 'No connection'
  }
}

function determineQuality(stats: RTCStatsReport): QualityMetrics {
  let rtt: number | undefined
  let packetLoss: number | undefined
  let jitter: number | undefined
  let bytesReceived: number | undefined
  let bytesSent: number | undefined

  for (const [, stat] of stats) {
    if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
      rtt = stat.currentRoundTripTime * 1000 // Convert to ms
    }
    
    if (stat.type === 'inbound-rtp' && stat.mediaType === 'audio') {
      bytesReceived = stat.bytesReceived
      jitter = stat.jitter * 1000 // Convert to ms
      
      // Calculate packet loss percentage
      if (stat.packetsLost !== undefined && stat.packetsReceived !== undefined) {
        const totalPackets = stat.packetsLost + stat.packetsReceived
        packetLoss = totalPackets > 0 ? (stat.packetsLost / totalPackets) * 100 : 0
      }
    }
    
    if (stat.type === 'outbound-rtp' && stat.mediaType === 'audio') {
      bytesSent = stat.bytesSent
    }
  }

  // Determine quality level based on metrics
  let level: QualityLevel
  
  if (rtt === undefined && bytesReceived === undefined) {
    level = 'offline'
  } else {
    // Quality scoring based on RTT and packet loss
    const rttScore = rtt ? Math.max(0, 100 - (rtt / 10)) : 100
    const lossScore = packetLoss ? Math.max(0, 100 - (packetLoss * 20)) : 100
    const jitterScore = jitter ? Math.max(0, 100 - (jitter / 2)) : 100
    
    const overallScore = (rttScore + lossScore + jitterScore) / 3
    
    if (overallScore >= 90) level = 'excellent'
    else if (overallScore >= 75) level = 'good'
    else if (overallScore >= 60) level = 'fair'
    else level = 'poor'
  }

  return { level, rtt, packetLoss, jitter, bytesReceived, bytesSent }
}

export function NetworkQualityIndicator({ peerConnection, updateInterval = 2000 }: NetworkQualityProps) {
  const [metrics, setMetrics] = useState<QualityMetrics>({ level: 'offline' })

  useEffect(() => {
    if (!peerConnection) {
      setMetrics({ level: 'offline' })
      return
    }

    const updateMetrics = async () => {
      try {
        const stats = await peerConnection.getStats()
        const newMetrics = determineQuality(stats)
        setMetrics(newMetrics)
      } catch (error) {
        console.warn('Failed to get connection stats:', error)
        setMetrics({ level: 'offline' })
      }
    }

    // Initial update
    updateMetrics()

    // Set up periodic updates
    const interval = setInterval(updateMetrics, updateInterval)

    return () => clearInterval(interval)
  }, [peerConnection, updateInterval])

  const config = qualityConfig[metrics.level]
  
  const tooltipContent = (
    <Box>
      <div>{config.description}</div>
      {metrics.rtt !== undefined && <div>RTT: {metrics.rtt.toFixed(1)}ms</div>}
      {metrics.packetLoss !== undefined && <div>Loss: {metrics.packetLoss.toFixed(1)}%</div>}
      {metrics.jitter !== undefined && <div>Jitter: {metrics.jitter.toFixed(1)}ms</div>}
    </Box>
  )

  return (
    <Tooltip title={tooltipContent} arrow>
      <Chip
        icon={config.icon}
        label={config.label}
        size="small"
        sx={{
          bgcolor: `${config.color}15`,
          color: config.color,
          border: `1px solid ${config.color}40`,
          '& .MuiChip-icon': {
            color: config.color
          }
        }}
      />
    </Tooltip>
  )
}