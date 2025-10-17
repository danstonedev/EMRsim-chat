import { Profiler, useMemo, type ReactNode } from 'react'
import { getProfilerCallback, renderMetricsEnabled } from './renderMetrics'

type RenderProfilerProps = {
  id: string
  children: ReactNode
}

export default function RenderProfiler({ id, children }: RenderProfilerProps) {
  const enabled = renderMetricsEnabled()

  const callback = useMemo(() => getProfilerCallback(id), [id])

  if (!enabled) {
    return <>{children}</>
  }

  return (
    <Profiler id={id} onRender={callback}>
      {children}
    </Profiler>
  )
}
