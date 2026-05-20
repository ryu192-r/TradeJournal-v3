/** Frontend performance instrumentation
 *  Usage: mark('dashboard:render-start'); measure('dashboard:render', 'dashboard:render-start');
 */

type PerfEntry = { name: string; start?: number; end?: number; duration?: number }

const entries: PerfEntry[] = []
let active = false

/** Enable/disable logging */
export function setPerfActive(v: boolean) {
  active = v
  if (v) console.log('[perf] instrumentation active')
}

/** Create a performance mark */
export function mark(name: string) {
  if (typeof performance !== 'undefined' && performance.mark) {
    try { performance.mark(name) } catch {}
  }
  if (active && typeof console !== 'undefined') {
    console.log(`[perf] mark  ${name} @ ${Date.now()}`)
  }
}

/** Measure between two marks */
export function measure(name: string, startMark: string, endMark?: string) {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark)
      const mList = performance.getEntriesByName(name, 'measure')
      const m = mList[mList.length - 1]
      if (m && active) {
        entries.push({ name, duration: m.duration })
        console.log(`[perf] measure ${name} = ${m.duration.toFixed(1)}ms`)
      }
    } catch {}
  }
}

/** Simple span timer: returns a function that ends the span */
export function span(name: string): () => void {
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
  if (typeof performance !== 'undefined') {
    try { performance.clearMarks(); performance.clearMeasures() } catch {}
  }
  entries.length = 0
}

/** Auto-enable in development */
if (import.meta.env.DEV) setPerfActive(true)
