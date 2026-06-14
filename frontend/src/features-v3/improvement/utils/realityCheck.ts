/**
 * Reality Check helper.
 *
 * Challenges a free-text "lesson" against whether it cites real evidence.
 * Deterministic — no AI. Looks for trade IDs, journal date refs, and
 * domain keywords. Used by the Improvement page to flag weak explanations
 * before they become Improvement Actions.
 */

const EVIDENCE_KEYWORDS = [
  'stop',
  'entry',
  'exit',
  'setup',
  'target',
  'mood',
  'emotion',
  'grade',
  'rule',
  'pnl',
  'p&l',
  'risk',
  'r-multiple',
  'r multiple',
  'partial',
  'pyramid',
  'breakeven',
] as const

const TRADE_ID_RE = /#\d+|trade\s*\d+/i
const DATE_RE = /\b\d{4}-\d{2}-\d{2}\b/

export interface RealityCheckResult {
  /** True if the lesson cites at least one form of evidence. */
  hasEvidence: boolean
  /** Matching evidence types found (for UI hints). */
  matched: Array<'trade_id' | 'date' | 'keyword'>
}

export function realityCheck(lesson: string | null | undefined): RealityCheckResult {
  if (!lesson || lesson.trim().length === 0) {
    return { hasEvidence: false, matched: [] }
  }
  const text = lesson.toLowerCase()
  const matched: RealityCheckResult['matched'] = []
  if (TRADE_ID_RE.test(lesson)) matched.push('trade_id')
  if (DATE_RE.test(lesson)) matched.push('date')
  if (EVIDENCE_KEYWORDS.some((k) => text.includes(k))) matched.push('keyword')
  return { hasEvidence: matched.length > 0, matched }
}
