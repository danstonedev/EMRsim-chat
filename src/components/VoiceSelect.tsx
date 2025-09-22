'use client'
/* eslint-disable jsx-a11y/aria-proptypes */

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  voices: readonly string[]
  value: string
  onChange: (v: string) => void
  ariaLabel?: string
}

export default function VoiceSelect({ voices, value, onChange, ariaLabel = 'Voice' }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(() => Math.max(0, voices.indexOf(value)))

  useEffect(() => {
    setActiveIndex(Math.max(0, voices.indexOf(value)))
  }, [value, voices])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return
      const t = e.target as Node
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onItemKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(voices.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Home') {
      e.preventDefault(); setActiveIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault(); setActiveIndex(voices.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onChange(voices[idx])
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault(); setOpen(false); triggerRef.current?.focus()
    }
  }

  const selected = useMemo(() => value, [value])

  return (
    <div className="voice-select">
      <button
        ref={triggerRef}
        type="button"
        className={`voice-select-trigger ${open ? 'open' : ''}`}
  aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleTriggerKey}
        title={ariaLabel}
      >
        <span className="voice-select-value">{selected}</span>
        <svg className="voice-select-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          role="listbox"
          className="voice-select-menu"
          aria-label={ariaLabel}
        >
          {voices.map((v, idx) => {
            const isSelected = v === value
            const active = idx === activeIndex
            if (isSelected) {
              return (
                <div
                  key={v}
                  role="option"
                  aria-selected="true"
                  tabIndex={0}
                  className={`voice-select-item selected ${active ? 'active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => { onChange(v); setOpen(false); triggerRef.current?.focus() }}
                  onKeyDown={(e) => onItemKeyDown(e, idx)}
                >
                  {v}
                </div>
              )
            }
            return (
              <div
                key={v}
                role="option"
                tabIndex={0}
                className={`voice-select-item ${active ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => { onChange(v); setOpen(false); triggerRef.current?.focus() }}
                onKeyDown={(e) => onItemKeyDown(e, idx)}
              >
                {v}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
