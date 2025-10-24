import { Link } from 'react-router-dom'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic'
import '../styles/home.css'

interface ModeCardProps {
  title: string
  description: string
  icon: string | React.ReactNode
  to: string
  variant?: 'primary' | 'secondary' | 'accent'
}

function ModeCard({ title, description, icon, to, variant = 'primary' }: ModeCardProps) {
  return (
    <Link to={to} className={`mode-card mode-card--${variant}`}>
      <div className="mode-card__icon">
        {typeof icon === 'string' ? icon : icon}
      </div>
      <h2 className="mode-card__title">{title}</h2>
      <p className="mode-card__description">{description}</p>
      <div className="mode-card__cta">
        Launch →
      </div>
    </Link>
  )
}

export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-page__container">
        <header className="home-page__header">
          <h1 className="home-page__title bruno-ace-regular">
            <span className="home-page__brand">VSPx</span>
            <span className="home-page__subtitle">Virtual Standardized Patient Experience</span>
          </h1>
        </header>

        <div className="mode-cards">
          <ModeCard
            title="VSP-Chat"
            description="Practice conversing with virtual standardized patients to sharpen your interpersonal skills"
            icon={<HeadsetMicIcon sx={{ fontSize: 64, color: 'white' }} />}
            to="/voice"
            variant="primary"
          />
          
          <ModeCard
            title="3D Movement Analysis"
            description="Explore interactive 3D anatomical models and movement animations"
            icon={<DirectionsRunIcon sx={{ fontSize: 64, color: 'white' }} />}
            to="/3d-viewer"
            variant="secondary"
          />
        </div>

        <footer className="home-page__footer">
          <p className="home-page__note">
            All conversations use real-time voice AI. Make sure your microphone is enabled.
          </p>
        </footer>
      </div>
    </div>
  )
}
