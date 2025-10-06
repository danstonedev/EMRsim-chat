# Initial Greeting Behavior Fix

**Date:** October 3, 2025  
**Updated:** October 5, 2025  
**Issue:** AI volunteering name and DOB unprompted at session start  
**Status:** ✅ FIXED → ✅ IMPROVED (Greeting removed entirely)

---

## Problem Description

### Observed Behavior
When a voice session starts, the AI immediately introduces itself with:
> "Hi, my name is Jordan Patel, date of birth is 1997"

**Without being asked by the student.**

### Why This Is Wrong
1. ❌ Violates realistic patient behavior (patients don't volunteer DOB unprompted)
2. ❌ Skips identity verification training opportunity (students should learn to ask)
3. ❌ First message didn't get transcribed (timing issue with session start)
4. ❌ Confusing user experience

### Root Cause Analysis

**System behavior:**
```
ConversationController.ts:1219 
[ConversationController] ℹ️ Assistant starting without prior user input (initial greeting or follow-up)
```

The AI speaks first (initial greeting) before the student says anything. This is expected behavior, but the **content** of the greeting was wrong.

**Why it happened:**
1. ✅ Persona data includes full name and DOB (correctly added in previous fix)
2. ✅ Instructions say "provide name/DOB when asked" (correctly written)
3. ❌ **No instruction about what to say in initial greeting**
4. ❌ AI inferred it should introduce itself with identity details because they're prominent in persona snapshot

---

## Solution Applied

### Change 1: Added Initial Greeting Guidance

**File:** `backend/src/sps/core/instructions.ts`  
**Location:** After "IMPORTANT" section, before "Language" section

**Added:**
```
**Initial greeting**: If you speak first (before the student asks anything), keep it brief and natural. Do NOT volunteer your full name, date of birth, or medical details unprompted. Simply greet the student warmly and wait for their questions. Example: "Hi, how can I help you today?" or "Hello." Let the student lead the conversation.
```

**Why this works:**
- Explicitly tells AI what to say when speaking first
- Gives concrete examples of appropriate greetings
- Forbids volunteering identity/medical details unprompted
- Emphasizes student-led conversation

### Change 2: Strengthened Identity Verification Instructions

**File:** `backend/src/sps/core/instructions.ts`  
**Location:** SUBJECTIVE (history) → Identity verification section

**Before:**
```
Identity verification: When the learner asks for your name and date of birth (standard patient identification), provide this information clearly and cooperatively. [...]
```

**After:**
```
Identity verification: **ONLY when the learner explicitly asks** for your name and date of birth (standard patient identification), provide this information clearly and cooperatively. [...] However, **do NOT volunteer this information unprompted**. Wait for the student to ask before sharing your full name and date of birth.
```

**Changes:**
- Added "**ONLY when the learner explicitly asks**" (emphasis + specificity)
- Added explicit prohibition: "**do NOT volunteer this information unprompted**"
- Added reminder: "Wait for the student to ask"

---

## Expected Behavior After Fix

### Initial Greeting (AI speaks first)
**Before fix:**
> "Hi, my name is Jordan Patel, date of birth is 1997-05-12"

**After fix:**
> "Hi, how can I help you today?"

or

> "Hello."

**Then waits for student to ask questions.**

### When Student Asks for Identity
**Student:** "Can I verify your name and date of birth?"

**AI response (unchanged, still correct):**
> "My name is Jordan Patel, date of birth May 12th, 1997"

---

## Testing Recommendations

### Test Case 1: Initial Greeting
1. Start a new voice session
2. **Expected:** AI greets briefly ("Hi, how can I help you?") without identity details
3. **Verify:** Transcription captures the greeting correctly

### Test Case 2: Identity Verification
1. After greeting, student asks: "What's your name and date of birth?"
2. **Expected:** AI provides full name and DOB clearly
3. **Verify:** Information matches persona data

### Test Case 3: No Premature Disclosure
1. Student starts with: "What brings you in today?"
2. **Expected:** AI talks about chief complaint, NOT name/DOB
3. **Verify:** Identity is only shared when specifically requested

---

## Related Issues

### Issue 1: First Message Not Transcribed
**Observation from logs:**
```
[TranscriptEngine] ⚠️ User finalized with empty text - check transcription
```

This occurred because the AI spoke immediately on session start, potentially before transcription was fully initialized.

**Partial mitigation:** Shorter greeting reduces risk of truncation.

**Complete fix requires:** Frontend timing adjustment (separate investigation).

### Issue 2: Transcription Timing
The logs show the greeting was transcribed and relayed:
```
api.ts:133 [API] 🚀 relayTranscript called: {role: 'assistant', isFinal: true, textLength: 57}
ConversationController.ts:509 📡 Backend transcript received: {preview: 'Hi, my name is Jordan Patel, date of birth is 1997'}
```

But it may not have been displayed in the UI immediately. This is a frontend rendering issue, not related to the content problem.

---

## Files Modified

1. **backend/src/sps/core/instructions.ts**
   - Added "Initial greeting" guidance (lines ~9-11)
   - Strengthened "Identity verification" section (line ~27)

---

## Validation

### Before Deploying
Run backend tests:
```bash
cd backend
npm test
```

Expected: All tests pass (instructions changes should not break existing tests).

### After Deploying
1. Start a voice session
2. Observe first AI message
3. Confirm it's a brief greeting, not an identity dump
4. Ask for name/DOB and confirm AI provides it correctly

---

## Summary

**Problem:** AI volunteering name and DOB in initial greeting  
**Root cause:** No explicit instruction about what to say when speaking first  
**Solution:** Added initial greeting guidance + strengthened identity verification rules  
**Impact:** Low-risk change (pure instruction refinement)  
**Testing:** Manual voice session test recommended

---

## Rollback Plan

If the AI still volunteers identity info or doesn't greet properly:

```bash
git checkout HEAD -- backend/src/sps/core/instructions.ts
```

Then investigate alternative approaches:
- Adjust persona snapshot formatting (hide DOB until needed)
- Add gate-based instruction modification (only show DOB after greeting_done)
- Frontend: disable AI-first greeting (student speaks first)

---

## Update: October 5, 2025 - Greeting Removed Entirely

**Decision:** Eliminated verbal greeting completely in favor of visual notification.

### Changes Made

1. **Backend (`backend/src/sps/core/instructions.ts`)**:
   - Replaced "Initial greeting" section with "Wait for the student to speak first"
   - AI now remains silent until student initiates conversation
   - More realistic patient simulation (patients don't greet clinicians unprompted)

2. **Frontend (`frontend/src/shared/ConversationController.ts`)**:
   - Added `voice-ready` event type to ConversationEvent union
   - Emits `voice-ready` when voice connection is fully established
   - Triggers after session.updated confirmation

3. **UI Components**:
   - Created `VoiceReadyToast` component with auto-dismiss
   - Shows "🎤 Voice Ready - You can start speaking now" message
   - Auto-dismisses after 3 seconds OR when user starts speaking
   - Gradient purple design, positioned at top center

4. **Integration (`frontend/src/pages/App.tsx`)**:
   - Listens for `voice-ready` event
   - Shows toast when connection established
   - Dismisses toast on first user transcript

### Benefits

✅ **Simpler**: No "finalize-empty" edge cases  
✅ **Clearer**: Visual confirmation more reliable than audio  
✅ **Faster**: No AI greeting generation delay  
✅ **More Realistic**: Matches real clinical scenarios  
✅ **Less Complex**: Removes greeting-related instruction logic  

### Testing

All existing tests pass - they already expected user-speaks-first pattern.

**Manual Test:**
1. Start voice session
2. Verify purple "Voice Ready" toast appears at top
3. Start speaking - toast should dismiss immediately
4. AI should NOT speak first - waits for user
