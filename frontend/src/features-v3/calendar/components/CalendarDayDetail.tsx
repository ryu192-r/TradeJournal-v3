import { Badge, Chip, Drawer, EmptyState, Grid, MetricCard, MoneyValue, Panel, Stack, Value, Button } from '@/new-ui'
import type { CalendarDay } from '@/types'

const WARNING_LABELS: Record<string, string> = {
  overtrading: 'Overtrading',
  'emotional-trading': 'Emotional trading',
  'rule-violation': 'Rule violation',
}

function timeOnly(iso: string | null): string {
  if (!iso) return '—'
  const m = iso.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : '—'
}

interface CalendarDayDetailProps {
  day: CalendarDay | null
  onClose: () => void
  onOpenJournal?: (date: string) => void
}

export function CalendarDayDetail({ day, onClose, onOpenJournal }: CalendarDayDetailProps) {
  const open = day != null
  const hasActivity =
    !!day && (day.trade_count > 0 || day.journal != null || day.emotions.length > 0 || day.warnings.length > 0)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={day ? day.date : 'Day detail'}
      description={day ? `${day.trade_count} trade${day.trade_count === 1 ? '' : 's'} · ${day.closed_count} closed` : undefined}
      footer={
        day && onOpenJournal ? (
          <Button variant="primary" size="sm" onClick={() => onOpenJournal(day.date)}>
            Open journal
          </Button>
        ) : undefined
      }
    >
      {!day || !hasActivity ? (
        <EmptyState title="No activity" description="No trades, journal, or events recorded for this day." />
      ) : (
        <Stack gap="lg">
          <Grid minColumnWidth="8rem">
            <MetricCard label="Net P&L" value={<MoneyValue value={day.net_pnl} tone="auto" />} />
            <MetricCard label="Win rate" value={<Value value={day.win_rate != null ? `${day.win_rate}%` : '—'} />} />
            <MetricCard
              label="Discipline"
              value={<Value value={day.discipline_rating != null ? `${day.discipline_rating}/5` : '—'} />}
            />
          </Grid>

          {day.warnings.length > 0 && (
            <Panel title="Warnings">
              <div className="tjv3-cal__chip-row">
                {day.warnings.map((w) => (
                  <Badge key={w} variant="warning">
                    {WARNING_LABELS[w] ?? w}
                  </Badge>
                ))}
              </div>
            </Panel>
          )}

          {day.trades.length > 0 && (
            <Panel title="Trades">
              <Stack gap="sm">
                {day.trades.map((t) => (
                  <div key={t.id} className="tjv3-cal__trade-row">
                    <div className="tjv3-cal__trade-main">
                      <span className="tjv3-cal__trade-symbol">{t.symbol}</span>
                      <span className="tjv3-cal__trade-setup">{t.setup ?? 'Unassigned'}</span>
                    </div>
                    <div className="tjv3-cal__trade-meta">
                      <span className="tjv3-cal__trade-time">
                        {timeOnly(t.entry_time)} → {timeOnly(t.exit_time)}
                      </span>
                      <MoneyValue value={t.pnl} tone="auto" fallback="open" />
                    </div>
                  </div>
                ))}
              </Stack>
            </Panel>
          )}

          {day.journal && (
            <Panel title="Journal">
              <Stack gap="sm">
                {day.journal.pre_trade_notes && (
                  <JournalField label="Pre-trade" value={day.journal.pre_trade_notes} />
                )}
                {day.journal.post_trade_notes && (
                  <JournalField label="Post-trade" value={day.journal.post_trade_notes} />
                )}
                {day.journal.rules_followed && (
                  <JournalField label="Rules followed" value={day.journal.rules_followed} />
                )}
                {day.journal.rules_violated && (
                  <JournalField label="Rules violated" value={day.journal.rules_violated} />
                )}
                {day.journal.lessons_learned && (
                  <JournalField label="Lessons" value={day.journal.lessons_learned} />
                )}
              </Stack>
            </Panel>
          )}

          {day.emotions.length > 0 && (
            <Panel title="Emotions">
              <div className="tjv3-cal__chip-row">
                {day.emotions.map((e) => (
                  <Chip key={e.id} variant="info">
                    {e.emotion}
                  </Chip>
                ))}
              </div>
            </Panel>
          )}
        </Stack>
      )}
    </Drawer>
  )
}

function JournalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="tjv3-cal__journal-field">
      <div className="tjv3-cal__journal-label">{label}</div>
      <div className="tjv3-cal__journal-text">{value}</div>
    </div>
  )
}
