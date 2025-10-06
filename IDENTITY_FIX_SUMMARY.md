# Fix Summary: AI Personas Sharing Identity Information

## Problem
AI personas (standardized patients) were refusing to share their full name and date of birth when asked, and may have been confused about their role as standardized patients.

## Root Cause Analysis
1. **DOB data existed but was never passed to the AI** - The `demographics.dob` field was populated during persona loading but was not included in the system prompt sent to the AI.
2. **No explicit instructions about identity sharing** - The core instructions did not tell the AI it should share identity information freely.
3. **Missing role clarification** - The AI wasn't explicitly told it IS the patient (not an assistant helping a patient).

## Changes Made

### 1. Updated `buildPersonaSection()` in `sps.service.ts`
**File**: `backend/src/sps/runtime/sps.service.ts`

**Added** (lines 154-157):
```typescript
// Include full name and DOB for identity verification
const fullName = demographics.name || name;
const dob = demographics.dob;
if (fullName) lines.push(`- Full name: ${fullName}`);
if (dob) lines.push(`- Date of birth: ${dob}`);
```

**Effect**: The AI now receives the patient's full name and date of birth in its system prompt.

### 2. Updated `GOLD_STANDARD_SPS_INSTRUCTIONS` in `instructions.ts`
**File**: `backend/src/sps/core/instructions.ts`

**Added to Role section** (line 5):
```
IMPORTANT: You ARE a standardized patient (a simulated patient for teaching purposes). When asked about your identity (name, date of birth, etc.), provide this information readily and naturally. DO NOT act as if you are an AI or refuse to share your full name and date of birth—these are part of your patient identity that you should share when asked, just as a real patient would during identity verification.
```

**Added to SUBJECTIVE section** (line 25):
```
Identity verification: When the learner asks for your name and date of birth (standard patient identification), provide this information clearly and cooperatively. This is routine healthcare practice. Example: "My name is [Full Name], date of birth [MM-DD-YYYY or YYYY-MM-DD]." Do not hesitate or refuse to share this information—you are a real patient in this simulation.
```

**Effect**: The AI now has explicit instructions that:
- It IS the patient (not an AI assistant)
- It should share identity information when asked
- This is normal healthcare practice
- Example format for how to respond

## System Architecture Documentation
Created `SCENARIO_SYSTEM_ANALYSIS.md` documenting:
- Complete data flow from JSON files to AI prompts
- Persona loading pipeline (realtime personas + scenario bundles)
- How `ActiveCase` is composed
- Where the data was getting dropped

## Testing Recommendations
1. **Start a new session** with any persona/scenario combination
2. **Ask for patient name and DOB** - Should respond clearly with full name and date in format like "My name is Jordan Patel, date of birth 1997-03-09"
3. **Verify no hesitation** - Should not say things like "I can't share that" or "I'm just an AI"
4. **Test with different personas** - Try both realtime personas and scenario-specific personas

## Technical Notes
- DOB format in system: `YYYY-MM-DD` (ISO 8601)
- DOB is computed from age for scenario bundle personas via `coerceDob(age)`
- DOB is directly loaded for realtime personas from `dateOfBirth` field
- Both paths now correctly surface the DOB to the AI via `buildPersonaSection()`

## Files Modified
1. ✅ `backend/src/sps/runtime/sps.service.ts` - Added DOB/full name to persona section
2. ✅ `backend/src/sps/core/instructions.ts` - Added identity sharing instructions

## Files Created
1. 📄 `SCENARIO_SYSTEM_ANALYSIS.md` - Complete system architecture documentation
2. 📄 `IDENTITY_FIX_SUMMARY.md` - This file

## Next Steps
- [ ] Test with actual voice/chat session
- [ ] Monitor for any edge cases where DOB might be missing
- [ ] Consider adding similar explicit instructions for other clinical data if issues arise
