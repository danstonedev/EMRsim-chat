# 3D Viewer Debug Session

## Changes Made

### 1. Simplified Model Loading
**File:** `HumanFigure.tsx`

**Problem:** Component was using both `useLoader` with `GLTFLoader` AND `useGLTF.preload`, which could cause conflicts.

**Fix:** Simplified to use only `useGLTF` from `@react-three/drei`:
```tsx
// BEFORE:
import { useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three-stdlib'
import { extendGLTFLoader } from './utils/loaderConfig'

const gl = useThree(state => state.gl)
const gltf = useLoader(GLTFLoader, MODEL_URL, loader => extendGLTFLoader(loader, gl))

// AFTER:
import { useGLTF } from '@react-three/drei'

const gltf = useGLTF(MODEL_URL)
```

### 2. Added Comprehensive Debug Logging

**Scene.tsx:**
- Log when Scene renders with props
- Log when metrics are received from HumanFigure

**HumanFigure.tsx:**
- Log model URL being loaded
- Log when model successfully loads
- Log when model normalization starts/completes
- Log when rendering primitive with root object

## What to Check in Browser Console

Open http://localhost:5173/3d-viewer and look for these logs in order:

### Expected Flow:
```
🎬 Scene: Rendering with props: { isAnimating: true, animationPrompt: "" }
🔄 HumanFigure: Loading model from: /models/human-figure.glb
✅ HumanFigure: Model loaded, scene: Object { ... }
🔧 HumanFigure: Normalizing model...
✅ HumanFigure: Model normalized, metrics: { ... }
📏 Scene: Received metrics: { ... }
🎨 HumanFigure: Rendering primitive with root: Group { ... }
```

### Possible Issues:

1. **If you see "Loading model..." but not "Model loaded":**
   - Model file might not be accessible
   - Check `/models/human-figure.glb` exists in `frontend/public/models/`
   - Check browser Network tab for 404 errors

2. **If you see "Model loaded" but not "Normalizing":**
   - Scene object is invalid
   - Check the scene object structure in console

3. **If you see "Normalizing" but not "Normalized":**
   - Error in `normalizeHumanModel` function
   - Check browser console for errors

4. **If you see all logs but no visible model:**
   - Model is being rendered but camera position might be wrong
   - Model might be too small/large
   - Lighting might be insufficient
   - Check the metrics values (size, position)

## Quick Tests

### Test 1: Model File Exists
In browser console or terminal:
```powershell
cd frontend/public/models
dir human-figure.glb
```

### Test 2: Model Accessible
Navigate to: http://localhost:5173/models/human-figure.glb
- Should download or show the file
- If 404, model isn't in the right place

### Test 3: Three.js Rendering
Check if the placeholder capsule appears while loading:
- Should see a gray capsule at center if model is loading

## Next Steps Based on Console

**If no logs appear:** Canvas not rendering - check Viewer3D.tsx  
**If logs stop early:** Model loading issue - check model file  
**If all logs but no visual:** Camera/rendering issue - check metrics values  
**If errors appear:** Check specific error and fix accordingly  

## Rollback

To remove debug logs later:
```bash
git diff frontend/src/pages/components/viewer/
```
Look for `console.log` statements and remove them.
