import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'

// Under test
import HumanFigure from '../HumanFigure.fixed'

describe('HumanFigure.fixed (deprecated stub)', () => {
  it('renders null and does not throw', () => {
    const { container } = render(<HumanFigure />)
    expect(container.firstChild).toBeNull()
  })
})
