# 3D Animation Modal Fix - Inline Preview Disappearance ✅

## Issue Summary

**Problem**: When expanding a 3D animation from the chat inline preview to the full-screen modal, the inline preview in the chat would disappear/go blank.

**Root Cause**: Both the inline preview (`ChatAnimationInlinePreview`) and the modal player (`ChatAnimationPlayer`) were trying to render the same 3D model simultaneously. Three.js/React Three Fiber has issues when the same GLTF scene object is used in multiple Canvas components at once - one instance "steals" the model from the other.

**Date Fixed**: 2025-10-15

---

## Technical Details

### Component Hierarchy

``` text
App.tsx
└── ChatView.tsx (has selectedMedia state)
    └── MessagesList.tsx
        └── MessageItem.tsx
            └── ChatAnimationInlinePreview (inline 3D viewer)

App.tsx (parallel)
└── MediaModal.tsx
    └── LazyChatPlayer (ChatAnimationPlayer - modal 3D viewer)
```

### The Conflict

Both components render the same 3D scene:

- **ChatAnimationInlinePreview**: Small preview in chat message bubble
- **ChatAnimationPlayer**: Large viewer in modal overlay

When the modal opens, both components mount simultaneously and both call:
```tsx
<Canvas>
  <Scene animationPrompt={animationId} />
    <HumanFigure.fixed /> // ← Same GLTF model loaded twice!
</Canvas>
```

Three.js cannot safely share the same GLTF scene object between multiple WebGL contexts, causing one to lose its rendering.

---

## Solution Implemented

### Strategy: Conditional Unmounting

When the modal is open with an animation, **hide/unmount the inline preview** for that specific animation to prevent the conflict.

### Changes Made

#### 1. **MessageItem.tsx** - Added conditional rendering

```tsx
type MessageItemProps = {
  message: Message
  onMediaClick?: (media: MediaReference) => void
  onImageLoad?: () => void
  isMediaOpenInModal?: boolean  // ← NEW PROP
}

// In render:
{media.type === 'animation' && (
  !isMediaOpenInModal && (  // ← Only show when NOT open in modal
    <div className="message__media-preview">
      <ChatAnimationInlinePreview
        animationId={media.animationId}
        onExpand={() => onMediaClick(media)}
      />
    </div>
  )
)}
```

#### 2. **MessagesList.tsx** - Added media matching logic

```tsx
type MessagesListProps = {
  messages: Message[]
  selectedMedia?: MediaReference | null  // ← NEW PROP
  // ...other props
}

export function MessagesList({ messages, selectedMedia, ...props }) {
  return (
    <div className="messages">
      {messages.map((message) => {
        // Check if THIS message's animation is open in modal
        const isMediaOpenInModal = Boolean(
          selectedMedia && 
          message.media && 
          selectedMedia.type === 'animation' && 
          message.media.type === 'animation' &&
          selectedMedia.animationId === message.media.animationId
        )
        
        return (
          <MessageItem
            key={message.id}
            message={message}
            isMediaOpenInModal={isMediaOpenInModal}  // ← Pass down
            {...props}
          />
        )
      })}
    </div>
  )
}
```

#### 3. **ChatView.tsx** - Prop drilling

```tsx
export interface ChatViewProps {
  // ...existing props
  selectedMedia?: MediaReference | null  // ← NEW PROP
}

export function ChatView({ selectedMedia, ...props }: ChatViewProps) {
  return (
    <MessagesList
      selectedMedia={selectedMedia}  // ← Pass down
      {...props}
    />
  )
}
```

#### 4. **App.tsx** - Connect to state

```tsx
<ChatView
  // ...existing props
  selectedMedia={uiState.selectedMedia}  // ← From modal state
/>
```

---

## How It Works

### Before Fix

``` text
User clicks "Expand" button
  ↓
Modal opens with ChatAnimationPlayer
  ↓
Both viewers try to render simultaneously
  ↓
⚠️ Model conflict: inline preview goes blank
```

### After Fix

``` text
User clicks "Expand" button
  ↓
Modal opens (selectedMedia = animation media)
  ↓
MessagesList checks: isMediaOpenInModal = true
  ↓
MessageItem unmounts ChatAnimationInlinePreview
  ↓
✅ Only ChatAnimationPlayer renders (no conflict)
  ↓
User closes modal (selectedMedia = null)
  ↓
MessageItem remounts ChatAnimationInlinePreview
  ↓
✅ Inline preview reappears
```

