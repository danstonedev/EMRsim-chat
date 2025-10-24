import { createElement, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

type DebugHelpersProps = {
  target: THREE.Object3D
  showBox?: boolean
  label?: string
}

export function DebugHelpers({ target, showBox = true, label }: DebugHelpersProps) {
  const axes = useMemo(() => new THREE.AxesHelper(0.5), [])
  const boxHelper = useMemo(() => new THREE.BoxHelper(target, 0xff0000), [target])

  useEffect(() => {
    if (!showBox) return
    boxHelper.update()
  }, [boxHelper, showBox, target])

  return createElement(
    'group',
    null,
    createElement('primitive', { object: axes }),
    showBox ? createElement('primitive', { object: boxHelper }) : null,
    label
      ? createElement(
          Html as any,
          { distanceFactor: 10, position: [0, 1.8, 0], style: { pointerEvents: 'none' } },
          createElement('div', { className: 'r3f-debug-label' }, label)
        )
      : null
  )
}
