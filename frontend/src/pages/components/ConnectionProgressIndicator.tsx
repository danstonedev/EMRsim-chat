import type { ReactElement } from 'react'
import { LinearProgress, Typography, Stack, Chip } from '@mui/material'
import './ConnectionProgressIndicator.css'
import { Mic, PlayCircle, VpnKey, Settings, CheckCircle } from '@mui/icons-material'
import ConnectionStepRow from './connection/ConnectionStepRow'

type ConnectionStep = 'mic' | 'session' | 'token' | 'webrtc' | 'complete'

interface ConnectionProgressProps {
  step: ConnectionStep
  progress: number
  estimatedMs?: number
  placeholder?: boolean
}

// Displayed steps in the modal (exclude the final "Connected!" line)
const stepOrder: ConnectionStep[] = ['mic', 'session', 'token', 'webrtc']

// UND Brand Colors
const UND_GREEN = '#009A44'

const stepConfig: Record<ConnectionStep, { label: string; subtitle: string; icon: ReactElement; color: string }> = {
  mic: {
    label: 'Microphone Access',
    subtitle: 'Requesting microphone permission and audio stream',
    icon: <Mic fontSize="small" />,
    color: UND_GREEN,
  },
  session: {
    label: 'Creating Session',
    subtitle: 'Scheduling the SPS encounter and syncing roster',
    icon: <PlayCircle fontSize="small" />,
    color: UND_GREEN,
  },
  token: {
    label: 'Voice Token',
    subtitle: 'Fetching secure credentials for realtime voice',
    icon: <VpnKey fontSize="small" />,
    color: UND_GREEN,
  },
  webrtc: {
    label: 'WebRTC Setup',
    subtitle: 'Negotiating network path and preparing audio channels',
    icon: <Settings fontSize="small" />,
    color: UND_GREEN,
  },
  complete: {
    label: 'Connected!',
    subtitle: 'Audio streams linked — you can speak now',
    icon: <CheckCircle fontSize="small" />,
    color: UND_GREEN,
  },
}

type StepStatus = 'done' | 'active' | 'pending'

export function ConnectionProgressIndicator({ step, progress, estimatedMs, placeholder = false }: ConnectionProgressProps) {
  const activeIndex = stepOrder.indexOf(step)
  const currentIndex = activeIndex === -1 ? 0 : activeIndex
  const statuses: StepStatus[] = stepOrder.map((_, idx) => {
    if (placeholder) return idx === 0 ? 'active' : 'pending'
    // When overall step is complete, mark all visible steps as done
    if (step === 'complete') return 'done'
    if (idx < currentIndex) return 'done'
    if (idx === currentIndex) return 'active'
    return 'pending'
  })

  const progressValue = Math.max(0, Math.min(100, Math.round(progress)))
  const estimatedSeconds = !placeholder && estimatedMs ? Math.ceil(estimatedMs / 1000) : null

  // container styles applied via CSS class
  const progressSx = {
    height: 6,
    borderRadius: 999,
    bgcolor: 'rgba(0,0,0,0.08)',
    '& .MuiLinearProgress-bar': {
      transition: 'transform 160ms ease',
      backgroundColor: stepConfig[step === 'complete' ? 'complete' : step].color,
      borderRadius: 999,
    },
  }
  return (
  <div className="connection-progress__container">
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
        Preparing voice session…
      </Typography>

      <LinearProgress
        variant={placeholder ? 'indeterminate' : 'determinate'}
        value={placeholder ? undefined : progressValue}
        sx={progressSx}
      />

  <div className="connection-progress__header-row">
        <Typography variant="caption" color="text.secondary">
          {placeholder ? 'Starting connection…' : `${progressValue}%`}
        </Typography>
        {estimatedSeconds && step !== 'complete' && (
          <Chip
            label={`~${estimatedSeconds}s remaining`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22, borderRadius: 999 }}
          />
        )}
  </div>

      <Stack spacing={1.25} sx={{ mt: 2 }}>
        {stepOrder.map((key, idx) => (
          <ConnectionStepRow
            key={key}
            status={statuses[idx]}
            label={stepConfig[key].label}
            subtitle={stepConfig[key].subtitle}
            icon={stepConfig[key].icon}
            baseColor={stepConfig[key].color}
            placeholder={placeholder}
            dim={idx > 0}
          />
        ))}
      </Stack>

      {!placeholder && step === 'complete' && (
  <div className="connection-progress__final-row">
          <CheckCircle fontSize="small" sx={{ color: stepConfig.complete.color }} />
          <Typography variant="body2" sx={{ color: stepConfig.complete.color, fontWeight: 600 }}>
            Ready to chat!
          </Typography>
  </div>
      )}
  </div>
  )
}