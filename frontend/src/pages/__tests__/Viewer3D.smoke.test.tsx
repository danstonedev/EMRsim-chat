import { render, screen } from '@testing-library/react'

// Mock router hooks used by Viewer3D
vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  useSearchParams: () => [new URLSearchParams(''), () => {}],
}))

// Mock r3f Canvas to avoid requiring a real WebGL context in jsdom
vi.mock('@react-three/fiber', async () => {
  const React = await import('react')
  return {
    Canvas: ({ children }: any) => React.createElement('div', { 'data-testid': 'canvas-mock' }, children),
  }
})

// Mock the heavy 3D Scene to a simple placeholder so we only test page wiring
vi.mock('../components/viewer/Scene', () => ({
  __esModule: true,
  default: () => <div data-testid="scene-mock">Scene</div>,
}))

import Viewer3D from '../Viewer3D'

describe('Viewer3D page (smoke)', () => {
  it('renders header, canvas, and scene placeholder', () => {
    render(<Viewer3D />)
    // Header from ViewerControls
    expect(screen.getByText('3D Anatomy Viewer')).toBeTruthy()
    // Canvas mock wrapper
    expect(screen.getByTestId('canvas-mock')).toBeTruthy()
    // Scene placeholder
    expect(screen.getByTestId('scene-mock')).toBeTruthy()
  })
})
