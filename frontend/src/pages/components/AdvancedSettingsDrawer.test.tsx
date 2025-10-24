import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import AdvancedSettingsDrawer from './AdvancedSettingsDrawer'
import { SettingsProvider } from '../../shared/settingsContext'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>
}

describe('AdvancedSettingsDrawer', () => {
  afterEach(cleanup)

  it('renders when open and shows sections', () => {
    render(
      <Wrapper>
        <AdvancedSettingsDrawer open={true} onClose={() => {}} />
      </Wrapper>
    )
    expect(screen.getByRole('dialog', { name: /Advanced settings/i })).toBeTruthy()
    expect(screen.getByText(/Voice & language/i)).toBeTruthy()
  })

  it('does not render when closed', () => {
    render(
      <Wrapper>
        <AdvancedSettingsDrawer open={false} onClose={() => {}} />
      </Wrapper>
    )
    expect(screen.queryByRole('dialog', { name: /Advanced settings/i })).toBeNull()
  })
})
