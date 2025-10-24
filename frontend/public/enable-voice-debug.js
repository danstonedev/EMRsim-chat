// Copy and paste this into your browser console to enable detailed voice debugging
// This will show transcription events, WebRTC connection details, and audio processing info

// Method 1: localStorage (persists across sessions)
localStorage.setItem('voice.debug', 'true');

// Method 2: Global flag (current session only)
window.__VOICE_DEBUG = true;

// Method 3: URL parameter (add ?voiceDebug=1 to URL)
// No code needed, just add to URL

console.log('Voice debugging enabled! Refresh the page to see detailed logs.');
console.log('Look for [voice-debug] logs in the console when using voice chat.');
console.log('To disable: localStorage.removeItem("voice.debug") or set to "false"');