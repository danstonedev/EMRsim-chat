import { describe, it, expect, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useState } from 'react'
import RenderProfiler from './renderProfiler'
import {
  getRenderMetricsSnapshot,
  resetRenderMetrics,
  setRenderMetricsOverride,
} from './renderMetrics'

afterEach(() => {
  resetRenderMetrics()
  setRenderMetricsOverride(null)
})

describe('RenderProfiler', () => {
  it('collects render metrics during re-renders', () => {
    setRenderMetricsOverride(true)

    const TestChild = ({ value }: { value: number }) => {
      const [local] = useState(value)
      return <span>{local}</span>
    }

    const { rerender, unmount } = render(
      <RenderProfiler id="RenderProfilerTest">
        <TestChild value={0} />
      </RenderProfiler>
    )

    rerender(
      <RenderProfiler id="RenderProfilerTest">
        <TestChild value={1} />
      </RenderProfiler>
    )

    rerender(
      <RenderProfiler id="RenderProfilerTest">
        <TestChild value={2} />
      </RenderProfiler>
    )

    unmount()

    const snapshot = getRenderMetricsSnapshot()
    const metrics = snapshot.RenderProfilerTest

    expect(metrics).toBeDefined()
    expect(metrics.commits).toBeGreaterThanOrEqual(2)
    expect(metrics.totalActual).toBeGreaterThanOrEqual(0)
    expect(metrics.totalBase).toBeGreaterThanOrEqual(0)
  })
})
