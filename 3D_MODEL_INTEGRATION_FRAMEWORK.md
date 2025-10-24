# 3D Model Integration Framework

## Overview

This document provides a complete framework for integrating professional 3D models and animations into your EMRsim-chat 3D viewer. Multiple approaches are outlined from easiest to most advanced.

---

## 🎯 Quick Decision Matrix

| Approach | Complexity | Quality | Time | Cost | Best For |
|----------|-----------|---------|------|------|----------|
| **Mixamo** | ⭐ Easy | ⭐⭐⭐ Good | 1-2 hours | Free | Quick professional results |
| **Ready Player Me** | ⭐⭐ Medium | ⭐⭐⭐ Good | 2-4 hours | Free | Customizable avatars |
| **Custom Blender** | ⭐⭐⭐⭐ Hard | ⭐⭐⭐⭐⭐ Excellent | 1-2 weeks | Free | Full control, medical accuracy |
| **Purchased Assets** | ⭐⭐ Medium | ⭐⭐⭐⭐ Great | 4-8 hours | $50-500 | Professional medical models |

**Recommended for your use case: Start with Mixamo (easiest), then upgrade to custom medical models later.**

---

## 📋 Method 1: Mixamo (RECOMMENDED FOR QUICK START)

### Why Mixamo?

- ✅ Free Adobe service
- ✅ Professional rigged characters
- ✅ 2000+ pre-made animations
- ✅ Medical-relevant movements (walking, sitting, examining)
- ✅ Export to GLTF format
- ✅ No 3D modeling skills required

### Step-by-Step Implementation

#### Phase 1: Get Your Model & Animations (15-30 minutes)

1. **Go to Mixamo**: https://www.mixamo.com/
2. **Sign in** with Adobe account (free)
3. **Select a Character**:
   - Search for "Malcolm" (male) or "Kaya" (female)
   - Or browse "Characters" tab
   - Click character to select

4. **Download Character**:
   - Click "Download" button
   - Format: **FBX for Unity (.fbx)** or **glTF (.gltf)**
   - Skin: **With Skin**
   - Frames per second: **30**
   - Download

5. **Download Animations** (get multiple):
   - Stay on same character
   - Click "Animations" tab
   - Search for and download each:
     - "Walking" or "Walking In Place"
     - "Running"
     - "Idle"
     - "Sitting"
     - "Standing Up"
     - "Waving"
   - For each animation:
     - Click animation name
     - Adjust speed/trim if needed
     - Click "Download"
     - Format: **FBX for Unity (.fbx)** ✅ **IMPORTANT: Check "In Place" if available**
     - Skin: **Without Skin**
     - Download

6. **Convert to GLTF** (if you downloaded FBX):
   - Use online converter: https://products.aspose.app/3d/conversion/fbx-to-gltf
   - Or use Blender (see Method 3)
   - Upload your .fbx files
   - Download .gltf or .glb files

#### Phase 2: Prepare Assets (10 minutes)

1. **Create models directory**:

``` text
   frontend/public/models/
   ├── human-figure.glb        ← Character with skin
   ├── animations/
   │   ├── walking.glb         ← Animation files
   │   ├── running.glb
   │   ├── idle.glb
   │   ├── sitting.glb
   │   └── waving.glb
   ```

2. **Optimize files** (optional but recommended):

   ```bash
   npm install -g gltf-pipeline
   gltf-pipeline -i human-figure.glb -o human-figure-optimized.glb -d
   ```

#### Phase 3: Update Code (30-60 minutes)

**File 1: Update `HumanFigure.tsx`**

Replace the entire file with this:

