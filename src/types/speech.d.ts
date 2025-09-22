declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition
  }

  interface SpeechRecognition extends EventTarget {
    lang: string
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    start(): void
    stop(): void
    abort(): void
    onaudiostart?: (ev: Event) => any
    onsoundstart?: (ev: Event) => any
    onspeechstart?: (ev: Event) => any
    onspeechend?: (ev: Event) => any
    onsoundend?: (ev: Event) => any
    onaudioend?: (ev: Event) => any
    onresult?: (ev: SpeechRecognitionEvent) => any
    onerror?: (ev: SpeechRecognitionError) => any
    onend?: (ev: Event) => any
  }

  interface SpeechRecognitionAlternative {
    transcript: string
    confidence: number
  }

  interface SpeechRecognitionResult {
    isFinal: boolean
    length: number
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionResultList {
    length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number
    results: SpeechRecognitionResultList
  }

  interface SpeechRecognitionError extends Event {
    error: string
    message: string
  }
}

export {}
