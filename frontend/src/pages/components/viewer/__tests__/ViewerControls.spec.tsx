import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ViewerControls from '../ViewerControls'

describe('ViewerControls animation dropdown', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders animation selector when onAnimationPrompt is provided', () => {
    const onAnimationPrompt = vi.fn()
    const onClose = vi.fn()

    render(
      <ViewerControls
        onClose={onClose}
        onAnimationPrompt={onAnimationPrompt}
      />
    )

    const select = screen.getByRole('combobox', { name: /animation/i })
    expect(select).toBeDefined()
  })

  it('emits exact animation IDs from the select control', () => {
    const onAnimationPrompt = vi.fn()
    const onClose = vi.fn()

    render(
      <ViewerControls
        onClose={onClose}
        onAnimationPrompt={onAnimationPrompt}
      />
    )

    const select = screen.getByRole('combobox', { name: /animation/i })

    // Test with actual animation IDs from the manifest
    fireEvent.change(select, { target: { value: 'Walk.glb' } })
    fireEvent.change(select, { target: { value: 'Sit.glb' } })
    fireEvent.change(select, { target: { value: 'LongSit.glb' } })
    fireEvent.change(select, { target: { value: 'Stand.glb' } })

    expect(onAnimationPrompt).toHaveBeenNthCalledWith(1, 'Walk.glb')
    expect(onAnimationPrompt).toHaveBeenNthCalledWith(2, 'Sit.glb')
    expect(onAnimationPrompt).toHaveBeenNthCalledWith(3, 'LongSit.glb')
    expect(onAnimationPrompt).toHaveBeenNthCalledWith(4, 'Stand.glb')
  })

  it('does not render animation selector when onAnimationPrompt is not provided', () => {
    const onClose = vi.fn()

    render(
      <ViewerControls
        onClose={onClose}
      />
    )

    const select = screen.queryByRole('combobox', { name: /animation/i })
    expect(select).toBeNull()
  })

  it('displays promptResult when provided', () => {
    const onClose = vi.fn()
    const onAnimationPrompt = vi.fn()

    render(
      <ViewerControls
        onClose={onClose}
        onAnimationPrompt={onAnimationPrompt}
        promptResult="Animation loaded successfully"
      />
    )

    expect(screen.getByText('Animation loaded successfully')).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()

    render(
      <ViewerControls
        onClose={onClose}
      />
    )

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