```typescript
import { useEffect, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { Group } from 'three'

type HumanFigureProps = {
  isAnimating: boolean
  currentAnimation?: string
}

/**
 * Professional 3D human figure with Mixamo animations
 */
export default function HumanFigure({ 
  isAnimating, 
  currentAnimation = 'walking' 
}: HumanFigureProps) {
  const group = useRef<Group>(null!)
  
  // Load the character model
  const { scene } = useGLTF('/models/human-figure.glb')
  
  // Load all animation files
  const walkingGltf = useGLTF('/models/animations/walking.glb')
  const runningGltf = useGLTF('/models/animations/running.glb')
  const idleGltf = useGLTF('/models/animations/idle.glb')
  const sittingGltf = useGLTF('/models/animations/sitting.glb')
  const wavingGltf = useGLTF('/models/animations/waving.glb')
  
  // Combine all animations
  const animations = [
    ...(walkingGltf.animations || []),
    ...(runningGltf.animations || []),
    ...(idleGltf.animations || []),
    ...(sittingGltf.animations || []),
    ...(wavingGltf.animations || []),
  ]
  
  // Set up animation actions
  const { actions, names } = useAnimations(animations, group)
  
  // Handle animation playback
  useEffect(() => {
    if (!isAnimating) {
      // Stop all animations
      Object.values(actions).forEach(action => action?.stop())
      return
    }
    
    // Find and play the requested animation
    const actionName = names.find(name => 
      name.toLowerCase().includes(currentAnimation.toLowerCase())
    )
    
    if (actionName && actions[actionName]) {
      // Stop all other animations
      Object.entries(actions).forEach(([name, action]) => {
        if (name !== actionName) {
          action?.stop()
        }
      })
      
      // Play the selected animation
      actions[actionName]
        .reset()
        .fadeIn(0.5)
        .play()
    }
  }, [isAnimating, currentAnimation, actions, names])
  
  return (
    <group ref={group}>
      <primitive object={scene.clone()} />
    </group>
  )
}

// Preload all models for better performance
useGLTF.preload('/models/human-figure.glb')
useGLTF.preload('/models/animations/walking.glb')
useGLTF.preload('/models/animations/running.glb')
useGLTF.preload('/models/animations/idle.glb')
useGLTF.preload('/models/animations/sitting.glb')
useGLTF.preload('/models/animations/waving.glb')
```

**File 2: Update `Viewer3D.tsx`**

Add animation selection:

```typescript
import { useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import Scene from './components/viewer/Scene'
import ViewerControls from './components/viewer/ViewerControls'
import '../styles/viewer3d.css'

type AnimationType = 'walking' | 'running' | 'idle' | 'sitting' | 'waving'

export default function Viewer3D() {
  const navigate = useNavigate()
  const [isAnimating, setIsAnimating] = useState(true)
  const [currentAnimation, setCurrentAnimation] = useState<AnimationType>('walking')
  const cameraControlsRef = useRef<any>(null)

  const handleToggleAnimation = () => {
    setIsAnimating(prev => !prev)
  }

  const handleAnimationChange = (animation: AnimationType) => {
    setCurrentAnimation(animation)
    setIsAnimating(true) // Auto-play when selecting new animation
  }

  const handleResetCamera = () => {
    if (cameraControlsRef.current) {
      cameraControlsRef.current.reset()
    }
  }

  const handleClose = () => {
    navigate('/voice')
  }

  return (
    <div className="viewer3d-container">
      <ViewerControls
        isAnimating={isAnimating}
        currentAnimation={currentAnimation}
        onToggleAnimation={handleToggleAnimation}
        onAnimationChange={handleAnimationChange}
        onResetCamera={handleResetCamera}
        onClose={handleClose}
      />

      <Canvas
        camera={{
          position: [3, 1.5, 3],
          fov: 50,
        }}
        shadows
        className="viewer3d-canvas"
      >
        <Scene 
          isAnimating={isAnimating}
          currentAnimation={currentAnimation}
        />
      </Canvas>
    </div>
  )
}
```

**File 3: Update `Scene.tsx`**