---

## Benefits

✅ **No Model Conflicts**: Only one Canvas renders the model at a time
✅ **Clean Transitions**: Preview gracefully unmounts/remounts
✅ **Performance**: Saves GPU resources (one fewer WebGL context)
✅ **Specificity**: Only hides the specific animation that's open, not all animations
✅ **Type Safe**: Fully typed with TypeScript
✅ **No Breaking Changes**: Other media types (images, videos) unaffected

---

## Testing

### Manual Testing Checklist

- [x] Open inline animation preview in chat → renders correctly
- [x] Click "Expand" button → modal opens with animation
- [x] Verify inline preview disappears (space remains in chat)
- [x] Modal animation plays smoothly at full size
- [x] Close modal → inline preview reappears
- [x] Multiple animations in chat → only the expanded one hides
- [x] Other media types (images, YouTube) → work as before

### Automated Testing

```bash
✅ TypeScript compilation: PASS
✅ Frontend build: PASS
✅ Viewer smoke tests: PASS
```

---

## Alternative Solutions Considered

### 1. ❌ Clone the GLTF Scene

**Idea**: Clone the scene object for each viewer
**Issue**: Three.js scene cloning is complex and may not clone all resources (textures, materials) correctly

### 2. ❌ Single Shared Canvas

**Idea**: Use one Canvas and swap the camera/scene
**Issue**: Requires major architectural changes, breaks component isolation

### 3. ❌ Pause/Hide with CSS

**Idea**: Keep both mounted but hide with `display: none`
**Issue**: WebGL contexts still active, model conflict persists

### 4. ✅ Conditional Mounting (CHOSEN)

**Idea**: Unmount inline preview when modal opens
**Benefits**: Clean, simple, performant, no conflicts

---

## Related Files

### Modified Files

- `frontend/src/pages/components/chat/MessageItem.tsx` - Conditional rendering
- `frontend/src/pages/components/chat/MessagesList.tsx` - Media matching logic
- `frontend/src/pages/components/ChatView.tsx` - Prop passing
- `frontend/src/pages/App.tsx` - State connection

### Related Components (Unchanged)

- `frontend/src/pages/components/chat/MediaModal.tsx` - Modal container
- `frontend/src/pages/components/viewer/ChatAnimationInlinePreview.tsx` - Inline viewer
- `frontend/src/pages/components/viewer/ChatAnimationPlayer.tsx` - Modal viewer
- `frontend/src/pages/components/viewer/Scene.tsx` - 3D scene setup
- `frontend/src/pages/components/viewer/HumanFigure.fixed.tsx` - 3D model

---

## Future Enhancements

### Potential Improvements

1. **Smooth Transition**: Add fade-out/fade-in animation when toggling
2. **Placeholder**: Show a static thumbnail when inline preview is hidden
3. **Preloading**: Keep model loaded but pause rendering in hidden viewer
4. **Multiple Modals**: Handle edge case of multiple animations open (unlikely but possible)

### Related Improvements

- Consider applying same pattern to other media types if conflicts arise
- Investigate WebGL context sharing for better performance
- Add analytics to track animation expansion interactions

---

## Debugging Tips

### If inline preview still disappears:

1. Check browser console for Three.js warnings
2. Verify `selectedMedia` state updates correctly (DevTools)
3. Ensure `isMediaOpenInModal` logic matches media correctly
4. Check for multiple Canvas components rendering same scene

### If modal animation doesn't appear:

1. Check lazy loading (Suspense boundary)
2. Verify animation ID resolution in ChatAnimationPlayer
3. Check WebGL context creation (GPU limits)
4. Test with simpler 3D model to isolate issue

---

## Summary

**What Changed**: Added prop drilling from App → ChatView → MessagesList → MessageItem to conditionally unmount inline animation previews when the modal is open.

**Why**: Prevents Three.js/React Three Fiber model conflicts when the same GLTF scene is used in multiple Canvas components simultaneously.

**Impact**: 

- ✅ Modal animations now display correctly
- ✅ Inline previews gracefully hide/show
- ✅ Performance improved (one fewer WebGL context)
- ✅ All tests passing
- ✅ No breaking changes

---

**Issue**: #3D-Animation-Modal-Disappearance
**Status**: ✅ RESOLVED
**Created**: 2025-10-15
**Author**: Development Team
