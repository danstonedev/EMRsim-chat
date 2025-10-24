import type { MouseEvent, PropsWithChildren, ReactNode } from 'react'
import { DRAWER_STYLES } from './drawerStyles'

type AdvancedSettingsLayoutProps = PropsWithChildren<{
  open: boolean
  onClose: () => void
  footer: ReactNode
}>

export function AdvancedSettingsLayout({ open, onClose, footer, children }: AdvancedSettingsLayoutProps) {
  if (!open) {
    return null
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) {
      onClose()
    }
  }

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-label="Advanced settings" onClick={handleOverlayClick}>
      <div className="drawer" role="document">
        {children}
        <footer className="drawer-footer">{footer}</footer>
      </div>
      <style>{DRAWER_STYLES}</style>
    </div>
  )
}
