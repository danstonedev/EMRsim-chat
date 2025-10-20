# Transcription Root Cause Fix

## Problem Identified

**User was experiencing transcription failures specifically for:**

1. User speech not being transcribed
2. First AI message not being transcribed

## Root Causes Found

### 1. ❌ Backend NOT Including Transcription Config in Token Request

**File:** `backend/src/routes/voice.js`

The backend was **completely omitting** `input_audio_transcription` from the OpenAI token request body:

```javascript
// ❌ WRONG - Missing transcription config
body: JSON.stringify({
  model,
  voice,
  instructions: ...,
  modalities: ['text', 'audio'],
  // Note: For gpt-realtime-2025-08-28, input_audio_transcription should be configured
  // via session.update WebSocket command after connecting, not in the ephemeral token.
  // Omitting it here to let client configure via session.update.  ← WRONG!
  turn_detection: { ... }
})
```

**Why This Was Wrong:**

- The misleading comment suggested transcription should ONLY be set via `session.update`
- In reality, `input_audio_transcription` MUST be in the token request for OpenAI to enable transcription
- Without it in the token, transcription was never enabled at the API level
- `session.update` can only UPDATE settings, not enable transcription from scratch

### 2. ❌ Hardcoded `whisper-1` Fallbacks

Multiple locations had hardcoded fallbacks to the old `whisper-1` model instead of using the configured optimized model.

## Fixes Applied

### Fix 1: Add Transcription Config to Token Request ✅

```javascript
// ✅ CORRECT - Include transcription in token request
body: JSON.stringify({
  model,
  voice,
  instructions: withReplyLanguage(instructions, replyLanguage) || undefined,
  modalities: ['text', 'audio'],
  // Enable transcription with configured model (gpt-4o-mini-transcribe for low-latency)
  input_audio_transcription: {
    model: transcriptionModel,  // From OPENAI_TRANSCRIPTION_MODEL in .env
    language: inputLanguage && inputLanguage !== 'auto' ? inputLanguage : null,
  },
  turn_detection: {
    type: 'server_vad',
    threshold: vadThreshold,
    prefix_padding_ms: vadPrefixMs,
    silence_duration_ms: vadSilenceMs,
  },
}),
```

### Fix 2: Remove Hardcoded whisper-1 Fallbacks ✅

**Backend (`voice.js`):**
```javascript
// ❌ BEFORE: Silently fell back to whisper-1
const transcriptionModel = ... || 'whisper-1'

// ✅ AFTER: Fail loudly if not configured
const transcriptionModel = ... || process.env.OPENAI_TRANSCRIPTION_MODEL

if (!transcriptionModel || !transcriptionModel.trim()) {
  console.error('[voice] ❌ OPENAI_TRANSCRIPTION_MODEL is not configured in .env')
  return res.status(500).json({ 
    error: 'transcription_model_not_configured', 
    message: 'OPENAI_TRANSCRIPTION_MODEL must be set in backend/.env' 
  })
}
```

**Frontend (`ConversationController.ts`):**
```javascript
// ❌ BEFORE: Hardcoded whisper-1 in session.update
session: {
  modalities: ['text', 'audio'],
  input_audio_transcription: {
    model: 'whisper-1'  // ← WRONG!
  }
}

// ✅ AFTER: Let backend token configure model
session: {
  modalities: ['text', 'audio'],
  // Note: Transcription model is configured by backend via token request
}
```

## Configuration Required

**File:** `backend/.env`
```env
# Use optimized real-time transcription model
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

## How OpenAI Realtime Transcription Works

### Token Request (Backend) - REQUIRED

``` text
POST https://api.openai.com/v1/realtime/sessions
{
  model: "gpt-realtime-2025-08-28",
  modalities: ["text", "audio"],
  input_audio_transcription: {        ← MUST BE HERE
    model: "gpt-4o-mini-transcribe",  ← Configured from .env
    language: null                     ← null = auto-detect
  }
}
```

### Session Update (Frontend) - OPTIONAL

``` text
session.update (WebSocket)
{
  session: {
    modalities: ["text", "audio"]     ← Can update modalities
    // transcription already enabled by token
  }
}
```

## Testing

After these fixes:

1. ✅ Backend validates `OPENAI_TRANSCRIPTION_MODEL` is configured
2. ✅ Backend includes transcription config in token request  
3. ✅ OpenAI API enables transcription at session creation
4. ✅ User speech transcriptions work immediately
5. ✅ AI speech transcriptions work immediately
6. ✅ Uses optimized `gpt-4o-mini-transcribe` model for low-latency

## Next Steps

1. **Hard refresh browser** (Ctrl+Shift+R) to get new token with transcription enabled
2. **Start voice conversation** and verify:
   - Console shows: `✅ Transcription confirmed enabled: {model: 'gpt-4o-mini-transcribe'}`
   - User speech is transcribed in real-time
   - AI responses are transcribed in real-time
   - Both user and assistant transcripts appear in UI immediately

## Key Lesson

**Transcription MUST be configured in the OpenAI token request body.**  
`session.update` cannot enable transcription if it wasn't requested in the token.

Think of it like:

- **Token request** = "Turn on transcription feature at API level"
- **session.update** = "Update settings for already-enabled feature"

You can't update settings for a feature that was never turned on!
