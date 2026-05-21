import { useEffect, useRef } from 'react'
import { mark, measure, span } from '@/utils/performance'

/**
 * Log component mount + first render time.
 * Call at top of heavy components (DashboardPage, AnalyticsDashboardPage, etc.)
 */
export function usePerfMountLog(name: string) {
  const endRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    endRef.current = span(`render:${name}`)
    return () => {
      if (endRef.current) { endRef.current(); endRef.current = null }
    }
  }, [name])
}

/**
 * Log component render span using start/end marks.
 * Use in `useEffect` to bracket visual paint.
 */
export function logPaint(name: string) {
  mark(`paint:${name}`)
  measure(`paint-time:${name}`, 'navigationStart', `paint:${name}`)
}
