# Quick Reference: Transcription Settings

## VAD (Voice Activity Detection) Settings

### Location
`backend/.env`

### Current Optimized Values
```bash
REALTIME_VAD_THRESHOLD=0.30      # Lower = more sensitive (catches speech earlier)
REALTIME_VAD_PREFIX_MS=300       # Audio captured BEFORE speech detected (prevents word cutoff)
REALTIME_VAD_SILENCE_MS=400      # Silence duration before turn ends
```

### What These Do

**REALTIME_VAD_THRESHOLD (0.0 - 1.0)**
- Lower values = more sensitive
- Catches quieter speech and earlier onset
- Too low = may pick up background noise
- **Recommended: 0.25 - 0.35**

**REALTIME_VAD_PREFIX_MS**
- Milliseconds of audio to include BEFORE VAD detects speech
- Prevents first syllable cutoff
- Higher = captures more pre-speech audio
- **Recommended: 250 - 400ms**

**REALTIME_VAD_SILENCE_MS**
- How long to wait in silence before ending turn
- Higher = more patient (won't cut off between words)
- Too high = delays AI response
- **Recommended: 300 - 500ms**

## Fine-Tuning Guide

### If first words are cut off
```bash
REALTIME_VAD_PREFIX_MS=400  # Increase prefix buffer
```

### If background noise triggers transcription
```bash
REALTIME_VAD_THRESHOLD=0.40  # Make less sensitive
```

### If speech is interrupted mid-sentence
```bash
REALTIME_VAD_SILENCE_MS=500  # Wait longer before ending turn
```

### If AI responses feel sluggish
```bash
REALTIME_VAD_SILENCE_MS=300  # Reduce silence threshold
```

## Restart Required

After changing VAD settings in `.env`, restart the backend:
```bash
cd backend
npm run dev
```

## Testing Commands

Check if settings are applied:
```bash
# Look for logs like:
# [voice] Requesting token with config: { model: '...', threshold: 0.30, ... }
```

---

*These settings affect real-time speech detection accuracy and responsiveness.*
