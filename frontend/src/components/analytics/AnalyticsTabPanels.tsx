/** Analytics chart panels — consumed by Review & Analytics page tabs */
import { GlassBadge } from '@/components/ui/GlassBadge'
import { formatCurrency, formatRMultiple, parseDecimal, formatMetricPercent, formatPrice } from '@/utils/format'
import { Wallet, Flame, Target, BarChart3, Calendar, Clock, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts'
import type {
  DailyPnlEntry, MonthlyPnlEntry, AnalyticsRDist, SetupPerformanceItem,
  DayOfWeekEntry, TimeOfDayEntry, AnalyticsStreaks, HoldingPeriodEntry,
  FullDashboardPayload,
} from '@/types'
import { MetricCard, SectionHeader } from '@/components/ui/SharedUI'
import { CARD, PAGE_STACK } from '@/components/layout/layoutTokens'
import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Gauge, Radar } from 'lucide-react'

// ───────────────────────── helpers ─────────────────────────

function pnlNum(v: string | null): number {
  return parseDecimal(v, 0)
}

const CHART_MARGINS = { top: 10, right: 20, left: 0, bottom: 0 }

const COLORS = {
  profit: 'var(--profit)',
  loss: 'var(--loss)',
  accent: 'var(--accent)',
  text: 'var(--text)',
  grid: 'var(--border)',
}

const CARD_STATIC = `${CARD} animate-card-in`

function GlassTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card rounded-lg p-3 border border-border text-xs shadow-lg">
      <div className="text-text-muted mb-1 font-medium font-display">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: entry.color || COLORS.accent }}
          />
          <span className="text-text-heading font-data">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatCompactCurrency(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(value))}`
}

function formatSignedPrice(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatPrice(Math.abs(value))}`
}

function getMetricTone(value: number | null | undefined, positiveIsGood = true): 'neutral' | 'profit' | 'loss' {
  if (value == null || Number.isNaN(value) || value === 0) return 'neutral'
  const isPositive = value > 0
  const good = positiveIsGood ? isPositive : !isPositive
  return good ? 'profit' : 'loss'
}

export function OverviewMetrics({
  netPnl,
  winRate,
  profitFactor,
  avgR,
  expectancy,
  maxDrawdown,
}: {
  netPnl: number
  winRate: number | null
  profitFactor: number | null
  avgR: number | null
  expectancy: number | null
  maxDrawdown: number | null
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Net P&L"
        value={formatCompactCurrency(netPnl)}
        detail="Closed-trade result"
        icon={netPnl >= 0 ? ArrowUpRight : ArrowDownRight}
        tone={getMetricTone(netPnl)}
      />
      <MetricCard
        label="Win Rate"
        value={winRate != null ? formatMetricPercent(winRate) : '-'}
        detail="Winning trades / total trades"
        icon={Target}
        tone={getMetricTone((winRate ?? 0) - 50)}
      />
      <MetricCard
        label="Profit Factor"
        value={profitFactor != null ? profitFactor.toFixed(2) : '-'}
        detail="Gross profit / gross loss"
        icon={Gauge}
        tone={getMetricTone((profitFactor ?? 0) - 1)}
      />
      <MetricCard
        label="Average R"
        value={avgR != null ? formatRMultiple(avgR) : '-'}
        detail="Average reward-to-risk"
        icon={BarChart3}
        tone={getMetricTone(avgR)}
      />
      <MetricCard
        label="Expectancy"
        value={expectancy != null ? formatSignedPrice(expectancy) : '-'}
        detail="Average edge per trade"
        icon={Radar}
        tone={getMetricTone(expectancy)}
      />
      <MetricCard
        label="Max Drawdown"
        value={maxDrawdown != null ? formatCurrency(maxDrawdown) : '-'}
        detail="Worst peak-to-trough stretch"
        icon={AlertTriangle}
        tone={getMetricTone(maxDrawdown, false)}
      />
    </div>
  )
}


// ───────────────────────── Equity Curve ─────────────────────────

