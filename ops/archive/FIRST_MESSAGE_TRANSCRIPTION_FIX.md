# First User Message Transcription Fix

## Problem

User's **first message** after the AI starts speaking was not being transcribed. Instead, only fragments appeared (like "en").

## Root Cause

**Race condition in `response.created` event handler:**

```typescript
// ❌ WRONG - Force finalizes with empty text when assistant starts
if (type === 'response.created') {
  if (!this.userFinalized && !this.userHasDelta) {
    // Problem: Audio is committed, transcription in flight, but no deltas yet
    this.transcriptEngine.finalizeUser({})  // ← Finalizes with EMPTY TEXT
    this.userFinalized = true
  }
}
```

**Event sequence causing the bug:**
1. User speaks → `input_audio_buffer.committed` event
2. `userCommitTimer` starts (waiting for transcription)
3. Assistant starts responding → `response.created` event arrives **BEFORE** transcription deltas
4. System sees: `userFinalized=false` and `userHasDelta=false`
5. **Incorrectly assumes** no user input → force finalizes with empty text
6. Transcription delta finally arrives → treated as **NEW** user turn (causing "en" fragment)

## The Fix

**Check if transcription is in flight before force-finalizing:**

```typescript
// ✅ CORRECT - Check for pending transcription
if (type === 'response.created') {
  if (!this.userFinalized && !this.userHasDelta) {
    // Check if we're waiting for transcription (audio committed but no deltas yet)
    if (this.userCommitTimer != null) {
      // Audio is committed and transcription is in flight - DON'T force finalize
      console.log('[ConversationController] ⏳ Waiting for transcription to complete')
    } else {
      // Assistant starting without user input - OK for initial greetings
      console.log('[ConversationController] ℹ️ Assistant starting without prior user input')
      this.transcriptEngine.finalizeUser({})
      this.userFinalized = true
    }
  }
}
```

## How It Works

**`userCommitTimer` as a flag:**
- Set when `input_audio_buffer.committed` arrives
- Indicates transcription is processing
- Cleared when transcription completes or times out

**Decision logic:**
- If `userCommitTimer != null` → Transcription in progress, **wait for it**
- If `userCommitTimer == null` → No pending transcription, safe to finalize

## Files Changed

**Frontend:** `frontend/src/shared/ConversationController.ts`
- Line ~1789: Added check for `userCommitTimer` before force-finalizing

## Testing

After this fix, watch for console log:
```
[ConversationController] ⏳ Waiting for transcription to complete (audio committed, no deltas yet)
```

This means the system is correctly **waiting** for transcription instead of force-finalizing with empty text.

## Expected Behavior

1. User speaks first message
2. `audio_buffer.committed` → `userCommitTimer` starts
3. Assistant may start responding (`response.created`)
4. System sees `userCommitTimer != null` → **waits**
5. Transcription deltas arrive → accumulated properly
6. Transcription completion event → user message finalized correctly
7. First user message appears in transcript!

## Key Lesson

**Never force-finalize when transcription is in flight.**  

Use state flags (`userCommitTimer`) to distinguish between:
- "No user input at all" (OK to skip)
- "User spoke but transcription not ready yet" (MUST wait)
