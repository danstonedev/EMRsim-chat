import type { ReactElement } from 'react'
import { Stack, Typography, CircularProgress } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { CheckCircle } from '@mui/icons-material'

type StepStatus = 'done' | 'active' | 'pending'

export interface ConnectionStepRowProps {
  status: StepStatus
  label: string
  subtitle: string
  icon: ReactElement
  baseColor: string
  placeholder?: boolean
  dim?: boolean
}

export function ConnectionStepRow({
  status,
  label,
  subtitle,
  icon,
  baseColor,
  placeholder = false,
  dim = false,
}: ConnectionStepRowProps) {
  const textColor = status === 'pending' ? 'text.secondary' : 'text.primary'
  const subtitleColor = status === 'pending' ? 'text.disabled' : 'text.secondary'

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="flex-start"
      sx={{
        opacity: placeholder && dim ? 0.75 : 1,
        transition: 'opacity 140ms ease',
      }}
    >
      <div className={`connection-progress__icon-holder is-${status}`}>
        <div className="connection-progress__icon-circle" aria-hidden>
          {icon}
        </div>
        {!placeholder && status === 'active' && (
          <CircularProgress
            size={38}
            thickness={4.2}
            sx={{
              position: 'absolute',
              top: -1,
              left: -1,
              color: alpha(baseColor, 0.55),
            }}
          />
        )}
        {!placeholder && status === 'done' && (
          <CheckCircle
            fontSize="small"
            sx={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              color: baseColor,
              bgcolor: 'background.paper',
              borderRadius: '50%',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.8)',
            }}
          />
        )}
      </div>

      <div className="connection-progress__label-box">
        <Typography
          variant="body2"
          sx={{
            fontWeight: status === 'active' ? 600 : 500,
            color: textColor,
            lineHeight: 1.25,
            transition: 'color 160ms ease',
          }}
        >
          {label}
        </Typography>
        <Typography variant="caption" color={subtitleColor} sx={{ display: 'block', lineHeight: 1.3 }}>
          {subtitle}
        </Typography>
      </div>
    </Stack>
  )
}

export default ConnectionStepRow
