import { Chip, DataList, DataRow, EmptyState, Panel, Stack, Value } from '@/new-ui'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'

interface SetupTacticsPanelProps {
  playbook: SetupPlaybookItem
}

function isEmptyRiskProfile(rp: SetupPlaybookItem['risk_profile']): boolean {
  if (!rp) return true
  return (
    (rp.max_risk_pct == null) &&
    !rp.position_sizing_rule?.trim() &&
    !rp.stop_style?.trim()
  )
}

export function SetupTacticsPanel({ playbook }: SetupTacticsPanelProps) {
  const hasTactics = (playbook.tactics?.length ?? 0) > 0
  const hasConditions = (playbook.ideal_conditions?.length ?? 0) > 0
  const hasRisk = !isEmptyRiskProfile(playbook.risk_profile)

  if (!hasTactics && !hasConditions && !hasRisk && !playbook.description?.trim()) {
    return (
      <Panel title="Tactics & conditions">
        <EmptyState
          title="Not set"
          description="No tactics, ideal conditions, or risk profile recorded for this setup yet."
        />
      </Panel>
    )
  }

  return (
    <Panel title="Tactics & conditions" description="Read-only definition from playbook record.">
      <Stack gap="md">
        {playbook.description?.trim() && (
          <p style={{ color: 'var(--color-text)', fontSize: '0.8125rem', margin: 0, lineHeight: 1.5 }}>
            {playbook.description.trim()}
          </p>
        )}

        {hasTactics && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Tactics
            </div>
            <Stack gap="sm">
              {playbook.tactics.map((tactic, idx) => (
                <div
                  key={`${tactic.name}-${idx}`}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: '0.5rem',
                    padding: '0.625rem 0.75rem',
                    background: 'var(--color-bg-muted)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{tactic.name}</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                      {tactic.win_rate ? `Win ${tactic.win_rate}` : ''}
                      {tactic.win_rate && tactic.avg_r ? ' · ' : ''}
                      {tactic.avg_r ? `Avg R ${tactic.avg_r}` : ''}
                    </span>
                  </div>
                  {tactic.conditions?.length > 0 && (
                    <div style={{ marginTop: '0.375rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {tactic.conditions.map((cond, i) => (
                        <Chip key={i} variant="info">
                          {cond}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Stack>
          </div>
        )}

        {hasConditions && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Ideal conditions
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--color-text)', fontSize: '0.8125rem', lineHeight: 1.6 }}>
              {playbook.ideal_conditions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {hasRisk && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Risk profile
            </div>
            <DataList>
              <DataRow
                title="Max risk"
                trailing={
                  <Value
                    value={
                      playbook.risk_profile?.max_risk_pct != null
                        ? `${playbook.risk_profile.max_risk_pct}%`
                        : 'Not set'
                    }
                  />
                }
              />
              <DataRow
                title="Position sizing"
                trailing={<Value value={playbook.risk_profile?.position_sizing_rule || 'Not set'} />}
              />
              <DataRow
                title="Stop style"
                trailing={<Value value={playbook.risk_profile?.stop_style || 'Not set'} />}
              />
            </DataList>
          </div>
        )}
      </Stack>
    </Panel>
  )
}