```typescript
import { Suspense } from 'react'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import HumanFigure from './HumanFigure'

type SceneProps = {
  isAnimating: boolean
  currentAnimation?: string
}

export default function Scene({ isAnimating, currentAnimation }: SceneProps) {
  return (
    <>
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={10}
        maxPolarAngle={Math.PI / 2}
      />

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.3}
      />

      <Grid
        args={[10, 10]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#009A44"
        fadeDistance={15}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0, 0]}
      />

      {/* Suspense for loading models */}
      <Suspense fallback={
        <Html center>
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading 3D model...</p>
          </div>
        </Html>
      }>
        <HumanFigure 
          isAnimating={isAnimating}
          currentAnimation={currentAnimation}
        />
      </Suspense>
    </>
  )
}
```

**File 4: Update `ViewerControls.tsx`**

```typescript
type AnimationType = 'walking' | 'running' | 'idle' | 'sitting' | 'waving'

type ViewerControlsProps = {
  isAnimating: boolean
  currentAnimation: AnimationType
  onToggleAnimation: () => void
  onAnimationChange: (animation: AnimationType) => void
  onResetCamera: () => void
  onClose: () => void
}

const animations: Array<{ id: AnimationType; name: string; icon: string }> = [
  { id: 'idle', name: 'Idle', icon: '🧍' },
  { id: 'walking', name: 'Walking', icon: '🚶' },
  { id: 'running', name: 'Running', icon: '🏃' },
  { id: 'sitting', name: 'Sitting', icon: '🪑' },
  { id: 'waving', name: 'Waving', icon: '👋' },
]

export default function ViewerControls({
  isAnimating,
  currentAnimation,
  onToggleAnimation,
  onAnimationChange,
  onResetCamera,
  onClose,
}: ViewerControlsProps) {
  return (
    <>
      <div className="viewer-header">
        <h1 className="viewer-title">3D Anatomy Viewer</h1>
        <button className="viewer-close-btn" onClick={onClose} aria-label="Close viewer">
          ✕
        </button>
      </div>

      <div className="viewer-controls">
        {/* Animation selector */}
        <div className="animation-selector">
          {animations.map(anim => (
            <button
              key={anim.id}
              className={`anim-btn ${currentAnimation === anim.id ? 'anim-btn--active' : ''}`}
              onClick={() => onAnimationChange(anim.id)}
              title={anim.name}
            >
              <span className="anim-icon">{anim.icon}</span>
              <span className="anim-name">{anim.name}</span>
            </button>
          ))}
        </div>

        {/* Playback controls */}
        <button
          className="viewer-btn viewer-btn--primary"
          onClick={onToggleAnimation}
          aria-label={isAnimating ? 'Pause animation' : 'Play animation'}
        >
          {isAnimating ? '⏸ Pause' : '▶ Play'}
        </button>
        
        <button className="viewer-btn" onClick={onResetCamera} aria-label="Reset camera view">
          🔄 Reset View
        </button>

        <div className="viewer-help-text">
          Drag to rotate • Scroll to zoom • Right-click to pan
        </div>
      </div>
    </>
  )
}
```

**File 5: Add to `viewer3d.css`**

Add these styles at the end:

```css
/* Animation Selector */
.animation-selector {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: rgba(255, 255, 255, 0.9);
  border-radius: 999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.anim-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-sm);
  background: transparent;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.anim-btn:hover {
  background: rgba(0, 154, 68, 0.1);
  border-color: var(--color-und-green);
}

.anim-btn--active {
  background: var(--color-und-green);
  border-color: var(--color-und-green);
}

.anim-btn--active .anim-icon {
  filter: grayscale(100%) brightness(200%);
}

.anim-btn--active .anim-name {
  color: white;
}

.anim-icon {
  font-size: 1.5rem;
}

.anim-name {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-primary);
}

/* Loading Spinner */
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  color: var(--text-primary);
  font-family: system-ui, sans-serif;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 154, 68, 0.2);
  border-top-color: var(--color-und-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .animation-selector {
    gap: var(--space-xs);
  }
  
  .anim-btn {
    min-width: 50px;
    padding: var(--space-xs);
  }
  
  .anim-icon {
    font-size: 1.2rem;
  }
  
  .anim-name {
    font-size: 0.6rem;
  }
}
```

