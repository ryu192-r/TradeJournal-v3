import type { ApiTrade } from '@/types'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import { isDeletedTrade } from '../../trades/utils/tradesV3Metrics'

/**
 * A unified setup entry combining backend playbook records with trade-derived setups.
 *
 * `origin`:
 *  - 'playbook'       → backed by SetupPlaybook record (id present)
 *  - 'trade-derived'  → setup name appears on trades but not in backend playbook
 *  - 'untagged'       → trades with no setup name
 */
export type SetupOrigin = 'playbook' | 'trade-derived' | 'untagged'

export interface PlaybookSetupEntry {
  /** Stable key for selection: backend id as string, or `__untagged__`, or `derived:<name>`. */
  key: string
  /** Backend record id when `origin === 'playbook'`, else null. */
  id: number | null
  /** Display name. For untagged this is `'Untagged'`. */
  name: string
  origin: SetupOrigin
  /** Backend playbook record when `origin === 'playbook'`. */
  playbook: SetupPlaybookItem | null
  /** Non-deleted trades belonging to this setup. */
  trades: ApiTrade[]
}

export const UNTAGGED_KEY = '__untagged__'
export const UNTAGGED_LABEL = 'Untagged'

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/**
 * Combine backend SetupPlaybook records with trades grouped by setup name.
 * Returns one entry per setup (backend or trade-derived) plus an `Untagged` bucket
 * for trades that have no setup. Backend setups with zero trades are kept.
 */
export function combineSetups(
  playbooks: SetupPlaybookItem[],
  trades: ApiTrade[],
): PlaybookSetupEntry[] {
  const liveTrades = trades.filter((t) => !isDeletedTrade(t))

  // Group trades by trimmed setup name (case-sensitive, matching backend key).
  const tradesByName = new Map<string, ApiTrade[]>()
  const untagged: ApiTrade[] = []
  for (const trade of liveTrades) {
    const name = normalizeName(trade.setup)
    if (!name) {
      untagged.push(trade)
      continue
    }
    const arr = tradesByName.get(name) ?? []
    arr.push(trade)
    tradesByName.set(name, arr)
  }

  const entries: PlaybookSetupEntry[] = []
  const usedNames = new Set<string>()

  // 1) Backend playbook records first (preserve canonical playbook even with no trades)
  for (const playbook of playbooks) {
    const name = normalizeName(playbook.name)
    if (!name) continue
    usedNames.add(name)
    entries.push({
      key: String(playbook.id),
      id: playbook.id,
      name,
      origin: 'playbook',
      playbook,
      trades: tradesByName.get(name) ?? [],
    })
  }

  // 2) Trade-derived setups (in trades, but not in backend)
  for (const [name, group] of tradesByName) {
    if (usedNames.has(name)) continue
    entries.push({
      key: `derived:${name}`,
      id: null,
      name,
      origin: 'trade-derived',
      playbook: null,
      trades: group,
    })
  }

  // 3) Untagged bucket (only if any untagged trades exist)
  if (untagged.length > 0) {
    entries.push({
      key: UNTAGGED_KEY,
      id: null,
      name: UNTAGGED_LABEL,
      origin: 'untagged',
      playbook: null,
      trades: untagged,
    })
  }

  return entries
}
