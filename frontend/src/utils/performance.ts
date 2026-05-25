/** Frontend performance instrumentation
 *  Usage: mark('dashboard:render-start'); measure('dashboard:render', 'dashboard:render-start');
 */

type PerfEntry = { name: string; start?: number; end?: number; duration?: number }

const entries: PerfEntry[] = []
let active = false
const isDev = import.meta.env.DEV

/** Enable/disable logging */
export function setPerfActive(v: boolean) {
  active = isDev && v
  if (active) console.log('[perf] instrumentation active')
}

/** Create a performance mark */
export function mark(name: string) {
  if (!isDev) return
  if (typeof performance !== 'undefined' && performance.mark) {
    try { performance.mark(name) } catch { /* noop — performance API may not be available */ }
  }
  if (active && typeof console !== 'undefined') {
    console.log(`[perf] mark  ${name} @ ${Date.now()}`)
  }
}

/** Measure between two marks */
export function measure(name: string, startMark: string, endMark?: string) {
  if (!isDev) return
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark)
      const mList = performance.getEntriesByName(name, 'measure')
      const m = mList[mList.length - 1]
      if (m && active) {
        entries.push({ name, duration: m.duration })
        console.log(`[perf] measure ${name} = ${m.duration.toFixed(1)}ms`)
      }
    } catch { /* noop — performance API may not be available */ }
  }
}

/** Simple span timer: returns a function that ends the span */
export function span(name: string): () => void {
  if (!isDev) return () => {}
  const s = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return () => {
    const e = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dur = e - s
    if (active) {
      entries.push({ name, duration: dur })
      console.log(`[perf] span   ${name} = ${dur.toFixed(1)}ms`)
    }
  }
}

/** Log all collected measures */
export function logMeasures(limit = 20) {
  if (!active) return
  const recent = entries.slice(-limit)
  if (!recent.length) return
  console.group?.(`[perf] last ${recent.length} measures`)
  for (const entry of recent) {
    console.log(`  ${entry.name}: ${(entry.duration ?? 0).toFixed(1)}ms`)
  }
  console.groupEnd?.()
}

/** Clear all marks/measures */
export function clearPerf() {
  if (!isDev) return
  if (typeof performance !== 'undefined') {
    try { performance.clearMarks(); performance.clearMeasures() } catch { /* noop */ }
  }
  entries.length = 0
}

/** Auto-enable in development */
if (isDev) setPerfActive(true)
