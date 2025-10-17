# 3D Animation Development Guide

## Current Implementation

The 3D viewer currently features a simple walking animation using sine wave motion for arms and legs. This document outlines how to develop more sophisticated animations.

## Animation Architecture

### Current Animation System
Location: `frontend/src/pages/components/viewer/HumanFigure.tsx`

```typescript
useFrame((_state, delta) => {
  if (!isAnimating) return
  
  const time = animationTime + delta * 2 // Animation speed
  setAnimationTime(time)
  
  // Leg swing (opposite motion)
  leftLegRef.current.rotation.x = Math.sin(time) * 0.5
  rightLegRef.current.rotation.x = Math.sin(time + Math.PI) * 0.5
  
  // Arm swing (opposite to legs)
  leftArmRef.current.rotation.x = Math.sin(time + Math.PI) * 0.3
  rightArmRef.current.rotation.x = Math.sin(time) * 0.3
})
```

## Enhancement Options

### Phase 1: Improve Walking Animation

#### 1. Add Torso Movement
Add natural torso rotation during walking:

```typescript
const torsoRef = useRef<THREE.Mesh>(null!)

// In useFrame:
if (torsoRef.current) {
  // Subtle torso rotation opposite to arm swing
  torsoRef.current.rotation.y = Math.sin(time) * 0.05
  // Slight forward lean during walk
  torsoRef.current.rotation.x = -0.1
}
```

#### 2. Add Head Bob
Natural vertical head movement:

```typescript
const headRef = useRef<THREE.Mesh>(null!)

// In useFrame:
if (headRef.current) {
  // Bob up and down twice per walking cycle
  headRef.current.position.y = 1.6 + Math.abs(Math.sin(time * 2)) * 0.03
}
```

#### 3. Add Knee Bending
Create more realistic leg articulation:

```typescript
const leftThighRef = useRef<THREE.Group>(null!)
const leftCalfRef = useRef<THREE.Mesh>(null!)

// In useFrame:
if (leftThighRef.current && leftCalfRef.current) {
  const legAngle = Math.sin(time) * 0.5
  leftThighRef.current.rotation.x = legAngle
  
  // Knee bends more when leg swings forward
  const kneeBend = legAngle > 0 ? Math.abs(legAngle) * 0.8 : 0
  leftCalfRef.current.rotation.x = -kneeBend
}
```

### Phase 2: Multiple Animation Types

#### Animation Manager Pattern

```typescript
type AnimationType = 'walking' | 'running' | 'sitting' | 'standing' | 'waving'

type AnimationConfig = {
  duration: number
  keyframes: Array<{
    time: number
    transforms: {
      [key: string]: { x?: number; y?: number; z?: number }
    }
  }>
}

const animations: Record<AnimationType, AnimationConfig> = {
  walking: {
    duration: 2,
    keyframes: [
      {
        time: 0,
        transforms: {
          leftLeg: { x: 0 },
          rightLeg: { x: 0 },
        }
      },
      {
        time: 0.5,
        transforms: {
          leftLeg: { x: 0.5 },
          rightLeg: { x: -0.5 },
        }
      },
      // ... more keyframes
    ]
  },
  // ... more animations
}
```

#### Using Animation Mixer

For complex animations, use Three.js AnimationMixer:

```typescript
import { useAnimations } from '@react-three/drei'

function HumanFigure() {
  const group = useRef<THREE.Group>()
  const { actions, names } = useAnimations(animations, group)
  
  useEffect(() => {
    if (actions[names[0]]) {
      actions[names[0]].play()
    }
  }, [actions, names])
  
  return <group ref={group}>...</group>
}
```

### Phase 3: Load 3D Models with Animations

#### Using GLTF Models

Replace geometric primitives with proper 3D models:

