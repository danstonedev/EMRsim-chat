import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Character model component with optimizations
const Character = React.memo(({ modelPath, animationName = 'Idle', position = [0, 0, 0] }) => {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions, names } = useAnimations(animations, group);
  
  // Manage animations
  useEffect(() => {
    // Reset all animations first
    Object.values(actions).forEach(action => action.stop());
    
    // Play the selected animation if it exists
    if (actions[animationName]) {
      actions[animationName].reset().fadeIn(0.5).play();
    }
    
    return () => {
      // Clean up animations on unmount or when animation changes
      if (actions[animationName]) {
        actions[animationName].fadeOut(0.5);
      }
    };
  }, [actions, animationName]);
  
  // Clone the scene to avoid modifying the cached original
  const model = useMemo(() => {
    return scene.clone();
  }, [scene]);
  
  return (
    <group ref={group} position={position} dispose={null}>
      <primitive object={model} />
    </group>
  );
});

// Memoize environment components to prevent re-renders
const Environment = React.memo(() => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      <gridHelper args={[10, 10, `white`, `gray`]} />
    </>
  );
});

// Optimization wrapper for the entire Canvas
const ThreeDViewerOptimized = React.memo(({ 
  modelPath, 
  animationName, 
  isActive = true,
  onAnimationComplete = () => {},
  lowPowerMode = false,
  position = [0, -1, 0]
}) => {
  // Throttle frame rate when not active to save power
  const frameLoop = useMemo(() => {
    if (!isActive) return 'demand'; // Only render when needed
    if (lowPowerMode) return 'always'; // Always render but with potential frame skipping
    return 'always'; // Always render at full frame rate
  }, [isActive, lowPowerMode]);
  
  // Lower pixel ratio when in low power mode
  const pixelRatio = useMemo(() => {
    if (lowPowerMode) return Math.min(1.5, window.devicePixelRatio);
    return window.devicePixelRatio;
  }, [lowPowerMode]);
  
  // Track animation progress for completion callback
  const [animationProgress, setAnimationProgress] = useState(0);
  
  useEffect(() => {
    // Simulate animation progress tracking
    if (isActive && animationProgress >= 1) {
      onAnimationComplete();
    }
  }, [animationProgress, isActive, onAnimationComplete]);

  return (
    <Canvas 
      frameloop={frameLoop}
      shadows
      dpr={pixelRatio}
      gl={{ 
        antialias: !lowPowerMode,
        powerPreference: "high-performance",
        alpha: true,
        preserveDrawingBuffer: false,
      }}
      camera={{ 
        position: [0, 1.5, 4], 
        fov: 50 
      }}
      performance={{ min: 0.5 }}
      style={{
        background: 'transparent'
      }}
    >
      <Environment />
      <Character 
        modelPath={modelPath} 
        animationName={animationName}
        position={position} 
      />
      <OrbitControls 
        enableDamping={true} 
        dampingFactor={0.05}
        enableZoom={true}
        enablePan={false}
        minDistance={2}
        maxDistance={10}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
      {!lowPowerMode && process.env.NODE_ENV !== 'production' && <Stats />}
    </Canvas>
  );
});

/**
 * Main container component that handles performance optimization
 * for the 3D viewer when a chat session is active.
 */
function ThreeDViewerContainer({
  modelPath = '/models/character.glb',
  initialAnimation = 'Idle',
  chatActive = false
}) {
  const [animation, setAnimation] = useState(initialAnimation);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [pauseRendering, setPauseRendering] = useState(false);
  const frameCountRef = useRef(0);
  const containerRef = useRef();
  
  // Monitor visibility of the 3D container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setPauseRendering(!entry.isIntersecting);
      },
      { threshold: 0.1 } // 10% visibility threshold
    );
    
    observer.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);
  
  // Enable low power mode when chat is active
  useEffect(() => {
    if (chatActive) {
      setLowPowerMode(true);
    } else {
      // Short delay before returning to full power mode
      // to prevent flickering if chat toggles quickly
      const timer = setTimeout(() => {
        setLowPowerMode(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [chatActive]);
  
  // Change animation based on chat status for demo purposes
  useEffect(() => {
    setAnimation(chatActive ? 'Talk' : 'Idle');
  }, [chatActive]);
  
  // Handle animation completion
  const handleAnimationComplete = () => {
    console.log('Animation complete');
    // Additional logic here if needed
  };
  
  return (
    <div 
      ref={containerRef}
      className={`three-d-viewer-container ${chatActive ? 'chat-active' : ''}`}
      style={{
        width: '100%',
        height: '500px',
        opacity: pauseRendering ? 0.5 : 1,
        transition: 'opacity 0.3s ease'
      }}
    >
      <ThreeDViewerOptimized
        modelPath={modelPath}
        animationName={animation}
        isActive={!pauseRendering}
        lowPowerMode={lowPowerMode}
        onAnimationComplete={handleAnimationComplete}
      />
      
      {lowPowerMode && (
        <div className="power-mode-indicator">
          Low Power Mode
        </div>
      )}
    </div>
  );
}

export default ThreeDViewerContainer;
