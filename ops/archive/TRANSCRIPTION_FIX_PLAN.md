# TRANSCRIPTION ROOT CAUSE & FIX

## PROBLEM IDENTIFICATION

After deep analysis of OpenAI's official Realtime API examples, I've identified the root cause:

### What We're Doing Wrong

1. **Race Condition**: We finalize the user message immediately on `speech_stopped`, BEFORE the `conversation.item.input_audio_transcription.completed` event arrives

2. **Wrong Event Sequence**: We're not following OpenAI's documented event flow

3. **Premature Finalization**: We finalize with fallback text `"[Speech not transcribed]"` before giving transcription a chance to complete

###  The Correct Event Sequence (from OpenAI examples)

``` text
1. input_audio_buffer.speech_started
2. input_audio_buffer.speech_stopped  
3. conversation.item.created (user message) ← NO TRANSCRIPT YET!
4. conversation.item.input_audio_transcription.completed ← TRANSCRIPT ARRIVES HERE!
5. response.created (assistant)
6. response.audio.delta (audio chunks)
7. response.audio_transcript.delta (what assistant is saying)
8. conversation.item.completed
```

### What's Happening in Our Code

```typescript
// Current broken flow:
speech_stopped → 
  We immediately call: transcriptEngine.finalizeUser({ transcript: '[Speech not transcribed]' }) ❌
  
// Then LATER:
conversation.item.input_audio_transcription.completed arrives
  But we already finalized, so transcript is ignored! ❌
```

## THE FIX

### Core Changes Needed

1. **Don't finalize on `speech_stopped`** - just mark that speech ended
2. **Wait for `conversation.item.input_audio_transcription.completed`** - this is when transcript arrives
3. **Handle the edge case** - transcript can arrive before `conversation.item.created`
4. **Only use fallback** - if `.failed` event fires

### Implementation Plan

#### File: `ConversationController.ts`

**REMOVE** the immediate finalization in `speech_stopped` handler:
```typescript
// WRONG (current code):
if (type.includes('speech_stopped') || type.includes('input_audio_buffer.speech_stopped')) {
  // ... existing code ...
  if (!this.userFinalized) {
    this.transcriptEngine.finalizeUser({}) // ❌ TOO EARLY!
    this.userFinalized = true
  }
}
```

**REPLACE** with waiting for transcription:
```typescript
if (type.includes('speech_stopped') || type.includes('input_audio_buffer.speech_stopped')) {
  console.log('[ConversationController] User speech stopped, waiting for transcription...')
  // DON'T finalize yet! Wait for transcription event
  // Just set a flag that speech has ended
  this.userSpeechEnded = true
  return
}
```

**ADD** proper handler for transcription completion:
```typescript
// Handle successful transcription
if (type.includes('conversation.item.input_audio_transcription.completed')) {
  const transcript = payload.transcript || ''
  console.log('[ConversationController] ✅ Transcription completed:', transcript)
  
  if (!this.userFinalized) {
    this.transcriptEngine.finalizeUser({ transcript })
    this.userPartial = ''
    this.userFinalized = true
  }
  return
}
```

**KEEP** the failure handler (unchanged):
```typescript
// Handle transcription failures - finalize with fallback
if (type.includes('transcription.failed') || type.includes('input_audio_transcription.failed')) {
  console.error('[ConversationController] ⚠️ Transcription FAILED, using fallback')
  if (!this.userFinalized) {
    this.transcriptEngine.finalizeUser({ transcript: '[Speech not transcribed]' })
    this.userPartial = ''
    this.userFinalized = true
  }
  return
}
```

### Why This Works

1. **Speech stops** → We note it but DON'T finalize
2. **Transcription completes** → We finalize with actual transcript
3. **Transcription fails** → We finalize with fallback text
4. **Edge case handled** → If transcript arrives before item.created, it still works

### Testing Strategy

1. Start voice session
2. Speak into mic
3. Check console for:
   - "User speech stopped, waiting for transcription..."
   - "✅ Transcription completed: [your actual words]"
4. Verify UI shows actual words, NOT "[Speech not transcribed]"
5. Verify assistant responds with voice

## Additional Issues Found

### Audio Playback

The audio playback code looks correct:

- WebRTC `ontrack` handler connects remote stream to audio element
- Audio element has `play()` called with fade-in
- Modalities include 'audio' in session config and response.create

**Possible issue**: Session config might not be persisting audio modality. Need to verify `session.updated` response confirms audio is enabled.

### Session Configuration

The backend correctly sets:
```javascript
modalities: ['text', 'audio']
```

But we also send `session.update` from frontend. Need to ensure we're not overwriting this:

```typescript
// In session.update, ADD:
session: {
  modalities: ['text', 'audio'],  // ← ADD THIS
  input_audio_transcription: {
    model: 'whisper-1'
  }
}
```

## Summary

**Root Cause**: Premature finalization before transcription completes

**Fix**: Wait for `conversation.item.input_audio_transcription.completed` event

**Expected Outcome**: 

- ✅ Transcriptions show actual speech
- ✅ No more "[Speech not transcribed]" fallback (unless actually failed)
- ✅ Assistant responds with voice

## Implementation Priority

1. Fix transcription event handling (HIGH)
2. Verify session modalities not overwritten (MEDIUM)
3. Add comprehensive logging (DONE)
4. Create integration test (DEFERRED - focus on fix first)