```typescript
import { useGLTF, useAnimations } from '@react-three/drei'

function HumanFigure({ isAnimating }: HumanFigureProps) {
  const group = useRef<THREE.Group>(null!)
  
  // Load model from file
  const { scene, animations } = useGLTF('/models/human-figure.glb')
  const { actions } = useAnimations(animations, group)
  
  useEffect(() => {
    if (isAnimating && actions['Walking']) {
      actions['Walking'].play()
    } else {
      actions['Walking']?.stop()
    }
  }, [isAnimating, actions])
  
  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}
```

#### Recommended 3D Model Sources

1. **Mixamo** (https://www.mixamo.com/)
   - Free rigged human models
   - Extensive animation library
   - Walk, run, jump, medical movements
   - Export as FBX or GLTF

2. **Sketchfab** (https://sketchfab.com/)
   - Medical/anatomical models
   - CC-licensed free models
   - GLTF format support

3. **Ready Player Me** (https://readyplayer.me/)
   - Customizable avatars
   - API integration
   - GLTF export

### Phase 4: Advanced Features

#### 1. Morphing Between Animations

Smooth transitions between animation states:

```typescript
const [currentAnimation, setCurrentAnimation] = useState('walking')
const [nextAnimation, setNextAnimation] = useState<string | null>(null)
const [blendTime, setBlendTime] = useState(0)

useEffect(() => {
  if (nextAnimation && actions[currentAnimation] && actions[nextAnimation]) {
    const current = actions[currentAnimation]
    const next = actions[nextAnimation]
    
    current.fadeOut(0.5)
    next.reset().fadeIn(0.5).play()
    
    setTimeout(() => {
      setCurrentAnimation(nextAnimation)
      setNextAnimation(null)
    }, 500)
  }
}, [nextAnimation, actions, currentAnimation])
```

#### 2. Inverse Kinematics (IK)

Make limbs reach for specific targets:

```typescript
import { IKSolver } from 'three/examples/jsm/animation/CCDIKSolver'

// Apply IK to reach for a target position
const ikSolver = new IKSolver(skeleton, [
  {
    target: targetBoneIndex,
    effector: effectorBoneIndex,
    iteration: 10
  }
])

// In animation loop
ikSolver.update()
```

#### 3. Physics-Based Animation

Add realistic physics using Cannon.js or Rapier:

```typescript
import { Physics, useBox, useSphere } from '@react-three/cannon'

function PhysicsHumanFigure() {
  const [headRef, headApi] = useSphere(() => ({
    mass: 1,
    position: [0, 1.6, 0]
  }))
  
  return (
    <Physics>
      <mesh ref={headRef}>
        <sphereGeometry args={[0.15]} />
        <meshStandardMaterial color="#f5d6c6" />
      </mesh>
    </Physics>
  )
}
```

## Animation Controls UI Enhancement

### Add Animation Selector

Update `ViewerControls.tsx`:

```typescript
type Animation = {
  id: string
  name: string
  icon: string
}

const animations: Animation[] = [
  { id: 'walking', name: 'Walking', icon: '🚶' },
  { id: 'running', name: 'Running', icon: '🏃' },
  { id: 'sitting', name: 'Sitting', icon: '🪑' },
  { id: 'waving', name: 'Waving', icon: '👋' },
]

export default function ViewerControls({ 
  selectedAnimation,
  onAnimationChange,
  ...otherProps 
}) {
  return (
    <>
      <div className="viewer-controls">
        {/* Animation selector */}
        <div className="animation-selector">
          {animations.map(anim => (
            <button
              key={anim.id}
              className={`anim-btn ${selectedAnimation === anim.id ? 'anim-btn--active' : ''}`}
              onClick={() => onAnimationChange(anim.id)}
              title={anim.name}
            >
              <span className="anim-icon">{anim.icon}</span>
              <span className="anim-name">{anim.name}</span>
            </button>
          ))}
        </div>
        
        {/* Existing controls */}
        ...
      </div>
    </>
  )
}
```

### Add Animation Speed Control

```typescript
const [animationSpeed, setAnimationSpeed] = useState(1)

// In ViewerControls
<div className="speed-control">
  <label htmlFor="speed-slider">Speed</label>
  <input
    id="speed-slider"
    type="range"
    min="0.25"
    max="2"
    step="0.25"
    value={animationSpeed}
    onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
  />
  <span className="speed-value">{animationSpeed}x</span>
</div>

// In HumanFigure useFrame
const time = animationTime + delta * animationSpeed
```

## Medical/Clinical Animations

### Movement Assessment Animations

```typescript
const medicalAnimations = {
  // Range of Motion Tests
  shoulderFlexion: { /* Arm raising forward */ },
  shoulderAbduction: { /* Arm raising to side */ },
  kneeFlexion: { /* Knee bending */ },
  
  // Gait Analysis
  normalGait: { /* Standard walking pattern */ },
  antalgicGait: { /* Pain-avoidance walking */ },
  trendelenburgGait: { /* Hip weakness pattern */ },
  
  // Balance Tests
  rombergTest: { /* Standing balance */ },
  singleLegStance: { /* Balance on one leg */ },
  
  // Functional Movements
  sitToStand: { /* Chair rise */ },
  reachAndGrasp: { /* Reaching motion */ },
  bending: { /* Spinal flexion */ },
}
```

### Injury/Pathology Visualization

```typescript
// Visual indicators for injuries or pain
<mesh position={[0.25, 1.0, 0]}>
  {/* Red glow for inflammation */}
  <sphereGeometry args={[0.1]} />
  <meshBasicMaterial 
    color="#ff0000" 
    transparent 
    opacity={0.3}
  />
</mesh>

// Highlight specific muscle groups
<meshStandardMaterial 
  color={isHighlighted ? '#ff671f' : '#009A44'}
  emissive={isHighlighted ? '#ff671f' : '#000000'}
  emissiveIntensity={isHighlighted ? 0.5 : 0}
/>
```

## Performance Optimization

### 1. Use Instancing for Multiple Figures

```typescript
import { Instances, Instance } from '@react-three/drei'

<Instances>
  <boxGeometry />
  <meshStandardMaterial />
  <Instance position={[0, 0, 0]} />
  <Instance position={[2, 0, 0]} />
  <Instance position={[4, 0, 0]} />
</Instances>
```

### 2. Level of Detail (LOD)

```typescript
import { Lod } from '@react-three/drei'

<Lod distances={[0, 10, 20]}>
  <DetailedModel />
  <SimplifiedModel />
  <VerySimpleModel />
</Lod>
```

### 3. Suspend Model Loading

```typescript
import { Suspense } from 'react'
import { Html } from '@react-three/drei'

<Suspense fallback={
  <Html center>
    <div className="loading-indicator">Loading 3D model...</div>
  </Html>
}>
  <HumanFigure />
</Suspense>
```

## Testing Animations

### Animation Testing Checklist

- [ ] Animation loops smoothly without jumps
- [ ] Transition between animations is smooth
- [ ] Animation speed control works correctly
- [ ] Animation respects play/pause state
- [ ] No performance issues at target framerate (60fps)
- [ ] Animation looks natural from all camera angles
- [ ] Mobile devices can handle animation smoothly
- [ ] Animations are medically/anatomically accurate

## Resources

### Learning Resources
- **React Three Fiber Docs**: https://docs.pmnd.rs/react-three-fiber
- **Three.js Fundamentals**: https://threejs.org/manual/
- **Drei Helpers**: https://github.com/pmndrs/drei
- **Animation Techniques**: https://threejs.org/docs/#manual/en/introduction/Animation-system

### Asset Sources
- **Mixamo**: Free rigged characters and animations
- **Sketchfab**: 3D models and animations
- **TurboSquid**: Professional 3D assets
- **Human Anatomy Atlas**: Medical reference

### Tools
- **Blender**: 3D modeling and animation (free)
- **glTF-Pipeline**: Optimize GLTF models
- **gltfjsx**: Convert GLTF to JSX components
- **React Three Editor**: Visual scene editing

---

**Next Steps**: 
1. Choose an animation approach (procedural vs. model-based)
2. Select or create 3D model assets
3. Implement animation system
4. Add UI controls for animation selection
5. Test and optimize performance
