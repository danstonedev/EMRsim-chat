import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useState } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import RenderProfiler from './renderProfiler'
import {
  getRenderMetricsSnapshot,
  resetRenderMetrics,
  setRenderMetricsOverride,
} from './renderMetrics'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..')
const perfDir = path.resolve(repoRoot, 'docs', 'perf')
const jsonPath = path.resolve(perfDir, 'metrics-baseline.json')

describe('Render metrics baseline snapshot', () => {
  it('generates a baseline JSON snapshot', () => {
    setRenderMetricsOverride(true)

    const TestChild = ({ value }: { value: number }) => {
      const [local] = useState(value)
      return <span>{local}</span>
    }

    const { rerender, unmount } = render(
      <RenderProfiler id="BaselineDemo">
        <TestChild value={0} />
      </RenderProfiler>
    )

    rerender(
      <RenderProfiler id="BaselineDemo">
        <TestChild value={1} />
      </RenderProfiler>
    )

    rerender(
      <RenderProfiler id="BaselineDemo">
        <TestChild value={2} />
      </RenderProfiler>
    )

    unmount()

    const snapshot = getRenderMetricsSnapshot()

    // Ensure perf dir exists and write snapshot
    fs.mkdirSync(perfDir, { recursive: true })
    fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), 'utf-8')

    expect(fs.existsSync(jsonPath)).toBe(true)

    resetRenderMetrics()
    setRenderMetricsOverride(null)
  })
})
