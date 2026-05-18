// Analytics Dashboard Page — 8 live widgets wired to /analytics/dashboard
import { useDashboardQuery } from '@/hooks/useDashboardQuery'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { formatCurrency, formatPercent, formatRMultiple, parseDecimal, formatDate } from '@/utils/format'
import { Wallet, Flame, Target, BarChart3, Calendar, Clock, AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts'
import type {
  DailyPnlEntry, MonthlyPnlEntry, AnalyticsRDist, SetupPerformanceItem,
  DayOfWeekEntry, TimeOfDayEntry, AnalyticsStreaks, HoldingPeriodEntry,
} from '@/types'
import { LifecycleInsights } from '@/components/lifecycle/LifecycleInsights'
import { BehavioralIntelligence } from '@/components/lifecycle/BehavioralIntelligence'
import { PlaybookIntelligence } from '@/components/lifecycle/PlaybookIntelligence'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

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

const CARD_CLASS = 'bg-card rounded-2xl border border-border p-5'
const CARD_STATIC = `${CARD_CLASS} animate-card-in`

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


// ───────────────────────── Equity Curve ─────────────────────────

// @ts-ignore - kept for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EquityCurveChart({ data }: { data: DailyPnlEntry[] }) {
  const chartData = data.map((d) => ({
    date: d.date.slice(0, 10),
    cumulative: pnlNum(d.cumulative_pnl),
    daily: pnlNum(d.net_pnl),
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-72 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No daily P\u0026L data available</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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

function TradingHeatmap({ data }: { data: DailyPnlEntry[] }) {
  if (!data || data.length === 0) return null

  const pnlByDate = new Map<string, number>()
  let maxAbs = 1
  for (const d of data) {
    const v = pnlNum(d.net_pnl)
    pnlByDate.set(d.date, v)
    maxAbs = Math.max(maxAbs, Math.abs(v))
  }

  const months: { label: string; weeks: { cells: { date: string; day: number; value: number }[] }[] }[] = []
  const allDates = data.map((d) => d.date).sort()
  if (allDates.length === 0) return null

  const first = new Date(allDates[0])
  const last = new Date(allDates[allDates.length - 1])
  const cursor = new Date(first)
  cursor.setDate(1)

  while (cursor <= last) {
    const monthStart = new Date(cursor)
    const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: '2-digit' })
    const cells: { date: string; day: number; value: number }[] = []
    const wstart = new Date(monthStart)
    wstart.setDate(wstart.getDate() - wstart.getDay())
    const wend = new Date(monthStart)
    wend.setMonth(wend.getMonth() + 1)
    wend.setDate(0)
    wend.setDate(wend.getDate() + (6 - wend.getDay()))

    const walk = new Date(wstart)
    while (walk <= wend) {
      const dateStr = walk.toISOString().slice(0, 10)
      const value = pnlByDate.get(dateStr) ?? 0
      cells.push({ date: dateStr, day: walk.getDay(), value })
      walk.setDate(walk.getDate() + 1)
    }

    const weeks: { cells: typeof cells }[] = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push({ cells: cells.slice(i, i + 7) })
    }

    months.push({ label: monthLabel, weeks })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return (
    <div className={`${CARD_STATIC}`}>
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-[15px] h-[15px] text-accent" />
        <h3 className="font-display text-sm text-text-heading">Trading Heatmap</h3>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="flex gap-6 min-w-fit">
          {months.map((m) => (
            <div key={m.label}>
              <div className="text-[.625rem] text-text-muted font-data mb-1.5 text-center">{m.label}</div>
              <div className="flex gap-0.5">
                <div className="flex flex-col gap-0.5 mr-0.5">
                  {DAYS.map((d) => (
                    <div key={d} className="w-[14px] h-[14px] text-[.5rem] text-text-faint flex items-center justify-center">
                      {d[0]}
                    </div>
                  ))}
                </div>
                {m.weeks.map((w, wi) => (
                  <div key={wi} className="flex flex-col gap-0.5">
                    {w.cells.map((c) => {
                      const intensity = Math.abs(c.value) / maxAbs
                      const isProfit = c.value >= 0
                      const hasTrade = pnlByDate.has(c.date)
                      let bg = 'bg-bg-low'
                      if (hasTrade && c.value !== 0) {
                        const alpha = Math.min(0.15 + intensity * 0.6, 0.75).toFixed(2)
                        bg = isProfit
                          ? `bg-[color:rgba(74,222,128,${alpha})]`
                          : `bg-[color:rgba(248,113,113,${alpha})]`
                      }
                      return (
                        <div
                          key={c.date}
                          className={`w-[14px] h-[14px] rounded-[2px] ${bg}`}
                          title={`${c.date}: ${c.value >= 0 ? '+' : ''}${formatCurrency(c.value)}`}
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
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[.5625rem] text-text-faint">Less</span>
        <div className="w-[10px] h-[10px] rounded-[2px] bg-[color:rgba(248,113,113,0.15)]" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-[color:rgba(248,113,113,0.4)]" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-[color:rgba(248,113,113,0.7)]" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-bg-low" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-[color:rgba(74,222,128,0.15)]" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-[color:rgba(74,222,128,0.4)]" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-[color:rgba(74,222,128,0.7)]" />
        <span className="text-[.5625rem] text-text-faint">More</span>
      </div>
    </div>
  )
}


// ───────────────────────── Monthly P\u0026L Bars ─────────────────────────

// @ts-ignore - kept for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MonthlyPnlChart({ data }: { data: MonthlyPnlEntry[] }) {
  const chartData = data.map((d) => ({
    month: d.month,
    netPnl: pnlNum(d.net_pnl),
    winRate: d.win_rate ?? 0,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No monthly data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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

function RDistributionChart({ data }: { data: AnalyticsRDist }) {
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
    <div className={`${CARD_STATIC} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-medium text-text-heading font-display">R-Multiple Distribution</h3>
        </div>
        <div className="text-xs text-text-muted font-data">
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

function SetupPerformanceChart({ data }: { data: SetupPerformanceItem[] }) {
  const chartData = data.map((d) => ({
    setup: d.setup,
    totalPnl: pnlNum(d.total_pnl),
    tradeCount: d.trade_count,
    winRate: d.win_rate ?? 0,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No setup data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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
                <td className="py-2 px-2 text-right text-text font-data">{s.win_rate != null ? formatPercent(s.win_rate) : '-'}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.avg_r_multiple != null ? formatRMultiple(s.avg_r_multiple) : '-'}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.profit_factor?.toFixed(2) ?? '-'}</td>
                <td className="py-2 px-2 text-right text-text font-data">{s.expectancy?.toFixed(2) ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────────────────────── Day-of-Week Heatmap ─────────────────────────

function DayOfWeekChart({ data }: { data: DayOfWeekEntry[] }) {
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const ordered = dayOrder.map((day) => {
    const found = data.find((d) => d.day.slice(0, 3) === day)
    return found ?? { day, day_index: 0, trade_count: 0, net_pnl: '0', win_rate: 0, avg_r: 0 }
  })

  const chartData = ordered.map((d) => ({
    day: d.day.slice(0, 3),
    pnl: pnlNum(d.net_pnl),
    winRate: d.win_rate ?? 0,
    trades: d.trade_count,
  }))

  if (chartData.every((d) => d.trades === 0)) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No weekday data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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

function TimeOfDayChart({ data }: { data: TimeOfDayEntry[] }) {
  const chartData = data.map((d) => ({
    hour: d.label,
    pnl: pnlNum(d.net_pnl),
    winRate: d.win_rate ?? 0,
    trades: d.trade_count,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-64 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No time-of-day data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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

function DrawdownChart({ data }: { data: DailyPnlEntry[] }) {
  let peak = 0
  const chartData = data.map((d) => {
    const cum = pnlNum(d.cumulative_pnl)
    if (cum > peak) peak = cum
    const drawdown = cum - peak
    return {
      date: d.date.slice(0, 10),
      drawdown,
      cumulative: cum,
    }
  })

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-48 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No drawdown data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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

// @ts-ignore - kept for reference
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StreakMiniCard({ data }: { data: AnalyticsStreaks }) {
  const currentType = data.current_streak.type ?? 'none'
  const currentCount = data.current_streak.count
  const isWin = currentType === 'win'

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Streaks</h3>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted kpi-label">Current</span>
          <GlassBadge variant={isWin ? 'profit' : currentType === 'loss' ? 'loss' : 'muted'}>
            {currentCount} {currentType}
          </GlassBadge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted kpi-label">Longest Win</span>
          <span className="text-sm font-medium text-profit font-data">{data.longest_win_streak}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted kpi-label">Longest Loss</span>
          <span className="text-sm font-medium text-loss font-data">{data.longest_loss_streak}</span>
        </div>
        <div className="text-xs text-text-muted pt-3 border-t border-border font-data">
          {data.streaks.length} streaks total
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Holding Period Scatter ─────────────────────────

function HoldingPeriodChart({ data }: { data: HoldingPeriodEntry[] }) {
  const chartData = data.map((d) => ({
    hours: d.holding_hours,
    rMultiple: d.r_multiple ?? 0,
    pnl: pnlNum(d.pnl),
    symbol: d.symbol,
  }))

  if (chartData.length === 0) {
    return (
      <div className={`${CARD_STATIC} h-48 flex items-center justify-center`}>
        <div className="text-text-muted text-sm">No holding period data</div>
      </div>
    )
  }

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
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

// ───────────────────────── Main Page ─────────────────────────

export function AnalyticsDashboardPage() {
  const { data, isLoading, error } = useDashboardQuery()
  const queryClient = useQueryClient()

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }, [queryClient])

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Dashboard</h1>
          <div className="text-xs sm:text-sm text-text-muted font-data">{formatDate(new Date())}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${CARD_STATIC} h-28 animate-pulse`} />
          ))}
        </div>
        <div className={`${CARD_STATIC} h-72 animate-pulse`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className={`${CARD_STATIC} py-12 text-center`}>
          <AlertTriangle className="w-8 h-8 text-loss mx-auto mb-3" />
          <h2 className="text-lg font-medium text-text-heading font-display mb-2">Failed to load dashboard</h2>
          <p className="text-text-muted text-sm font-data">
            {(error as Error)?.message || 'Something went wrong fetching analytics data.'}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className={`${CARD_STATIC} py-12 text-center`}>
          <p className="text-text-muted font-data">No analytics data available.</p>
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Analytics</h1>
        <div className="text-sm text-text-muted font-data">{formatDate(new Date())}</div>
      </div>

      <TradingHeatmap data={data.daily_pnl} />

      <SetupPerformanceChart data={data.setup_performance} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RDistributionChart data={data.r_distribution} />
        <DrawdownChart data={data.daily_pnl} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DayOfWeekChart data={data.day_of_week} />
        <TimeOfDayChart data={data.time_of_day} />
      </div>

      <HoldingPeriodChart data={data.holding_period} />

      <LifecycleInsights />
      <BehavioralIntelligence />
      <PlaybookIntelligence />
    </div>
    </PullToRefresh>
  )
}