export function EquityCurveChart({ data }: { data: DailyPnlEntry[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      date: d.date.slice(0, 10),
      cumulative: pnlNum(d.cumulative_pnl),
      daily: pnlNum(d.net_pnl),
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-72 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No daily P\u0026L data available</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Equity Curve</h3>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={CHART_MARGINS}>
          <defs>
            <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.accent} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v)
              return `${d.getDate()}/${d.getMonth() + 1}`
            }}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<GlassTooltip />} />
          <ReferenceLine y={0} stroke={COLORS.grid} />
          <Area
            type="monotone"
            dataKey="cumulative"
            name="Cumulative P\u0026L"
            stroke={COLORS.accent}
            fill="url(#cumulativeGrad)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── Trading Calendar Heatmap ─────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type HeatmapCell = {
  date: string
  day: number
  value: number
  tradeCount: number
  isInMonth: boolean
}

function getHeatmapCellColor(value: number, maxAbs: number, hasTrade: boolean) {
  if (!hasTrade) {
    return 'var(--bg-low)'
  }
  if (value === 0) {
    return 'color-mix(in srgb, var(--text-faint) 18%, var(--bg-card))'
  }

  const intensity = Math.max(18, Math.min(78, Math.round((Math.abs(value) / maxAbs) * 100)))
  if (value > 0) {
    return `color-mix(in srgb, var(--profit) ${intensity}%, var(--bg-card))`
  }
  return `color-mix(in srgb, var(--loss) ${intensity}%, var(--bg-card))`
}

