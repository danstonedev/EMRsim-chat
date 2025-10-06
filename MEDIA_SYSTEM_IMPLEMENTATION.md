# Media Display System - Implementation Complete

## Overview
The media display system allows scenarios to include visual media (images/videos) that are displayed in response to appropriate clinical prompts during the objective examination phase.

## Status
✅ **Implementation Complete** - All core features implemented and ready for testing.

## Architecture

### 1. Backend Schema Extension
- `MediaAsset` type added to `backend/src/sps/core/types.ts`
- `media_library` field added to `ClinicalScenario` interface
- Zod validation schema `zMediaAsset` added for type safety

### 2. Frontend Types
- `ScenarioMediaAsset` interface added to frontend scenario types
- `MediaReference` interface added to message types
- Media field added to `Message` and `ConversationEvent` types

### 3. AI Instructions
- `buildMediaGuidance()` function generates AI instructions when media is available
- AI receives list of available media with IDs and context
- Instructions guide AI to use `[MEDIA:media_id]` markers

### 4. Media Parsing
- `ConversationController.parseMediaMarker()` extracts media from AI responses
- Removes `[MEDIA:id]` markers from text before display
- Resolves media reference from scenario library

### 5. UI Components
- `MediaModal` component for displaying images/videos
- Fullscreen overlay with ESC/click-to-close
- Accessibility features (keyboard navigation, ARIA labels)
- Responsive styling with Safari compatibility

### 6. Message Integration
- `MessageItem` displays media thumbnail with overlay badge
- Click/keyboard interaction opens modal
- Automatic video playback when modal opens

## Usage Example

### Adding Media to a Scenario

```json
{
  "scenario_id": "knee-rom-demo",
  "title": "Knee ROM Assessment Demo",
  "region": "knee",
  "media_library": [
    {
      "id": "knee_flexion_active",
      "type": "video",
      "url": "/media/knee-flexion-demo.mp4",
      "thumbnail": "/media/knee-flexion-thumb.jpg",
      "caption": "Patient demonstrates active knee flexion to approximately 85° with visible guarding at end range",
      "clinical_context": ["rom", "knee", "flexion", "range of motion"],
      "trigger_patterns": ["show me", "demonstrate", "bend your knee"]
    },
    {
      "id": "knee_extension_active",
      "type": "image",
      "url": "/media/knee-extension.jpg",
      "caption": "Active knee extension shows full range with mild terminal lag",
      "clinical_context": ["rom", "knee", "extension"],
      "trigger_patterns": ["straighten", "extend"]
    },
    {
      "id": "gait_antalgic",
      "type": "video",
      "url": "/media/gait-antalgic.mp4",
      "caption": "Antalgic gait pattern with shortened stance phase on affected limb",
      "clinical_context": ["gait", "walking", "ambulation"],
      "trigger_patterns": ["walk", "show me how you walk"]
    }
  ],
  "objective_catalog": [
    {
      "test_id": "knee_arom_flexion",
      "label": "Active Knee Flexion ROM",
      "region": "knee",
      "patient_output_script": {
        "numeric": { "flexion_deg": 85 },
        "qualitative": ["I can bend it most of the way but it gets tight at the end."]
      }
    }
  ]
}
```

### AI Response Flow

**Student**: "Can you show me your knee range of motion?"

**AI Response** (with marker): "Sure, let me bend my knee for you. [MEDIA:knee_flexion_active]"

**User Sees**:
- Text: "Sure, let me bend my knee for you."
- Video thumbnail appears below message
- Click thumbnail → Modal opens with video playing
- Caption displayed: "Patient demonstrates active knee flexion..."

## Configuration

### Passing Media to ConversationController

```typescript
const controller = new ConversationController({
  scenarioId: 'knee-rom-demo',
  scenarioMedia: scenario.media_library || [],
  // ... other config
})
```

### Hooking Up Modal in Chat Page

