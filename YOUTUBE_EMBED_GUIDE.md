# YouTube Embed Feature - Usage Guide

## Overview

You can now embed YouTube videos directly in chat messages, just like images and videos. The system automatically handles YouTube URLs and displays them with proper thumbnails and full-screen playback.

## Supported URL Formats

The system automatically detects and converts these YouTube URL formats:

- Standard: `https://www.youtube.com/watch?v=VIDEO_ID`
- Short: `https://youtu.be/VIDEO_ID`
- Embed: `https://www.youtube.com/embed/VIDEO_ID`

## How to Add YouTube Videos

### In Scenario JSON

Add YouTube videos to your scenario's `media_library`:

```json
{
  "scenario_id": "example-scenario",
  "title": "Example Scenario",
  "media_library": [
    {
      "id": "exercise_demo",
      "type": "youtube",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "caption": "Proper squat form demonstration",
      "clinical_context": ["exercise", "lower_extremity", "strength"],
      "trigger_patterns": ["show squat", "demonstrate exercise"]
    },
    {
      "id": "anatomy_review",
      "type": "youtube",
      "url": "https://youtu.be/ABC123",
      "thumbnail": "https://img.youtube.com/vi/ABC123/hqdefault.jpg",
      "caption": "Knee anatomy overview",
      "clinical_context": ["anatomy", "knee", "education"]
    }
  ]
}
```

### Thumbnail Auto-Generation

If you don't provide a `thumbnail` URL, the system will automatically generate one from YouTube:

- **Format**: `https://img.youtube.com/vi/{VIDEO_ID}/hqdefault.jpg`
- **Resolution**: 480x360 (high quality)

You can manually specify a different thumbnail if needed.

## User Experience

### In Chat
1. AI responds with text including `[MEDIA:exercise_demo]`
2. A thumbnail appears below the message with a YouTube play icon
3. User clicks the thumbnail

### In Modal
1. Full-screen overlay opens
2. YouTube video plays in an embedded iframe
3. User can play, pause, fullscreen, etc.
4. Caption displays below the video with 📺 icon
5. ESC key or click outside closes the modal

## TypeScript Types

### Frontend

```typescript
interface MediaReference {
  id: string
  type: 'image' | 'video' | 'youtube'
  url: string
  thumbnail?: string
  caption: string
}
```

### Backend

```typescript
interface MediaAsset {
  id: string
  type: "image" | "video" | "youtube"
  url: string
  thumbnail?: string
  caption: string
  clinical_context: string[]
  trigger_patterns?: string[]
}
```

## Examples

### Exercise Demonstration
```json
{
  "id": "single_leg_balance",
  "type": "youtube",
  "url": "https://www.youtube.com/watch?v=example123",
  "caption": "Patient demonstrates single-leg balance exercise",
  "clinical_context": ["balance", "proprioception", "lower_extremity"],
  "trigger_patterns": ["show balance", "demonstrate exercise"]
}
```

### Patient Education
```json
{
  "id": "acl_repair_education",
  "type": "youtube",
  "url": "https://youtu.be/example456",
  "caption": "ACL reconstruction surgical procedure overview",
  "clinical_context": ["surgery", "education", "knee", "ligament"],
  "trigger_patterns": ["explain surgery", "show procedure"]
}
```

### Assessment Video
```json
{
  "id": "gait_analysis",
  "type": "youtube",
  "url": "https://www.youtube.com/watch?v=example789",
  "caption": "Patient's gait pattern during clinical assessment",
  "clinical_context": ["gait", "assessment", "movement_analysis"],
  "trigger_patterns": ["show walking", "gait analysis"]
}
```

## Features

✅ **Responsive Design** - 16:9 aspect ratio maintained across all screen sizes
✅ **Auto Thumbnails** - Automatic YouTube thumbnail generation
✅ **Full Controls** - Play, pause, fullscreen, volume control
✅ **Keyboard Accessible** - ESC to close, Enter/Space to open
✅ **Mobile Friendly** - Touch-optimized controls
✅ **Icon Badge** - YouTube icon badge on thumbnails (📺)

## Styling

YouTube embeds use these CSS classes:
- `.media-modal-youtube-container` - Maintains 16:9 aspect ratio
- `.media-modal-youtube` - The iframe element
- `.message__media-preview` - Thumbnail in chat message
- `.message__media-badge` - Icon badge overlay

## Technical Notes

- YouTube embeds use iframe with standard YouTube embed API
- Autoplay is disabled by default (controlled by user)
- All standard YouTube player controls are available
- Videos respect user's YouTube settings (captions, quality, etc.)
- No YouTube API key required for basic embeds

## Comparison with Other Media Types

| Feature | Image | Video | YouTube |
|---------|-------|-------|---------|
| Thumbnail | ✅ Auto | ✅ Manual | ✅ Auto |
| Fullscreen | ✅ | ✅ | ✅ |
| Controls | Zoom | Play/Pause | Full YouTube |
| Hosting | Local/CDN | Local/CDN | YouTube |
| Size | Any | Any | 16:9 ratio |

## Best Practices

1. **Use clear captions** - Describe what the video shows clinically
2. **Tag appropriately** - Use clinical_context for searchability
3. **Test URLs** - Verify YouTube URLs are accessible
4. **Consider length** - Shorter clips (30s-2min) work best
5. **Public videos** - Ensure videos are publicly accessible or unlisted

## Troubleshooting

**Video not loading?**
- Check that the YouTube URL is correct
- Verify the video is public or unlisted
- Try the embed URL format directly

**Thumbnail not showing?**
- The system auto-generates thumbnails from YouTube
- Manually specify thumbnail URL if needed

**Video playback issues?**
- This uses YouTube's standard embed player
- Check user's network/firewall settings
- Verify video isn't age-restricted or region-locked

---

**Implementation Date**: 2025-10-09
**Status**: ✅ Ready to Use