export function TradingHeatmap({ data }: { data: DailyPnlEntry[] }) {
  const safeData = data && data.length > 0 ? data : []
  const defaultDate = safeData.length > 0 ? safeData[safeData.length - 1]?.date ?? null : null
  const [activeDate, setActiveDate] = useState<string | null>(defaultDate)

  const {
    maxAbs,
    months,
    activeCell,
    totalNetPnl,
    profitableDays,
    losingDays,
    flatDays,
    tradedDays,
    averageTradingDay,
    monthRangeLabel,
    bestDay,
    worstDay,
  } = useMemo(() => {
    if (safeData.length === 0) {
      return {
        maxAbs: 1,
        months: [],
        activeCell: null,
        totalNetPnl: 0,
        profitableDays: 0,
        losingDays: 0,
        flatDays: 0,
        tradedDays: 0,
        averageTradingDay: 0,
        monthRangeLabel: '',
        bestDay: null as HeatmapCell | null,
        worstDay: null as HeatmapCell | null,
      }
    }
    const pnlByDate = new Map<string, { value: number; tradeCount: number }>()
    let nextMaxAbs = 1

    for (const entry of safeData) {
      const value = pnlNum(entry.net_pnl)
      pnlByDate.set(entry.date, { value, tradeCount: entry.trade_count })
      nextMaxAbs = Math.max(nextMaxAbs, Math.abs(value))
    }

    const orderedDates = safeData.map((entry) => entry.date).sort()
    const first = new Date(orderedDates[0])
    const last = new Date(orderedDates[orderedDates.length - 1])
    const cursor = new Date(first)
    cursor.setDate(1)

    const nextMonths: { label: string; weeks: { cells: HeatmapCell[] }[] }[] = []
    let nextTotalNetPnl = 0
    let nextProfitableDays = 0
    let nextLosingDays = 0
    let nextFlatDays = 0
    let nextTradedDays = 0
    let nextBestDay: HeatmapCell | null = null
    let nextWorstDay: HeatmapCell | null = null

    for (const entry of data) {
      const value = pnlNum(entry.net_pnl)
      nextTotalNetPnl += value
      nextTradedDays += 1
      if (value > 0) nextProfitableDays += 1
      else if (value < 0) nextLosingDays += 1
      else nextFlatDays += 1

      const cell = {
        date: entry.date,
        day: new Date(entry.date).getDay(),
        value,
        tradeCount: entry.trade_count,
        isInMonth: true,
      }
      if (!nextBestDay || value > nextBestDay.value) nextBestDay = cell
      if (!nextWorstDay || value < nextWorstDay.value) nextWorstDay = cell
    }

    while (cursor <= last) {
      const monthStart = new Date(cursor)
      const monthIndex = monthStart.getMonth()
      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: '2-digit' })
      const cells: HeatmapCell[] = []
      const wstart = new Date(monthStart)
      wstart.setDate(wstart.getDate() - wstart.getDay())
      const wend = new Date(monthStart)
      wend.setMonth(wend.getMonth() + 1)
      wend.setDate(0)
      wend.setDate(wend.getDate() + (6 - wend.getDay()))

      const walk = new Date(wstart)
      while (walk <= wend) {
        const dateStr = walk.toISOString().slice(0, 10)
        const quote = pnlByDate.get(dateStr)
        cells.push({
          date: dateStr,
          day: walk.getDay(),
          value: quote?.value ?? 0,
          tradeCount: quote?.tradeCount ?? 0,
          isInMonth: walk.getMonth() === monthIndex,
        })
        walk.setDate(walk.getDate() + 1)
      }

      const weeks: { cells: HeatmapCell[] }[] = []
      for (let i = 0; i < cells.length; i += 7) {
        weeks.push({ cells: cells.slice(i, i + 7) })
      }

      nextMonths.push({ label: monthLabel, weeks })
      cursor.setMonth(cursor.getMonth() + 1)
    }

    const average = nextTradedDays > 0 ? nextTotalNetPnl / nextTradedDays : 0
    const active = activeDate ? (() => {
      for (const month of nextMonths) {
        for (const week of month.weeks) {
          for (const cell of week.cells) {
            if (cell.date === activeDate) return cell
          }
        }
      }
      return null
    })() : null

    const rangeLabel = `${first.toLocaleString('default', { month: 'short', year: 'numeric' })} - ${last.toLocaleString('default', { month: 'short', year: 'numeric' })}`

    return {
      maxAbs: nextMaxAbs,
      months: nextMonths,
      activeCell: active,
      totalNetPnl: nextTotalNetPnl,
      profitableDays: nextProfitableDays,
      losingDays: nextLosingDays,
      flatDays: nextFlatDays,
      tradedDays: nextTradedDays,
      averageTradingDay: average,
      monthRangeLabel: rangeLabel,
      bestDay: nextBestDay,
      worstDay: nextWorstDay,
    }
  }, [activeDate, data])

  if (months.length === 0) return null

  const detailCell = activeCell ?? bestDay ?? worstDay
  const winRate = tradedDays > 0 ? (profitableDays / tradedDays) * 100 : 0

  return (
    <div className={`${CARD_STATIC} space-y-[var(--page-gap)]`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-[15px] h-[15px] text-accent" />
            <h3 className="font-display text-[length:var(--text-sm)] text-text-heading">Trading Heatmap</h3>
          </div>
          <div className="text-[11px] text-text-muted font-data">{monthRangeLabel}</div>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-2 text-[11px] font-data sm:grid-cols-4">
          <div>
            <div className="text-text-faint">Net</div>
            <div className={`${totalNetPnl >= 0 ? 'text-profit' : 'text-loss'} text-sm`}>{totalNetPnl >= 0 ? '+' : ''}{formatCurrency(totalNetPnl)}</div>
          </div>
          <div>
            <div className="text-text-faint">Trading Days</div>
            <div className="text-sm text-text-heading">{tradedDays}</div>
          </div>
          <div>
            <div className="text-text-faint">Green Days</div>
            <div className="text-sm text-profit">{profitableDays} <span className="text-text-muted">{winRate.toFixed(0)}%</span></div>
          </div>
          <div>
            <div className="text-text-faint">Avg Day</div>
            <div className={`${averageTradingDay >= 0 ? 'text-profit' : 'text-loss'} text-sm`}>{averageTradingDay >= 0 ? '+' : ''}{formatCurrency(averageTradingDay)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="overflow-x-auto scrollbar-thin">
          <div className="flex min-w-fit gap-6">
            <div className="sticky left-0 z-[1] flex flex-col gap-2 bg-card pr-2">
              {DAYS.map((day, index) => (
                <div
                  key={day}
                  className={`flex h-[18px] items-center text-[10px] font-data ${index === 0 || index === 6 ? 'text-text-faint' : 'text-text-muted'}`}
                >
                  {index % 2 === 1 ? day.slice(0, 3) : ''}
                </div>
              ))}
            </div>
          {months.map((m) => (
            <div key={m.label}>
              <div className="mb-2 text-center text-[10px] font-data text-text-muted">{m.label}</div>
              <div className="flex gap-1">
                {m.weeks.map((w, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {w.cells.map((c) => {
                      const hasTrade = c.tradeCount > 0
                      const isActive = detailCell?.date === c.date
                      return (
                        <button
                          key={c.date}
                          type="button"
                          onMouseEnter={() => setActiveDate(c.date)}
                          onFocus={() => setActiveDate(c.date)}
                          className={`h-[18px] w-[18px] rounded-[4px] border transition-transform ${c.isInMonth ? 'border-border/50' : 'border-transparent opacity-40'} ${isActive ? 'scale-[1.08]' : 'hover:scale-[1.04]'}`}
                          style={{
                            backgroundColor: getHeatmapCellColor(c.value, maxAbs, hasTrade),
                            boxShadow: isActive ? 'inset 0 0 0 1px var(--text-heading)' : undefined,
                          }}
                          aria-label={`${c.date} ${hasTrade ? `${c.value >= 0 ? 'profit' : 'loss'} ${formatCurrency(Math.abs(c.value))}` : 'no trades'}`}
                          title={`${c.date} • ${hasTrade ? `${c.tradeCount} trade${c.tradeCount === 1 ? '' : 's'} • ${c.value >= 0 ? '+' : ''}${formatCurrency(c.value)}` : 'No trades'}`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </div>

        <div className="space-y-4 border border-border/70 bg-bg-elevated/35 p-4">
          <div className="space-y-1">
            <div className="text-[10px] font-data uppercase text-text-faint">Selected Day</div>
            <div className="text-sm font-display text-text-heading">
              {detailCell ? new Date(detailCell.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No selection'}
            </div>
          </div>

          {detailCell ? (
            <div className="space-y-2 text-xs font-data">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Net P&L</span>
                <span className={detailCell.value >= 0 ? 'text-profit' : 'text-loss'}>
                  {detailCell.value >= 0 ? '+' : ''}{formatCurrency(detailCell.value)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Trades</span>
                <span className="text-text-heading">{detailCell.tradeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Day Type</span>
                <span className={detailCell.tradeCount === 0 ? 'text-text-faint' : detailCell.value > 0 ? 'text-profit' : detailCell.value < 0 ? 'text-loss' : 'text-text-muted'}>
                  {detailCell.tradeCount === 0 ? 'No Trade' : detailCell.value > 0 ? 'Green' : detailCell.value < 0 ? 'Red' : 'Flat'}
                </span>
              </div>
            </div>
          ) : null}

          <div className="space-y-2 border-t border-border pt-3 text-xs font-data">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Best Day</span>
              <span className="text-profit">{bestDay ? `${bestDay.value >= 0 ? '+' : ''}${formatCurrency(bestDay.value)}` : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Worst Day</span>
              <span className="text-loss">{worstDay ? `${worstDay.value >= 0 ? '+' : ''}${formatCurrency(worstDay.value)}` : '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Flat Days</span>
              <span className="text-text-heading">{flatDays}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Red Days</span>
              <span className="text-loss">{losingDays}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-data text-text-faint">
        <div className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[3px] border border-border/50 bg-bg-low" />
          No Trade
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[3px] border border-border/50" style={{ backgroundColor: 'color-mix(in srgb, var(--text-faint) 18%, var(--bg-card))' }} />
          Flat
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[3px] border border-border/50" style={{ backgroundColor: 'color-mix(in srgb, var(--loss) 58%, var(--bg-card))' }} />
          Loss
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[10px] w-[10px] rounded-[3px] border border-border/50" style={{ backgroundColor: 'color-mix(in srgb, var(--profit) 58%, var(--bg-card))' }} />
          Profit
        </div>
      </div>
    </div>
  )
}


// ───────────────────────── Monthly P\u0026L Bars ─────────────────────────

export function MonthlyPnlChart({ data, framed = true }: { data: MonthlyPnlEntry[]; framed?: boolean }) {
  const chartData = data.map((d) => ({
    month: d.month,
    netPnl: pnlNum(d.net_pnl),
    winRate: d.win_rate ?? 0,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${framed ? CARD_STATIC : 'h-64'} flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No monthly data</div>
      </div>
    )
  }

  return (
    <div className={`${framed ? CARD_STATIC : ''} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Monthly P\u0026L</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={CHART_MARGINS}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: string) => {
              const [y, m] = v.split('-')
              return `${m}/${y.slice(2)}`
            }}
          />
          <YAxis
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<GlassTooltip />} />
          <Bar dataKey="netPnl" name="Net P\u0026L" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.netPnl >= 0 ? COLORS.profit : COLORS.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── R-Distribution Histogram ─────────────────────────

export function RDistributionChart({ data }: { data: AnalyticsRDist }) {
  const chartData = data.bins.map((b) => ({
    range: `${b.range_start.toFixed(1)} to ${b.range_end.toFixed(1)}`,
    count: b.count,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No R-multiple data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-medium text-text-heading font-display">R-Multiple Distribution</h3>
        </div>
        <div className="text-[length:var(--text-xs)] text-text-muted font-data">
          μ={data.mean_r?.toFixed(2) ?? '-'}  σ={data.std_r?.toFixed(2) ?? '-'}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={CHART_MARGINS}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="range" tick={{ fill: COLORS.text, fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
          <YAxis tick={{ fill: COLORS.text, fontSize: 11 }} allowDecimals={false} />
          <Tooltip content={<GlassTooltip />} />
          <Bar dataKey="count" name="Trades" radius={[4, 4, 0, 0]} fill={COLORS.accent} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── Setup Performance Matrix ─────────────────────────

export function SetupPerformanceChart({ data }: { data: SetupPerformanceItem[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      setup: d.setup,
      totalPnl: pnlNum(d.total_pnl),
      tradeCount: d.trade_count,
      winRate: d.win_rate ?? 0,
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No setup data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Setup Performance</h3>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} layout="vertical">
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: COLORS.text, fontSize: 11 }} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="setup" tick={{ fill: COLORS.text, fontSize: 11 }} width={100} />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: COLORS.text }} />
          <Bar dataKey="totalPnl" name="Total P\u0026L" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.totalPnl >= 0 ? COLORS.profit : COLORS.loss} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detail table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border">
              <th className="text-left py-2 px-2 font-display">Setup</th>
              <th className="text-right py-2 px-2 font-data">Trades</th>
              <th className="text-right py-2 px-2 font-data">Win Rate</th>
              <th className="text-right py-2 px-2 font-data">Avg R</th>
              <th className="text-right py-2 px-2 font-data">PF</th>
              <th className="text-right py-2 px-2 font-data">Expectancy</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.setup} className="border-b border-border/50 hover:bg-bg-elevated/30 transition-colors">
                <td className="py-2 px-2 text-text-heading font-medium font-display">{s.setup}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.trade_count}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.win_rate != null ? formatMetricPercent(s.win_rate) : '-'}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.avg_r_multiple != null ? formatRMultiple(s.avg_r_multiple) : '-'}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.profit_factor?.toFixed(2) ?? '-'}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.expectancy != null ? formatSignedPrice(s.expectancy) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────────── Day-of-Week Heatmap ─────────────────────────

export function DayOfWeekChart({ data }: { data: DayOfWeekEntry[] }) {
  const chartData = useMemo(() => {
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const ordered = dayOrder.map((day) => {
      const found = data.find((d) => d.day.slice(0, 3) === day)
      return found ?? { day, day_index: 0, trade_count: 0, net_pnl: '0', win_rate: 0, avg_r: 0 }
    })
    return ordered.map((d) => ({
      day: d.day.slice(0, 3),
      pnl: pnlNum(d.net_pnl),
      winRate: d.win_rate ?? 0,
      trades: d.trade_count,
    }))
  }, [data])

  if (chartData.every((d) => d.trades === 0)) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No weekday data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Day of Week</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={CHART_MARGINS}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="day" tick={{ fill: COLORS.text, fontSize: 11 }} />
          <YAxis
            yAxisId="pnl"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="pnl" dataKey="pnl" name="P\u0026L" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.pnl >= 0 ? COLORS.profit : COLORS.loss} />
            ))}
          </Bar>
          <Line yAxisId="rate" type="monotone" dataKey="winRate" name="Win Rate" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── Time-of-Day Heatmap ─────────────────────────

export function TimeOfDayChart({ data }: { data: TimeOfDayEntry[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      hour: d.label,
      pnl: pnlNum(d.net_pnl),
      winRate: d.win_rate ?? 0,
      trades: d.trade_count,
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No time-of-day data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Time of Day</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={CHART_MARGINS}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="hour" tick={{ fill: COLORS.text, fontSize: 10 }} minTickGap={10} />
          <YAxis
            yAxisId="pnl"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="rate"
            orientation="right"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          />
          <Tooltip content={<GlassTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="pnl" dataKey="pnl" name="P\u0026L" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.pnl >= 0 ? COLORS.profit : COLORS.loss} />
            ))}
          </Bar>
          <Line yAxisId="rate" type="monotone" dataKey="winRate" name="Win Rate" stroke={COLORS.accent} strokeWidth={2} dot={{ r: 3 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── Drawdown Timeline ─────────────────────────

export function DrawdownChart({ data }: { data: DailyPnlEntry[] }) {
  const chartData = useMemo(() => {
    let peak = 0
    return data.map((d) => {
      const cum = pnlNum(d.cumulative_pnl)
      if (cum > peak) peak = cum
      const drawdown = cum - peak
      return {
        date: d.date.slice(0, 10),
        drawdown,
        cumulative: cum,
      }
    })
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-48 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No drawdown data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-loss" />
        <h3 className="text-sm font-medium text-text-heading font-display">Drawdown Timeline</h3>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={CHART_MARGINS}>
          <defs>
            <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.loss} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS.loss} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v)
              return `${d.getDate()}/${d.getMonth() + 1}`
            }}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: COLORS.text, fontSize: 11 }}
            tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<GlassTooltip />} />
          <ReferenceLine y={0} stroke={COLORS.grid} />
          <Area
            type="monotone"
            dataKey="drawdown"
            name="Drawdown"
            stroke={COLORS.loss}
            fill="url(#ddGrad)"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── Streaks Mini Card ─────────────────────────

export function StreakMiniCard({ data }: { data: AnalyticsStreaks }) {
  const currentType = data.current_streak.type ?? 'none'
  const currentCount = data.current_streak.count
  const isWin = currentType === 'win'

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Streaks</h3>
      </div>
      <div className="space-y-[var(--cell-py)]">
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--text-xs)] text-text-muted kpi-label">Current</span>
          <GlassBadge variant={isWin ? 'profit' : currentType === 'loss' ? 'loss' : 'muted'}>
            {currentCount} {currentType}
          </GlassBadge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--text-xs)] text-text-muted kpi-label">Longest Win</span>
          <span className="text-sm font-medium text-profit font-data">{data.longest_win_streak}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[length:var(--text-xs)] text-text-muted kpi-label">Longest Loss</span>
          <span className="text-sm font-medium text-loss font-data">{data.longest_loss_streak}</span>
        </div>
        <div className="text-[length:var(--text-xs)] text-text-muted pt-3 border-t border-border font-data">
          {data.streaks.length} streaks total
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Holding Period Scatter ─────────────────────────

export function HoldingPeriodChart({ data }: { data: HoldingPeriodEntry[] }) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      hours: d.holding_hours,
      rMultiple: d.r_multiple ?? 0,
      pnl: pnlNum(d.pnl),
      symbol: d.symbol,
    }))
  }, [data])

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-48 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No holding period data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-[var(--cell-py)]`}>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Holding Period vs R-Multiple</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ScatterChart margin={CHART_MARGINS}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="hours"
            name="Hours"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            label={{ value: 'Hours Held', position: 'insideBottom', offset: -5, fill: COLORS.text, fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="rMultiple"
            name="R"
            tick={{ fill: COLORS.text, fontSize: 11 }}
            label={{ value: 'R-Multiple', angle: -90, position: 'insideLeft', fill: COLORS.text, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as { hours: number; rMultiple: number; symbol: string }
              return (
                <div className="bg-card rounded-lg p-3 border border-border text-xs shadow-lg">
                  <div className="text-text-heading font-medium font-display">{p.symbol}</div>
                  <div className="text-text-muted font-data">{p.hours.toFixed(1)}h · {p.rMultiple.toFixed(2)}R</div>
                </div>
              )
            }}
          />
          <Scatter data={chartData} fill={COLORS.accent}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.rMultiple >= 0 ? COLORS.profit : COLORS.loss} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

// ───────────────────────── Tab panels (Review & Analytics page) ─────────────────────────

export function AnalyticsOverviewPanel({ data }: { data: FullDashboardPayload }) {
  const netPnl = data.kpi.net_pnl != null ? pnlNum(data.kpi.net_pnl) : 0
  const winRate = data.kpi.win_rate
  const monthlyNetPnl = data.monthly_pnl.map((entry) => pnlNum(entry.net_pnl))
  const bestMonth = monthlyNetPnl.length ? Math.max(...monthlyNetPnl) : null
  const worstMonth = monthlyNetPnl.length ? Math.min(...monthlyNetPnl) : null
  const currentStreak = data.streaks.current_streak
  const streakLabel = currentStreak.type ? `${currentStreak.count} ${currentStreak.type}` : 'No active streak'
  const avgTradesPerDay =
    data.daily_pnl.length > 0
      ? data.daily_pnl.reduce((sum, entry) => sum + entry.trade_count, 0) / data.daily_pnl.length
      : 0

  return (
    <div className={PAGE_STACK}>
      <OverviewMetrics
        netPnl={netPnl}
        winRate={winRate}
        profitFactor={data.kpi.profit_factor}
        avgR={data.kpi.avg_r_multiple}
        expectancy={data.kpi.expectancy}
        maxDrawdown={data.kpi.max_drawdown_amount}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StreakMiniCard data={data.streaks} />
        <div className={`${CARD_STATIC} space-y-4`}>
          <SectionHeader title="Monthly pulse" subtitle="Volatility across months." />
          <div className="grid grid-cols-2 gap-4 text-xs font-data">
            <div>
              <div className="text-text-faint">Best month</div>
              <div className="mt-1 text-sm text-profit">{bestMonth != null ? formatCompactCurrency(bestMonth) : '—'}</div>
            </div>
            <div>
              <div className="text-text-faint">Worst month</div>
              <div className="mt-1 text-sm text-loss">{worstMonth != null ? formatCompactCurrency(worstMonth) : '—'}</div>
            </div>
            <div>
              <div className="text-text-faint">Current streak</div>
              <div className="mt-1 text-sm text-text-heading">{streakLabel}</div>
            </div>
            <div>
              <div className="text-text-faint">Avg trades / day</div>
              <div className="mt-1 text-sm text-text-heading">{avgTradesPerDay.toFixed(1)}</div>
            </div>
          </div>
          <MonthlyPnlChart data={data.monthly_pnl} framed={false} />
        </div>
      </div>
    </div>
  )
}

export function AnalyticsSetupsPanel({ data }: { data: FullDashboardPayload }) {
  return (
    <div className={PAGE_STACK}>
      <SetupPerformanceChart data={data.setup_performance} />
    </div>
  )
}

export function AnalyticsTimePanel({ data }: { data: FullDashboardPayload }) {
  return (
    <div className={PAGE_STACK}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DayOfWeekChart data={data.day_of_week} />
        <TimeOfDayChart data={data.time_of_day} />
      </div>
      <HoldingPeriodChart data={data.holding_period} />
    </div>
  )
}

export function AnalyticsRiskPanel({ data }: { data: FullDashboardPayload }) {
  return (
    <div className={PAGE_STACK}>
      <TradingHeatmap data={data.daily_pnl} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RDistributionChart data={data.r_distribution} />
        <DrawdownChart data={data.daily_pnl} />
      </div>
    </div>
  )
}

export function AnalyticsEquityPanel({ data }: { data: FullDashboardPayload }) {
  return (
    <div className={PAGE_STACK}>
      <EquityCurveChart data={data.daily_pnl} />
      <MonthlyPnlChart data={data.monthly_pnl} />
    </div>
  )
}
