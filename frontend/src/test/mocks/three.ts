// Lightweight global mock of the 'three' package for unit tests.
// Only implements the minimal surface used by our code/tests to avoid heavy WebGL/worker paths.

export const LoopOnce = 2200
export const LoopRepeat = 2201

export class Vector3 {
  x: number; y: number; z: number
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
  set(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; return this }
  clone() { return new Vector3(this.x, this.y, this.z) }
  copy(v: Vector3) { this.x = v.x; this.y = v.y; this.z = v.z; return this }
  addVectors(a: Vector3, b: Vector3) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; return this }
  subVectors(a: Vector3, b: Vector3) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this }
  multiplyScalar(s: number) { this.x *= s; this.y *= s; this.z *= s; return this }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setFromMatrixPosition(__arg: any) { return this }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  project(__arg: any) { return this }
}

export class Sphere {
  center: Vector3
  radius: number
  constructor(center: Vector3 = new Vector3(), radius = 1) { this.center = center; this.radius = radius }
  set(center: Vector3, radius: number) { this.center = center; this.radius = radius; return this }
}

export class Box3 {
  min = new Vector3(0, 0, 0)
  max = new Vector3(1, 1, 1)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setFromObject(__arg: any) { return this }
  getSize(target?: Vector3) {
    const size = new Vector3(this.max.x - this.min.x, this.max.y - this.min.y, this.max.z - this.min.z)
    if (target) return target.copy(size)
    return size
  }
  getBoundingSphere(sphere?: Sphere) {
    const s = sphere || new Sphere()
    s.center = new Vector3(0.5, 0.5, 0.5)
    s.radius = 1
    return s
  }
}

export class Object3D {
  name = ''
  children: any[] = []
  traverse(fn: (o: any) => void) { fn(this); for (const c of this.children) { if (typeof (c as any)?.traverse === 'function') (c as any).traverse(fn); else fn(c) } }
  add(...objs: any[]) { this.children.push(...objs); return this }
}

export class Group extends Object3D {}

export class AnimationClip {
  name: string
  duration: number
  tracks: any[]
  constructor(name = 'clip', duration = 1, tracks: any[] = []) { this.name = name; this.duration = duration; this.tracks = tracks }
  clone() { return new AnimationClip(this.name, this.duration, this.tracks.slice()) }
}

export class AnimationMixer {
  _root: any
  constructor(root?: any) { this._root = root }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(__delta: number) { /* noop */ }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addEventListener(__type: string, __handler: any) { /* noop */ }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  removeEventListener(__type: string, __handler: any) { /* noop */ }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clipAction(__clip: any) { return {} as any }
}

export const MathUtils = {
  generateUUID() { return 'mock-uuid' },
}

// Useful type-only re-exports fallback
export type { AnimationMixer as AnimationMixerType, AnimationClip as AnimationClipType }
