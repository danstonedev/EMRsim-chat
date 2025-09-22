'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import PauseRoundedIcon from '@mui/icons-material/PauseRounded'
import StopRoundedIcon from '@mui/icons-material/StopRounded'
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded'
import CircularProgress from '@mui/material/CircularProgress'
import LogoWhite from '../../img/EMRsim-chat_white.png'

interface Message {
  id: number
  text: string
  sender: 'user' | 'assistant' | 'system'
  timestamp: Date
}

export default function ChatInterface() {
  // Supported OpenAI TTS voices (per API error list)
  const SUPPORTED_CLOUD_VOICES = [
    'alloy','echo','fable','onyx','nova','shimmer','coral','verse','ballad','ash','sage','marin','cedar'
  ] as const
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  // Initialize with safe defaults; load from localStorage after mount
  const [systemPrompt, setSystemPrompt] = useState<string>(
    'You are UND Assistant, a helpful, concise, and friendly assistant for the University of North Dakota. Be accurate and cite UND context when possible.'
  )
  // Theme state - initialize from DOM (set pre-paint in layout) to avoid flash/mismatch
  const [theme, setTheme] = useState<string>(() => {
    if (typeof document !== 'undefined') {
      const fromDom = document.documentElement.getAttribute('data-theme')
      if (fromDom === 'dark' || fromDom === 'light') return fromDom
      // Fallback to system preference if DOM not set (should be rare)
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    }
    return 'light'
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const hydratedRef = useRef(false)
  // SSR-stable default; load preference after mount to avoid hydration mismatch
  const [controlsOpen, setControlsOpen] = useState<boolean>(true)
  const threadRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Voice state
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaChunksRef = useRef<Blob[]>([])
  const [autoSpeak, setAutoSpeak] = useState(false)
  const lastReplyRef = useRef<string>('')
  // Mic status indicator
  const [micStatus, setMicStatus] = useState<'idle' | 'listening' | 'stopped'>('idle')
  const micStatusTimerRef = useRef<number | null>(null)
  // TTS controls
  // SSR-stable defaults; load preferences after mount
  const [cloudVoice, setCloudVoice] = useState<string>('alloy')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const lastAudioUrlRef = useRef<string>('')
  const audioCacheRef = useRef<Map<string, string>>(new Map())
  const [loadingByMessage, setLoadingByMessage] = useState<Record<number, boolean>>({})
  const [currentTtsKey, setCurrentTtsKey] = useState<string>('')
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const audioEventsBoundRef = useRef<boolean>(false)

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)

    // Auto-resize textarea back to single line
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const history = messages.map(m => ({
        role: m.sender,
        content: m.text
      })).filter(m => m.role !== 'system') as Array<{ role: 'user' | 'assistant'; content: string }>

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          systemPrompt,
          history
        })
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const data = await res.json() as { reply?: string; error?: string }
      const text = data.reply ?? data.error ?? 'Sorry, I could not generate a response.'

      const botMessage: Message = {
        id: messages.length + 2,
        text,
        sender: 'assistant',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
      lastReplyRef.current = text
  if (autoSpeak) playMessage(text, botMessage.id)
    } catch (error) {
      const errorMessage: Message = {
        id: messages.length + 2,
        text: "Sorry, I encountered an error. Please try again.",
        sender: 'system',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  // Text-to-speech
  const speakText = async (text: string) => {
    try {
      // Cloud TTS via API
      const safeVoice = SUPPORTED_CLOUD_VOICES.includes(cloudVoice as any) ? cloudVoice : 'alloy'
      const key = `${safeVoice}|${text}`
      let url = audioCacheRef.current.get(key)
      if (!url) {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: safeVoice, format: 'mp3' })
        })
        if (!res.ok) {
          let msg = `TTS request failed (${res.status})`
          try {
            const j = await res.json()
            if (j?.error) msg += `: ${j.error}`
          } catch {}
          console.error(msg)
          throw new Error('TTS request failed')
        }
        const blob = await res.blob()
        url = URL.createObjectURL(blob)
        audioCacheRef.current.set(key, url)
      }
      if (!audioRef.current) audioRef.current = new Audio()
      if (!audioEventsBoundRef.current && audioRef.current) {
        audioRef.current.addEventListener('play', () => setIsSpeaking(true))
        audioRef.current.addEventListener('pause', () => setIsSpeaking(false))
        audioRef.current.addEventListener('ended', () => setIsSpeaking(false))
        audioEventsBoundRef.current = true
      }
      try {
        if (lastAudioUrlRef.current) URL.revokeObjectURL(lastAudioUrlRef.current)
      } catch {}
      lastAudioUrlRef.current = url
      const audio = audioRef.current
      try { audio.pause(); audio.currentTime = 0 } catch {}
      audio.src = url
      setCurrentTtsKey(`cloud|${safeVoice}|${text}`)
      await audio.play()
      return
    } catch {}
  }

  // Playback controls
  const startSpeaking = async () => {
    const text = lastReplyRef.current
    if (!text) return
    // If audio exists, resume/play; otherwise fetch via speakText
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    if (!audio.src) {
      await speakText(text)
      return
    }
    try { await audio.play() } catch { await speakText(text) }
  }

  const pauseSpeaking = () => {
    const audio = audioRef.current
    if (audio) { try { audio.pause() } catch {} }
  }

  const stopSpeaking = () => {
    const audio = audioRef.current
    if (audio) {
      try { audio.pause(); audio.currentTime = 0 } catch {}
    }
  }

  const restartSpeaking = async () => {
    const text = lastReplyRef.current
    if (!text) return
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    if (audio.src) {
      try { audio.pause(); audio.currentTime = 0; await audio.play(); return } catch {}
    }
    await speakText(text)
  }

  // Play a specific message text with optional loading indicator
  const playMessage = async (text: string, messageId?: number) => {
    const safeVoice = SUPPORTED_CLOUD_VOICES.includes(cloudVoice as any) ? cloudVoice : 'alloy'
    const key = `${safeVoice}|${text}`
    let url = audioCacheRef.current.get(key)
    const needsFetch = !url
    if (needsFetch && messageId) setLoadingByMessage(prev => ({ ...prev, [messageId]: true }))
    try {
      if (!url) {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: safeVoice, format: 'mp3' })
        })
        if (!res.ok) {
          let msg = `TTS request failed (${res.status})`
          try {
            const j = await res.json()
            if (j?.error) msg += `: ${j.error}`
          } catch {}
          console.error(msg)
          throw new Error('TTS request failed')
        }
        const blob = await res.blob()
        url = URL.createObjectURL(blob)
        audioCacheRef.current.set(key, url)
      }
      if (!audioRef.current) audioRef.current = new Audio()
      if (!audioEventsBoundRef.current && audioRef.current) {
        audioRef.current.addEventListener('play', () => setIsSpeaking(true))
        audioRef.current.addEventListener('pause', () => setIsSpeaking(false))
        audioRef.current.addEventListener('ended', () => setIsSpeaking(false))
        audioEventsBoundRef.current = true
      }
      const audio = audioRef.current
      try { audio.pause(); audio.currentTime = 0 } catch {}
      audio.src = url as string
      setCurrentTtsKey(`cloud|${safeVoice}|${text}`)
      await audio.play()
    } catch (e) {
      // Prevent unhandled promise rejection and surface detail to console
      console.error('playMessage error:', e)
    } finally {
      if (messageId) setLoadingByMessage(prev => ({ ...prev, [messageId]: false }))
    }
  }

  const restartSpeakingForText = async (text: string, messageId?: number) => {
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    if (audio.src) {
      try { audio.pause(); audio.currentTime = 0; await audio.play(); return } catch {}
    }
    await playMessage(text, messageId)
  }

  // Start Web Speech API recognition if available; fallback to MediaRecorder => /api/transcribe
  const startVoiceInput = async () => {
    if (isRecording) return
    setMicStatus('listening')

    // Prefer Web Speech API for streaming dictation
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    if (SR) {
      try {
        const rec = new SR()
        rec.lang = navigator.language || 'en-US'
        rec.continuous = false
        rec.interimResults = true
        setIsRecording(true)

        rec.onresult = (ev: any) => {
          let finalText = ''
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const res = ev.results[i]
            if (res.isFinal) {
              finalText += res[0].transcript
            }
          }
          if (finalText.trim()) {
            setInputValue(prev => prev ? prev + ' ' + finalText.trim() : finalText.trim())
          }
        }
        const markStopped = () => {
          setIsRecording(false)
          setMicStatus('stopped')
          if (micStatusTimerRef.current) window.clearTimeout(micStatusTimerRef.current)
          micStatusTimerRef.current = window.setTimeout(() => setMicStatus('idle'), 1500)
        }
        rec.onerror = () => { markStopped() }
        rec.onend = () => { markStopped() }
        rec.start()
        return
      } catch {
        // fall through to MediaRecorder
      }
    }

    // Fallback: record short clip and send to /api/transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      mediaChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        setIsRecording(false)
        setMicStatus('stopped')
        if (micStatusTimerRef.current) window.clearTimeout(micStatusTimerRef.current)
        micStatusTimerRef.current = window.setTimeout(() => setMicStatus('idle'), 1500)
        try {
          const blob = new Blob(mediaChunksRef.current, { type: 'audio/webm' })
          const form = new FormData()
          form.append('audio', blob, 'clip.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: form })
          const data = await res.json() as { text?: string; error?: string }
          const txt = data.text || data.error || ''
          if (txt) setInputValue(prev => prev ? prev + ' ' + txt : txt)
        } catch {}
        finally {
          stream.getTracks().forEach(t => t.stop())
        }
      }
      mr.start()
      setIsRecording(true)
      setMicStatus('listening')
    } catch (e) {
      console.error('Microphone error:', e)
    }
  }

  const stopVoiceInput = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    // If using Web Speech API, there's no reference; stopping relies on the instance
    // For simplicity, we rely on end of speech; otherwise use MediaRecorder path
    if (mediaRecorderRef.current && isRecording) {
      try { mediaRecorderRef.current.stop() } catch {}
    }
    setIsRecording(false)
    setMicStatus('stopped')
    if (micStatusTimerRef.current) window.clearTimeout(micStatusTimerRef.current)
    micStatusTimerRef.current = window.setTimeout(() => setMicStatus('idle'), 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    
    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (threadRef.current) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: behavior as ScrollBehavior })
    }
  }, [messages, isTyping])

  // Load saved preferences on mount and mark hydrated
  useEffect(() => {
    console.log('🚀 useEffect (mount) called');
    
    if (typeof window !== 'undefined') {
      console.log('🌍 Window is available, loading preferences');
      
      const savedPrompt = window.localStorage.getItem('und_system_prompt')
      console.log('💾 Saved prompt from localStorage:', savedPrompt);
      if (savedPrompt) setSystemPrompt(savedPrompt)

      const savedTheme = window.localStorage.getItem('chat-theme') || 'light'
      console.log('🎨 Saved theme from localStorage:', savedTheme);
      console.log('🎨 Current theme state before update:', theme);
      
      // Update DOM immediately with correct theme
      if (typeof document !== 'undefined') {
        console.log('🏷️ Setting initial data-theme attribute to:', savedTheme);
        document.documentElement.setAttribute('data-theme', savedTheme)
      }
      
      setTheme(savedTheme)
      console.log('🎨 Theme state updated to:', savedTheme);
      
      // Load TTS prefs (Cloud-only)
      try {
        const savedControls = window.localStorage.getItem('chat-controls-open')
        if (savedControls === 'true' || savedControls === 'false') setControlsOpen(savedControls === 'true')
        const savedCloudVoice = window.localStorage.getItem('chat-tts-cloud-voice')
        if (savedCloudVoice && SUPPORTED_CLOUD_VOICES.includes(savedCloudVoice as any)) {
          setCloudVoice(savedCloudVoice)
        } else if (savedCloudVoice && !SUPPORTED_CLOUD_VOICES.includes(savedCloudVoice as any)) {
          setCloudVoice('alloy')
          window.localStorage.setItem('chat-tts-cloud-voice', 'alloy')
        }
      } catch {}

      // Browser TTS removed

      setIsHydrated(true)
      console.log('💧 Component marked as hydrated');
      // Mark UI ready to enable CSS transitions post-hydration
      try {
        document.documentElement.setAttribute('data-ui-ready', 'true')
      } catch {}
      
      // Use setTimeout to ensure hydratedRef is set AFTER the theme useEffect completes
      setTimeout(() => {
        hydratedRef.current = true
        console.log('🔒 hydratedRef set to true - future theme changes will be persisted');
      }, 0)
    } else {
      console.log('🌍 Window not available (SSR)');
    }
  }, [])

  // Cleanup mic status timeout on unmount
  useEffect(() => {
    return () => { if (micStatusTimerRef.current) window.clearTimeout(micStatusTimerRef.current) }
  }, [])

  // Persist system prompt after hydration to avoid overwriting saved value on first mount
  useEffect(() => {
    if (typeof window !== 'undefined' && hydratedRef.current) {
      window.localStorage.setItem('und_system_prompt', systemPrompt)
    }
  }, [systemPrompt])

  // Persist and apply theme on change (only after hydration and for user actions)
  useEffect(() => {
    console.log('🎨 Theme useEffect triggered with theme:', theme, 'isHydrated:', isHydrated, 'hydratedRef:', hydratedRef.current);
    
    // Only persist theme changes after component is hydrated AND this isn't the initial hydration
    if (!hydratedRef.current) {
      console.log('⏸️ Skipping theme persistence - component not fully hydrated yet');
      return;
    }
    
    if (typeof window !== 'undefined') {
      console.log('💾 Saving theme to localStorage:', theme);
      window.localStorage.setItem('chat-theme', theme)
    }
    if (typeof document !== 'undefined') {
      console.log('🏷️ Setting data-theme attribute to:', theme);
      document.documentElement.setAttribute('data-theme', theme)
      console.log('🏷️ Current document data-theme:', document.documentElement.getAttribute('data-theme'));
    }
  }, [theme])

  // Reflect controls open state to DOM and persist (after hydration)
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-controls-open', controlsOpen ? 'true' : 'false')
      if (typeof window !== 'undefined' && hydratedRef.current) {
        window.localStorage.setItem('chat-controls-open', controlsOpen ? 'true' : 'false')
      }
    } catch {}
  }, [controlsOpen])

  // Persist Cloud voice after hydration

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && hydratedRef.current) {
        window.localStorage.setItem('chat-tts-cloud-voice', cloudVoice)
      }
    } catch {}
  }, [cloudVoice])

  return (
    <section className="chat-shell" aria-labelledby="chat-title">
      {/* Header */}
      <header className="chat-header">
        <div className="bar">
          <div className="chat-logo" aria-label="App logo">
            <Image src={LogoWhite} alt="EMR Chat" height={42} priority />
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-controls="system-controls"
              onClick={() => setControlsOpen(v => !v)}
              title={controlsOpen ? 'Hide system prompt' : 'Show system prompt'}
            >{controlsOpen ? '▾' : '▸'}</button>
            <div className="theme-toggle">
              <button
                type="button"
                className="theme-toggle-button"
                aria-label="Toggle theme"
                onClick={() => {
                  console.log('🔄 Toggle button clicked!');
                  console.log('🎨 Current theme before toggle:', theme);
                  
                  setTheme(prev => {
                    const newTheme = prev === 'light' ? 'dark' : 'light';
                    console.log('🎨 Theme changing from', prev, 'to', newTheme);
                    return newTheme;
                  });
                }}
                title="Toggle light/dark"
              >
                <div className="theme-toggle-track">
                  <div className="theme-toggle-thumb">
                    {/* Render both icons to avoid SSR/CSR mismatch; toggle via CSS */}
                    <svg className="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
                    </svg>
                    <svg className="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12.34 2.02C6.59 1.82 2 6.42 2 12.25c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-15.21z"/>
                    </svg>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Controls Panel */}
      <section
        id="system-controls"
        className={`chat-controls ${controlsOpen ? 'open' : 'collapsed'}`}
        aria-labelledby="controls-title"
      >
        <div className="controls-inner">
          <div className="control-group">
            <label id="controls-title" className="control-label" htmlFor="system-prompt">System prompt</label>
            <textarea
              id="system-prompt"
              className="control-textarea"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe how the assistant should behave (tone, scope, guardrails)"
            />
          </div>
          {/* Voice settings (Cloud only) */}
          <div className="control-group">
            <label className="control-label">Voice settings</label>
            {isHydrated && (
              <div className="mt-2">
                <label className="muted block mb-1" htmlFor="cloud-voice">Cloud voice</label>
                <select
                  className="control-select"
                  id="cloud-voice"
                  value={cloudVoice}
                  onChange={(e) => {
                    const v = e.target.value
                    setCloudVoice(v)
                    window.localStorage.setItem('chat-tts-cloud-voice', v)
                  }}
                >
                  {SUPPORTED_CLOUD_VOICES.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="control-actions">
            <button
              type="button"
              className="composer-btn composer-btn-secondary"
              onClick={() => setSystemPrompt('You are UND Assistant, a helpful, concise, and friendly assistant for the University of North Dakota. Be accurate and cite UND context when possible.')}
            >Reset</button>
            <label className="toggle inline-flex items-center gap-2">
              <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
              <span>Read replies aloud</span>
            </label>
          </div>
        </div>
      </section>

      {/* Message Thread */}
      <main 
        ref={threadRef}
        className="chat-thread" 
        role="log" 
        aria-live="polite" 
        aria-relevant="additions"
        aria-label="Chat conversation"
      >
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-container">
              {message.sender !== 'user' && (
                <div className="avatar">
                  <div className="avatar-content">
                    {message.sender === 'assistant' ? 'AI' : 'ℹ️'}
                  </div>
                </div>
              )}
              <div className="bubble-container">
                <div className="bubble">
                  <div className="bubble-content">{message.text}</div>
                  {/* Timestamp removed per design */}
                  {message.sender === 'assistant' && (
                    <div className="bubble-actions mt-1 flex items-center gap-2">
                      <div className="tts-controls inline-flex gap-1 items-center">
                        <button
                          type="button"
                          className="icon-btn tts-btn"
                          aria-label="Start or resume speaking"
                          onClick={() => playMessage(message.text, message.id)}
                          title="Start/Resume"
                        >
                          <PlayArrowRoundedIcon fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn tts-btn"
                          aria-label="Pause speaking"
                          onClick={pauseSpeaking}
                          title="Pause"
                        >
                          <PauseRoundedIcon fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn tts-btn"
                          aria-label="Stop speaking"
                          onClick={stopSpeaking}
                          title="Stop"
                        >
                          <StopRoundedIcon fontSize="small" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn tts-btn"
                          aria-label="Restart speaking"
                          onClick={() => restartSpeakingForText(message.text, message.id)}
                          title="Restart"
                        >
                          <ReplayRoundedIcon fontSize="small" />
                        </button>
                      </div>
                      {loadingByMessage[message.id] && (
                        <span className="inline-flex items-center gap-1" aria-live="polite">
                          <CircularProgress size={14} thickness={6} />
                          <span className="sr-only">Preparing audio…</span>
                        </span>
                      )}
                      {(() => {
                        const keyCloud = `cloud|${cloudVoice}|${message.text}`
                        const isThisPlaying = isSpeaking && currentTtsKey === keyCloud
                        return isThisPlaying ? <span className="muted text-xs">Playing</span> : null
                      })()}
                    </div>
                  )}
                </div>
              </div>
              {message.sender === 'user' && (
                <div className="avatar">
                  <div className="avatar-content">You</div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="message assistant">
            <div className="message-container">
              <div className="avatar">
                <div className="avatar-content">AI</div>
              </div>
              <div className="bubble-container">
                <div className="bubble typing-bubble">
                  <div className="typing-indicator">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Suggestion Chips removed */}

      {/* Composer */}
      <footer className="composer">
        <form 
          className="composer-form" 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          aria-label="Send message"
        >
          <div className="input-container">
            <button
              type="button"
              className={`icon-btn mic-btn ${isRecording ? 'recording' : ''}`}
              aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
              onClick={() => isRecording ? stopVoiceInput() : startVoiceInput()}
              title={isRecording ? 'Stop recording' : 'Speak your question'}
            >
              {isRecording ? '■' : '🎙️'}
            </button>
            {micStatus !== 'idle' && (
              <div className={`mic-status ${micStatus}`} aria-live="polite">
                <span className={`mic-dot ${micStatus === 'listening' ? 'pulse' : ''}`} aria-hidden="true"></span>
                <span className="mic-text">{micStatus === 'listening' ? 'Listening…' : 'Stopped'}</span>
              </div>
            )}
            <textarea
              ref={inputRef}
              id="chat-input"
              className="message-input"
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              aria-describedby="chat-help"
              maxLength={2000}
            />
            {/* Per-message TTS controls are shown inside each assistant bubble */}
            <button
              type="submit"
              className="send-button"
              disabled={!inputValue.trim()}
              aria-label="Send message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="m22 2-7 20-4-9-9-4z"/>
                <path d="M22 2 11 13"/>
              </svg>
            </button>
          </div>
        </form>
      </footer>
    </section>
  )
}