```typescript
const [mediaModalOpen, setMediaModalOpen] = useState(false)
const [selectedMedia, setSelectedMedia] = useState<MediaReference | null>(null)

const handleMediaClick = (media: MediaReference) => {
  setSelectedMedia(media)
  setMediaModalOpen(true)
}

return (
  <>
    <ChatView onMediaClick={handleMediaClick} {...otherProps} />
    <MediaModal
      media={selectedMedia}
      isOpen={mediaModalOpen}
      onClose={() => setMediaModalOpen(false)}
    />
  </>
)
```

## File Changes

### Backend
- `backend/src/sps/core/types.ts` - MediaAsset interface
- `backend/src/sps/core/schemas.ts` - zMediaAsset validation
- `backend/src/sps/runtime/sps.service.ts` - Media guidance & resolution

### Frontend
- `frontend/src/shared/types/scenario.ts` - ScenarioMediaAsset interface
- `frontend/src/shared/ConversationController.ts` - Media parsing logic
- `frontend/src/pages/chatShared.ts` - MediaReference, Message types
- `frontend/src/pages/components/chat/MediaModal.tsx` - NEW modal component
- `frontend/src/pages/components/chat/MessageItem.tsx` - Media preview display
- `frontend/src/pages/components/chat/MessagesList.tsx` - Pass media handler
- `frontend/src/pages/components/ChatView.tsx` - Media modal integration point
- `frontend/src/styles/chat.css` - Media modal & preview styles

## Next Steps

### For Testing

1. **Add Media Assets**:
   - Place media files in `frontend/public/media/`
   - Or use external URLs (e.g., placeholder services)

2. **Create Test Scenario**:
   - Extend existing scenario JSON with `media_library`
   - Or create new scenario specifically for media testing

3. **Test Flow**:
   - Start voice conversation in objective phase
   - Ask "Can you show me [body part] [movement]?"
   - Verify AI includes `[MEDIA:id]` marker
   - Confirm thumbnail appears in message
   - Click thumbnail → modal opens
   - Verify video/image displays with caption

### For Production

1. **Media Storage**:
   - Decide on storage solution (CDN, S3, local serve)
   - Implement proper CORS headers if external
   - Consider video encoding/optimization

2. **Content Creation**:
   - Film/photograph clinical demonstrations
   - Ensure proper consent/privacy protections
   - Create varied examples for different regions

3. **Scenario Authoring**:
   - Document media naming conventions
   - Create templates for common assessments
   - Build media library for each region

## Benefits

### Educational
- **Bridges Realism Gap**: Students see what they'd observe in person
- **Visual Learning**: ROM, gait, postures can only be seen, not described
- **Pattern Recognition**: Build visual assessment skills
- **Standardization**: All students see same presentation

### Technical
- **Maintainable**: Media defined declaratively in scenarios
- **Scalable**: Add media without code changes
- **Backward Compatible**: Scenarios without media work unchanged
- **User-Friendly**: Simple click interaction, familiar modal pattern

### Future Expansion
- **Interactive Media**: Hotspots, annotations, zoom regions
- **Progressive Disclosure**: Multiple views (anterior, lateral, etc.)
- **Comparison Views**: Normal vs. abnormal side-by-side
- **Diagnostic Imaging**: X-rays, MRI, ultrasound triggered by special tests
- **Multi-Modal**: Audio cues (crepitus), tactile descriptions

## Technical Notes

- Media parsing happens in `ConversationController` before UI
- Only assistant messages are parsed for media markers
- Media only displayed during `objective` phase (enforced by AI instructions)
- Modal uses portal-like pattern (fixed positioning, high z-index)
- ESC key, click outside, or X button closes modal
- Video auto-plays when modal opens
- Images support browser native zoom
- Fully keyboard accessible
- Reduced motion respects user preferences

## Questions / Issues

If you encounter issues:
1. Check browser console for media loading errors
2. Verify media URLs are accessible
3. Confirm scenario has `media_library` array
4. Check AI response includes `[MEDIA:id]` marker
5. Verify media ID matches library entry

**Implementation Date**: 2025-10-05  
**Status**: ✅ Ready for Integration Testing