---

## 📋 Method 2: Ready Player Me (For Custom Avatars)

### Why Ready Player Me?

- Customizable avatars (hair, skin, clothing)
- API integration possible
- Good for personalized patient avatars
- Free tier available

### Implementation

```typescript
// Install the SDK
npm install @readyplayerme/rpm-react-sdk

// Use in component
import { AvatarCreator } from '@readyplayerme/rpm-react-sdk'

function AvatarSelector() {
  const handleOnAvatarExported = (event: any) => {
    const avatarUrl = event.data.url
    // Download and use this GLTF model
    console.log('Avatar URL:', avatarUrl)
  }

  return (
    <AvatarCreator 
      subdomain="your-subdomain"
      onAvatarExported={handleOnAvatarExported}
    />
  )
}
```

---

## 📋 Method 3: Custom Blender Models (Advanced Medical Accuracy)

### When to Use

- Need anatomically accurate models
- Specific medical scenarios
- Custom branding/styling
- Maximum control

### Workflow

1. **Create/Obtain Base Model**:
   - MakeHuman (free): http://www.makehumancommunity.org/
   - Or purchase from TurboSquid, CGTrader
   - Medical models: 3D4Medical, Zygote

2. **Rig in Blender**:

``` text
   Open Blender → Import model → Add Armature → 
   Auto-rig with Rigify addon → Weight paint
   ```

3. **Create Animations**:
   - Pose mode → Add keyframes
   - Or use motion capture data
   - Or retarget from Mixamo

4. **Export to GLTF**:

``` text
   File → Export → glTF 2.0 (.glb)
   ✅ Include: Selected Objects
   ✅ Remember Animation
   ✅ Compression
   ```

5. **Use in React Three Fiber** (same code as Method 1)

---

## 📋 Method 4: Purchased Professional Assets

### Recommended Marketplaces

**Medical-Specific:**

- **Zygote**: https://www.zygote.com/ ($$ professional medical)
- **TurboSquid Medical**: https://www.turbosquid.com/Search/3D-Models/medical
- **CGTrader Medical**: https://www.cgtrader.com/3d-models/medical

**General High-Quality:**

- **Sketchfab Store**: https://sketchfab.com/store
- **Unity Asset Store**: https://assetstore.unity.com/
- **Unreal Marketplace**: https://www.unrealengine.com/marketplace

### What to Look For

- ✅ GLTF/GLB or FBX format
- ✅ Rigged character
- ✅ Includes animations OR rigged for custom animation
- ✅ PBR materials (Physically Based Rendering)
- ✅ Optimized poly count (10k-50k triangles)
- ✅ Commercial license

---

## 🔧 Advanced Features Framework

### 1. Animation Blending

```typescript
import { useEffect } from 'react'

function HumanFigure() {
  const { actions } = useAnimations(animations, group)
  
  const transitionToAnimation = (fromName: string, toName: string) => {
    const from = actions[fromName]
    const to = actions[toName]
    
    if (from && to) {
      from.fadeOut(0.5)
      to.reset().fadeIn(0.5).play()
    }
  }
  
  return (...)
}
```

### 2. Interactive Body Parts

```typescript
function InteractiveHumanFigure() {
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  
  return (
    <group>
      {/* Make body parts clickable */}
      <mesh 
        onClick={(e) => {
          e.stopPropagation()
          setSelectedPart('leftArm')
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default'
        }}
      >
        {/* Body part geometry */}
      </mesh>
      
      {selectedPart && (
        <Html position={[0, 2, 0]}>
          <div className="body-part-info">
            <h3>{selectedPart}</h3>
            <p>Anatomical information...</p>
          </div>
        </Html>
      )}
    </group>
  )
}
```

