import { Grid } from '@react-three/drei'

export type SceneEnvironmentProps = {
  /** Lighting preset: 'full' (3-point), 'minimal' (ambient + 1 directional) */
  lighting?: 'full' | 'minimal'
  /** Show grid? */
  showGrid?: boolean
  /** Grid size */
  gridSize?: number
  /** Grid cell size */
  gridCellSize?: number
  /** Ambient light intensity */
  ambientIntensity?: number
  /** Directional light intensity */
  directionalIntensity?: number
}

/**
 * Reusable scene environment setup for 3D viewers
 * Provides consistent lighting and grid across full and mini viewers
 */
export default function SceneEnvironment({
  lighting = 'full',
  showGrid = true,
  gridSize = 12,
  gridCellSize = 0.5,
  ambientIntensity = 0.6,
  directionalIntensity = 1.0,
}: SceneEnvironmentProps) {
  return (
    <>
      {/* Ambient light - soft fill */}
      <ambientLight intensity={ambientIntensity} />

      {lighting === 'full' ? (
        <>
          {/* Key light - main directional */}
          <directionalLight
            position={[5, 10, 7]}
            intensity={directionalIntensity}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          {/* Fill light - soften shadows */}
          <directionalLight position={[-3, 5, -5]} intensity={0.3} />
          {/* Rim light - edge definition */}
          <directionalLight position={[0, 5, -10]} intensity={0.2} />
        </>
      ) : (
        <>
          {/* Minimal: single directional light */}
          <directionalLight
            position={[5, 10, 7]}
            intensity={directionalIntensity}
          />
        </>
      )}

      {/* Ground grid */}
      {showGrid && (
        <Grid
          args={[gridSize, gridSize]}
          cellSize={gridCellSize}
          cellThickness={0.5}
          cellColor="#6e6e6e"
          sectionSize={3}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={false}
        />
      )}
    </>
  )
}
