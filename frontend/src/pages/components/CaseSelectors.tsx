import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SearchIcon from '@mui/icons-material/Search'
import type { PersonaLite, ScenarioLite } from '../chatShared'
import { newId } from '../chatShared'

export function ScenarioPicker({ scenarios, selectedId, selectedScenario, onSelect }: { scenarios: ScenarioLite[]; selectedId: string; selectedScenario: ScenarioLite | null; onSelect: (id: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listboxIdRef = useRef(`scenario-list-${newId()}`)

  const filteredScenarios = useMemo(() => {
    if (!scenarios || !Array.isArray(scenarios)) return []
    if (!searchTerm.trim()) return scenarios
    const query = searchTerm.trim().toLowerCase()
    return scenarios.filter((scenario) => {
      const values: Array<string | null | undefined> = [
        scenario.title,
        scenario.region,
        scenario.setting,
        scenario.difficulty,
        scenario.persona_name,
        scenario.persona_headline,
      ]
      if (Array.isArray(scenario.tags)) {
        values.push(...scenario.tags)
      }
      return values.some((value) => value && value.toLowerCase().includes(query))
    })
  }, [scenarios, searchTerm])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1)
      return
    }
    if (filteredScenarios.length === 0) {
      setActiveIndex(-1)
      return
    }
    const selectedIdx = filteredScenarios.findIndex((scenario) => scenario.scenario_id === selectedId)
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0)
  }, [filteredScenarios, isOpen, selectedId])

  const handleSelect = useCallback((scenario: ScenarioLite) => {
    onSelect(scenario.scenario_id)
    setIsOpen(false)
    setSearchTerm('')
  }, [onSelect])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      if (filteredScenarios.length === 0) return
      setActiveIndex((idx) => {
        const next = idx < 0 ? 0 : (idx + 1) % filteredScenarios.length
        return next
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      if (filteredScenarios.length === 0) return
      setActiveIndex((idx) => {
        if (idx <= 0) return filteredScenarios.length - 1
        return idx - 1
      })
    } else if (event.key === 'Enter') {
      if (!isOpen) {
        setIsOpen(true)
        event.preventDefault()
        return
      }
      const option = filteredScenarios[Math.max(activeIndex, 0)]
      if (option) {
        event.preventDefault()
        handleSelect(option)
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
      }
    }
  }, [activeIndex, filteredScenarios, handleSelect, isOpen])

  const displayValue = isOpen ? searchTerm : (selectedScenario?.title ?? '')

  return (
    <div className="persona-panel scenario-panel">
      <div
        className={`persona-search scenario-search${isOpen ? ' persona-search--open scenario-search--open' : ''}`}
        ref={containerRef}
      >
        <div className="persona-search__control">
          <input
            className="persona-search__input"
            type="text"
            aria-controls={listboxIdRef.current}
            placeholder={selectedScenario ? 'Search scenarios…' : 'Select scenario…'}
            aria-label="Scenario search"
            value={displayValue}
            onFocus={() => {
              setIsOpen(true)
              setSearchTerm('')
            }}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button
            type="button"
            className="persona-search__button"
            aria-label={isOpen ? 'Close scenario list' : 'Open scenario list'}
            onClick={() => {
              setIsOpen(prev => !prev)
              if (isOpen) setSearchTerm('')
            }}
          >
            <SearchIcon fontSize="small" />
          </button>
        </div>
        {/* Subtext under scenario search removed intentionally */}
        {isOpen && (
          <div
            className="persona-search__list"
            role="listbox"
            id={listboxIdRef.current}
            aria-label="Scenario options"
          >
            {filteredScenarios.length === 0 && (
              <div className="persona-search__empty" role="option" aria-disabled="true">No scenarios found</div>
            )}
            {filteredScenarios.map((scenario, idx) => {
              const isSelected = scenario.scenario_id === selectedId
              const isActive = idx === activeIndex
              const optionAriaProps = isSelected ? { 'aria-selected': true as const } : {}
              const metaParts: string[] = []
              if (scenario.persona_name) metaParts.push(`Persona: ${scenario.persona_name}`)
              if (scenario.region) metaParts.push(scenario.region)
              if (scenario.setting) metaParts.push(scenario.setting)
              if (scenario.difficulty) metaParts.push(`Difficulty: ${scenario.difficulty}`)
              if (scenario.tags && scenario.tags.length) {
                metaParts.push(scenario.tags.slice(0, 2).join(', '))
              }
              const metaText = metaParts.join(' · ')
              return (
                <button
                  type="button"
                  key={scenario.scenario_id}
                  id={`scenario-option-${scenario.scenario_id}`}
                  role="option"
                  className={`persona-search__option${isSelected ? ' persona-search__option--selected' : ''}${isActive ? ' persona-search__option--active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(scenario)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  {...optionAriaProps}
                >
                  <span className="scenario-option__title">{scenario.title}</span>
                  {metaText && <span className="scenario-option__meta">{metaText}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function PersonaPicker({ personas, selectedId, selectedPersona, onSelect }: { personas: PersonaLite[]; selectedId: string | null; selectedPersona: PersonaLite | null; onSelect: (id: string | null) => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listboxIdRef = useRef(`persona-list-${newId()}`)

  const filteredPersonas = useMemo(() => {
    if (!personas || !Array.isArray(personas)) return []
    if (!searchTerm.trim()) return personas
    const query = searchTerm.trim().toLowerCase()
    return personas.filter(persona => {
      if (!persona) return false
      const values: Array<string | null | undefined> = [
        persona.display_name,
        persona.headline,
        persona.voice,
        persona.sex,
        persona.id,
      ]
      if (Array.isArray(persona.tags)) values.push(...persona.tags)
      return values.some(value => value && value.toLowerCase().includes(query))
    })
  }, [personas, searchTerm])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1)
      return
    }
    if (filteredPersonas.length === 0) {
      setActiveIndex(-1)
      return
    }
    const selectedIdx = filteredPersonas.findIndex(p => p.id === selectedId)
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0)
  }, [filteredPersonas, isOpen, selectedId])

  const handleSelect = useCallback((persona: PersonaLite) => {
    onSelect(persona.id)
    setIsOpen(false)
    setSearchTerm('')
  }, [onSelect])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      if (filteredPersonas.length === 0) return
      setActiveIndex(idx => {
        const next = idx < 0 ? 0 : (idx + 1) % filteredPersonas.length
        return next
      })
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      if (filteredPersonas.length === 0) return
      setActiveIndex(idx => {
        if (idx <= 0) return filteredPersonas.length - 1
        return idx - 1
      })
    } else if (event.key === 'Enter') {
      if (!isOpen) {
        setIsOpen(true)
        event.preventDefault()
        return
      }
      const option = filteredPersonas[Math.max(activeIndex, 0)]
      if (option) {
        event.preventDefault()
        handleSelect(option)
      }
    } else if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault()
        setIsOpen(false)
        setSearchTerm('')
      }
    }
  }, [activeIndex, filteredPersonas, handleSelect, isOpen])

  const displayValue = isOpen ? searchTerm : (selectedPersona?.display_name ?? '')

  return (
    <div className="persona-panel">
      <div className={`persona-search ${isOpen ? 'persona-search--open' : ''}`} ref={containerRef}>
        <div className="persona-search__control">
          <input
            className="persona-search__input"
            type="text"
            aria-controls={listboxIdRef.current}
            placeholder={selectedPersona ? 'Search personas…' : 'Select persona…'}
            aria-label="Persona search"
            value={displayValue}
            onFocus={() => {
              setIsOpen(true)
              setSearchTerm('')
            }}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button
            type="button"
            className="persona-search__button"
            aria-label={isOpen ? 'Close persona list' : 'Open persona list'}
            onClick={() => {
              setIsOpen(prev => !prev)
              if (isOpen) setSearchTerm('')
            }}
          >
            <SearchIcon fontSize="small" />
          </button>
        </div>
        {/* Subtext under persona search removed intentionally */}
        {isOpen && (
          <div
            className="persona-search__list"
            role="listbox"
            id={listboxIdRef.current}
            aria-label="Persona options"
          >
            {filteredPersonas.length === 0 && (
              <div className="persona-search__empty" role="option" aria-disabled="true">No personas found</div>
            )}
            {filteredPersonas.map((persona, idx) => {
              const isSelected = persona.id === selectedId
              const isActive = idx === activeIndex
              const optionAriaProps = isSelected ? { 'aria-selected': true as const } : {}
              const headline = persona.headline ? persona.headline.trim() : ''
              const metaParts: string[] = []
              if (persona.voice) metaParts.push(`Voice: ${persona.voice}`)
              if (persona.tags && persona.tags.length) metaParts.push(persona.tags.slice(0, 3).join(', '))
              return (
                <button
                  type="button"
                  key={persona.id}
                  id={`persona-option-${persona.id}`}
                  role="option"
                  className={`persona-search__option${isSelected ? ' persona-search__option--selected' : ''}${isActive ? ' persona-search__option--active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(persona)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  {...optionAriaProps}
                >
                  <span className="persona-option__name">{persona.display_name}</span>
                  {headline && <span className="persona-option__headline">{headline}</span>}
                  {metaParts.length > 0 && (
                    <span className="persona-option__meta">{metaParts.join(' · ')}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
