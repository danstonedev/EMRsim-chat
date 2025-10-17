import { useEffect, useRef } from 'react'
import type { MediaReference } from '../../../shared/types'
// Re-export MediaReference so other modules importing from this file can resolve the type
export type { MediaReference } from '../../../shared/types'

interface MediaModalProps {
  media: MediaReference | null
  isOpen: boolean
  onClose: () => void
}

// Helper to extract YouTube video ID and convert to embed URL
function getYouTubeEmbedUrl(url: string): string {
  // Handle youtube.com/watch?v=ID
  const watchMatch = url.match(/[?&]v=([^&]+)/)
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`
  }
  
  // Handle youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([^?]+)/)
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`
  }
  
  // Handle youtube.com/embed/ID (already embed format)
  const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/)
  if (embedMatch) {
    return url
  }
  
  // Fallback: assume URL is already correct
  return url
}

// Helper to extract YouTube video ID for thumbnails
export function getYouTubeVideoId(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([^&]+)/)
  if (watchMatch) return watchMatch[1]
  
  const shortMatch = url.match(/youtu\.be\/([^?]+)/)
  if (shortMatch) return shortMatch[1]
  
  const embedMatch = url.match(/youtube\.com\/embed\/([^?]+)/)
  if (embedMatch) return embedMatch[1]
  
  return null
}

// Helper to get YouTube thumbnail URL
export function getYouTubeThumbnail(url: string): string {
  const videoId = getYouTubeVideoId(url)
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  }
  return ''
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
          ) : media.type === 'youtube' ? (
            <div className="media-modal-youtube-container">
              <iframe
                src={getYouTubeEmbedUrl(media.url)}
                className="media-modal-youtube"
                title={media.caption}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : media.type === 'video' ? (
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
          ) : media.type === 'animation' ? (
            <div className="media-modal-fallback">Animation now opens in the 3D overlay.</div>
          ) : null}
        </div>

        {media.caption && media.type !== 'animation' && (
          <div className="media-modal-caption">
            <span className="media-modal-caption-icon">
              {media.type === 'youtube' ? '📺' : media.type === 'video' ? '🎥' : '📷'}
            </span>
            {media.caption}
          </div>
        )}
      </div>
    </div>
  )
}

// Lazy load the chat animation player to avoid pulling three.js unless needed
// No longer embedding Viewer3D inside the modal to avoid conflicts
