# Current Voice/Realtime System Architecture

## System Overview

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[UI Components]
        App[App.tsx]
        ChatView[ChatView]
        MicControl[MicControl]
    end

    subgraph "State Management"
        VoiceSession[useVoiceSession Hook]
        VoiceTranscripts[useVoiceTranscripts Hook]
        ResponseMonitor[useResponseMonitor Hook]
        Messages[Message State]
    end

    subgraph "Core Controllers"
        CC[ConversationController]
        TE[TranscriptEngine]
        EM[EndpointingManager]
        RT[RealtimeTransport]
    end

    subgraph "Connection Management"
        RCF[runConnectionFlow]
        WS1[Socket.io Client]
        WRTC[WebRTC/PeerConnection]
        DC[Data Channels]
    end

    subgraph "Backend Services"
        API[REST API]
        WS2[Socket.io Server]
        Backend[Backend Server]
    end

    subgraph "External Services"
        OpenAI[OpenAI Realtime API]
    end

    %% UI Interactions
    UI --> App
    App --> ChatView
    ChatView --> MicControl
    MicControl --> VoiceSession

    %% State Flow
    VoiceSession --> CC
    CC --> TE
    CC --> EM
    CC --> VoiceTranscripts
    VoiceTranscripts --> Messages
    Messages --> ResponseMonitor

    %% Connection Flow
    CC --> RCF
    RCF --> RT
    RT --> WRTC
    WRTC --> DC
    CC --> WS1

    %% Backend Communication
    RCF --> API
    WS1 --> WS2
    API --> Backend
    WS2 --> Backend

    %% OpenAI Connection
    DC --> OpenAI
    Backend --> OpenAI
```

## Current Event Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI/MicControl
    participant VS as VoiceSession
    participant CC as ConversationController
    participant RCF as runConnectionFlow
    participant BE as Backend
    participant OAI as OpenAI

    U->>UI: Click Mic Button
    UI->>VS: startVoice()
    VS->>CC: startVoice()
    CC->>RCF: runConnectionFlow()
    
    Note over RCF: Get Microphone Access
    RCF->>BE: createSession()
    BE-->>RCF: sessionId
    
    Note over RCF: Initialize WebRTC
    RCF->>BE: getVoiceToken(sessionId)
    BE-->>RCF: token + config
    
    RCF->>BE: postVoiceSdp()
    BE-->>RCF: SDP Answer
    
    Note over CC: WebRTC Connected
    CC->>OAI: session.update (via DataChannel)
    
    U->>UI: Speak
    CC->>OAI: audio data
    OAI-->>CC: transcription.delta
    OAI-->>CC: transcription.completed
    CC->>BE: relayTranscript()
    
    OAI-->>CC: response.created
    OAI-->>CC: response.audio.delta
    CC->>BE: relayTranscript()
```

## Problems in Current Architecture

### 1. Session Management Chaos

- **Multiple Session IDs**: 
  - Frontend session (created in App.tsx)
  - Backend session (created via API)
  - OpenAI session (via WebRTC)
  - External session (from URL/props)
- **Race Conditions**: Session used before fully initialized
- **No Single Source of Truth**: Each layer maintains its own session state

### 2. Event System Fragmentation

- **Multiple Event Sources**:
  - OpenAI events via DataChannel
  - Socket.io events from backend
  - Internal events in ConversationController
  - UI events from hooks
- **No Unified Event Bus**: Events handled differently in each layer
- **Duplicate Event Handling**: Same events processed multiple times

### 3. Transcript Processing Complexity

- **Multiple Processing Paths**:
  - Direct from OpenAI → TranscriptEngine
  - Backend relay path
  - UI update path via hooks
- **Duplicate Detection Scattered**: 
  - In TranscriptEngine
  - In useVoiceTranscripts
  - In message persistence
- **Race Conditions**: Finals arriving before partials, duplicates from multiple paths

### 4. Connection Management Issues

- **Retry Logic Duplication**:
  - In runConnectionFlow
  - In ConversationController
  - In API calls
- **State Synchronization**: Connection state not properly synchronized between layers
- **Resource Cleanup**: Unclear ownership of resources

### 5. Monolithic ConversationController

Currently handling:

- WebRTC connection management
- Session management
- Event processing from OpenAI
- Transcript management
- Audio streaming
- Socket.io communication
- Error handling
- State management

## Data Flow Issues

```mermaid
flowchart LR
    subgraph "Transcript Flow (Current - Problematic)"
        OAI1[OpenAI Event] --> CC1[ConversationController]
        CC1 --> TE1[TranscriptEngine]
        CC1 --> BE1[Backend Relay]
        TE1 --> VT1[useVoiceTranscripts]
        BE1 --> VT1
        VT1 --> MSG1[Messages]
        MSG1 --> UI1[UI Update]
    end
```

### Problems:

1. Multiple paths to the same destination
2. Race conditions between paths
3. Duplicate messages from different sources
4. No clear authority on message finalization

## Key Issues Summary

1. **"Hi." Response Loop**: AI gets confused state and reverts to greeting
2. **Session Race Conditions**: Frontend tries to use sessions before backend is ready
3. **Duplicate Transcripts**: Same transcript processed multiple times through different paths
4. **Memory Leaks**: Event listeners and resources not properly cleaned up
5. **Error Recovery Conflicts**: Multiple retry mechanisms that can conflict
6. **State Ambiguity**: No clear state machine for connection/conversation lifecycle
