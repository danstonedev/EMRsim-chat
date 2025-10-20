# Committed Event Utterance Tracking Fix

## Issue Discovered

Looking at the event logs, we identified a critical gap in utterance tracking:

``` text
19:50:44.192 input_audio_buffer.speech_started
19:50:48.399 input_audio_buffer.committed  ← NO speech_stopped event!
```

**Problem**: OpenAI sometimes commits the audio buffer (triggering AI response) **without sending a `speech_stopped` event first**. This means:

1. The utterance wasn't being tracked for smart patience analysis
2. The AI was responding before user completed their thought
3. Smart patience bonuses weren't applying when they should

## Root Cause

Our smart patience system was only tracking utterances in the `speech_stopped` handler. When OpenAI committed the buffer directly (without `speech_stopped`), we missed tracking:

- Utterance duration
- Utterance timestamp  
- Word count (from subsequent transcription)

This led to incomplete pattern analysis and the AI not being patient enough with fragmented speech.

## Solution

Added identical utterance tracking logic to the `input_audio_buffer.committed` handler:

```typescript
if (type === 'input_audio_buffer.committed') {
  console.log('[ConversationController] Audio buffer committed, waiting for transcription...')
  
  // Track this as an utterance for smart patience (same as speech_stopped)
  if (this.userSpeechStartMs > 0) {
    const duration = Date.now() - this.userSpeechStartMs
    this.lastUserSpeechEndMs = Date.now()
    // Store recent utterance (we'll get word count from transcription)
    this.recentUserUtterances.push({ duration, wordCount: 0, timestamp: Date.now() })
    // Keep only last 5 utterances for pattern detection
    if (this.recentUserUtterances.length > 5) {
      this.recentUserUtterances.shift()
    }
    console.log('[ConversationController] 📊 Tracked utterance from committed event (duration:', duration, 'ms)')
  }
  
  // ... rest of committed handler logic
}
```

## Expected Improvement

**Before Fix:**

- Committed events → No utterance tracking
- Smart patience patterns incomplete
- AI responds too quickly even when user is clearly searching for words

**After Fix:**

- Committed events → Full utterance tracking
- Complete pattern analysis (short fragments, rapid speech, recent engagement)
- Smart patience bonuses apply correctly
- AI waits appropriately for incomplete thoughts

## Event Flow Examples

### Scenario 1: Normal Speech Flow

``` text
speech_started → speech_stopped → committed → transcription.completed
✅ Tracked in speech_stopped handler
```

### Scenario 2: Direct Commit (Previously Broken)

``` text
speech_started → committed → transcription.completed
✅ NOW tracked in committed handler
```

### Scenario 3: Interrupted Speech

``` text
speech_started → speech_started → committed → transcription.completed
✅ Both events tracked (speech_started resets timer, committed records final duration)
```

## Debugging

Look for this new log message in browser console:
``` text
[ConversationController] 📊 Tracked utterance from committed event (duration: 2547 ms)
```

This confirms utterances are being tracked even when `speech_stopped` doesn't fire.

## Files Modified

- `frontend/src/shared/ConversationController.ts` (lines 1775-1804)

## Testing

Test with speech patterns that cause direct commits:

1. Very short utterances (single word + pause)
2. Loud/clear speech that triggers immediate VAD commit
3. Interrupted speech (start speaking during AI response)

Watch for:

- "📊 Tracked utterance from committed event" logs
- "🧠 Smart patience active" logs showing bonuses being applied
- Improved AI patience when you're clearly searching for words

## Related Systems

This fix ensures the smart patience system has complete data for:

1. **Short Fragment Detection**: All utterances tracked, including direct commits
2. **Rapid Speech Detection**: Accurate timestamps for all speech events
3. **Recent Engagement Detection**: Complete picture of user's speech activity

Without tracking committed events, the smart patience system was operating with incomplete data and couldn't properly detect when users were thinking/searching for words.
