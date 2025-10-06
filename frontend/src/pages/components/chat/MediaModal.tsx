import { useEffect, useRef } from 'react'

export interface MediaReference {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnail?: string
  caption: string
}

interface MediaModalProps {
  media: MediaReference | null
  isOpen: boolean
  onClose: () => void
}

export function MediaModal({ media, isOpen, onClose }: MediaModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Pause video when modal closes
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause()
    }
  }, [isOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !media) return null

  return (
    <div
      className="media-modal-overlay"
      onClick={onClose}
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label="Clinical observation media"
    >
      <div
        className="media-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="media-modal-close"
          onClick={onClose}
          aria-label="Close media viewer"
          title="Close (Esc)"
        >
          ×
        </button>

        <div className="media-modal-body">
          {media.type === 'image' ? (
            <img
              src={media.url}
              alt={media.caption}
              className="media-modal-image"
            />
          ) : (
            <video
              ref={videoRef}
              src={media.url}
              controls
              autoPlay
              className="media-modal-video"
              aria-label={media.caption}
            >
              Your browser does not support video playback.
            </video>
          )}
        </div>

        {media.caption && (
          <div className="media-modal-caption">
            <span className="media-modal-caption-icon">
              {media.type === 'video' ? '🎥' : '📷'}
            </span>
            {media.caption}
          </div>
        )}
      </div>
    </div>
  )
}