### 3. Medical Annotations

```typescript
import { Html } from '@react-three/drei'

const annotations = [
  { position: [0.3, 1.2, 0], label: 'Shoulder Joint', info: 'Glenohumeral joint...' },
  { position: [0.15, 0.6, 0], label: 'Knee Joint', info: 'Largest joint...' },
]

function AnnotatedFigure() {
  return (
    <group>
      <HumanFigure />
      {annotations.map((ann, i) => (
        <Html key={i} position={ann.position}>
          <div className="annotation-marker" title={ann.info}>
            <div className="annotation-dot" />
            <div className="annotation-label">{ann.label}</div>
          </div>
        </Html>
      ))}
    </group>
  )
}
```

### 4. Camera Presets

```typescript
const cameraPresets = {
  front: { position: [0, 1.5, 3], target: [0, 1, 0] },
  side: { position: [3, 1.5, 0], target: [0, 1, 0] },
  back: { position: [0, 1.5, -3], target: [0, 1, 0] },
  top: { position: [0, 5, 0], target: [0, 0, 0] },
}

function Scene() {
  const controlsRef = useRef()
  
  const moveCameraTo = (preset: keyof typeof cameraPresets) => {
    const { position, target } = cameraPresets[preset]
    // Smooth camera transition
    // Use react-spring or gsap for animation
  }
  
  return (
    <>
      <OrbitControls ref={controlsRef} />
      {/* Add preset buttons in UI */}
    </>
  )
}
```

---

## 🚀 Deployment Checklist

### Before Production

- [ ] Optimize all GLTF models (use gltf-pipeline)
- [ ] Add loading states and progress indicators
- [ ] Test on mobile devices
- [ ] Verify all animations play correctly
- [ ] Check performance (maintain 60fps)
- [ ] Add error boundaries for failed model loads
- [ ] Implement lazy loading for large assets
- [ ] Add fallback for WebGL unsupported browsers
- [ ] Test accessibility (keyboard navigation)
- [ ] Verify medical accuracy (consult with medical staff)

### Performance Optimization

```typescript
// 1. Use Draco compression
npm install draco3dgltf
// Enable in useGLTF

// 2. Implement LOD (Level of Detail)
import { Detailed } from '@react-three/drei'

<Detailed distances={[0, 10, 20]}>
  <HighPolyModel />
  <MediumPolyModel />
  <LowPolyModel />
</Detailed>

// 3. Lazy load models
const HumanFigure = lazy(() => import('./HumanFigure'))
```

---

## 📞 Getting Help

### Your Team Can Focus On:

**Designer/Artist:**

- Select and customize models from Mixamo
- Adjust colors/materials in Blender
- Create branded clothing/accessories

**Junior Developer:**

- Handle file organization
- Implement loading states
- Style UI controls
- Test on different devices

**Senior Developer:**

- Set up animation system
- Implement interactive features
- Optimize performance
- Handle edge cases

---

## ✅ Next Action Items

### Immediate (1-2 hours):

1. ☐ Go to Mixamo and download Malcolm character + 3 animations
2. ☐ Convert to GLTF if needed
3. ☐ Place files in `frontend/public/models/`
4. ☐ Update code files as shown above
5. ☐ Test in browser

### Short-term (1-2 days):

1. ☐ Add all desired animations from Mixamo
2. ☐ Implement animation selector UI
3. ☐ Add loading indicators
4. ☐ Test and refine

### Long-term (1-2 weeks):

1. ☐ Evaluate need for custom medical models
2. ☐ Add interactive features (annotations, clickable parts)
3. ☐ Implement camera presets
4. ☐ Medical accuracy review
5. ☐ Performance optimization

---

**You're now equipped with everything needed to integrate professional 3D models! Start with Mixamo Method 1 - it's the fastest path to impressive results.**
