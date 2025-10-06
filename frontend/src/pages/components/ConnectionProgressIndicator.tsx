import { LinearProgress, Box, Typography, Stack, Chip } from '@mui/material'
import { Mic, PlayCircle, VpnKey, Settings, CheckCircle } from '@mui/icons-material'

interface ConnectionProgressProps {
  step: 'mic' | 'session' | 'token' | 'webrtc' | 'complete'
  progress: number
  estimatedMs?: number
}

const stepConfig = {
  mic: { label: 'Microphone Access', icon: <Mic fontSize="small" />, color: '#1976d2' },
  session: { label: 'Creating Session', icon: <PlayCircle fontSize="small" />, color: '#388e3c' },
  token: { label: 'Voice Token', icon: <VpnKey fontSize="small" />, color: '#f57c00' },
  webrtc: { label: 'WebRTC Setup', icon: <Settings fontSize="small" />, color: '#7b1fa2' },
  complete: { label: 'Connected!', icon: <CheckCircle fontSize="small" />, color: '#2e7d32' }
}

export function ConnectionProgressIndicator({ step, progress, estimatedMs }: ConnectionProgressProps) {
  const config = stepConfig[step]
  
  return (
    <Box sx={{ width: '100%', maxWidth: 400, p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Box sx={{ color: config.color }}>{config.icon}</Box>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {config.label}
        </Typography>
        {estimatedMs && step !== 'complete' && (
          <Chip 
            label={`~${Math.ceil(estimatedMs / 1000)}s`} 
            size="small" 
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        )}
      </Stack>
      
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ 
          height: 6, 
          borderRadius: 3,
          bgcolor: 'rgba(0,0,0,0.1)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: config.color,
            borderRadius: 3
          }
        }} 
      />
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {progress}%
        </Typography>
        {step === 'complete' && (
          <Typography variant="caption" sx={{ color: config.color, fontWeight: 500 }}>
            Ready to chat!
          </Typography>
        )}
      </Box>
    </Box>
  )
}