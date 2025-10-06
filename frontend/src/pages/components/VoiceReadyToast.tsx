import { useEffect, useState } from 'react'
import '../../styles/voice-ready-toast.css'

interface VoiceReadyToastProps {
  show: boolean
  onDismiss: () => void
}

export function VoiceReadyToast({ show, onDismiss }: VoiceReadyToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setVisible(true)
      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDismiss, 300) // Wait for fade-out animation
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [show, onDismiss])

  if (!show) return null

  return (
    <div className={`voice-ready-toast ${visible ? 'voice-ready-toast--visible' : ''}`}>
      <div className="voice-ready-toast__icon">🎤</div>
      <div className="voice-ready-toast__message">
        <strong>Voice Ready</strong>
        <span>You can start speaking now</span>
      </div>
    </div>
  )
}
