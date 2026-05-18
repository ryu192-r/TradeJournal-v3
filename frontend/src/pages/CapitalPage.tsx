import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getCapitalDashboard,
  getTierConfig,
  saveTierConfig,
  updateAccount,
  createCapitalEvent,
  deleteCapitalEvent,
  reconcileAccount,
} from '@/lib/endpoints'
import type { CapitalDashboardPayload, CapitalEventType } from '@/types'
import { useToastStore } from '@/store/toastStore'
import { formatCurrency, parseDecimal } from '@/utils/format'
import { TrendingUp, Wallet, Activity, Target, Calendar, ArrowUpRight, AlertTriangle, Settings, Plus, Trash2, Save, Edit3, X, Loader2, RefreshCw } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { GlassBadge } from '@/components/ui/GlassBadge'

const CARD_CLASS = 'bg-card rounded-2xl border border-border p-5'
const CARD_STATIC = `${CARD_CLASS} animate-card-in`
const COLORS = {
  profit: 'var(--profit)',
  loss: 'var(--loss)',
  accent: 'var(--accent)',
  text: 'var(--text)',
  grid: 'var(--border)',
}

function pnlNum(v: string | null): number {
  return parseDecimal(v, 0)
}

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
            {entry.name}: {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function NetEquityCard({ data, onEdit }: { data: CapitalDashboardPayload; onEdit: () => void }) {
  const netEquity = pnlNum(data.net_equity)
  const initialBalance = pnlNum(data.initial_balance)
  const isProfit = netEquity >= initialBalance
  const currentTier = data.tiers.find(t => t.current)

  return (
    <div className={`${CARD_STATIC} relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted mb-1 font-display">Net Equity</div>
          <div className={`text-4xl sm:text-5xl font-bold font-data ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(data.net_equity)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-muted font-data">
              Starting capital: {formatCurrency(data.initial_balance)}
            </span>
            <button
              onClick={onEdit}
              className="inline-flex items-center justify-center w-5 h-5 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer"
              title="Edit starting capital"
            >
              <Edit3 className="w-3 h-3 text-text-muted" />
            </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="w-12 h-12 rounded-xl bg-accent-muted flex items-center justify-center">
            <Wallet className="w-6 h-6 text-accent" />
          </div>
          {currentTier && (
            <GlassBadge variant="accent">{currentTier.name}</GlassBadge>
          )}
        </div>
      </div>
    </div>
  )
}

function PnlStatsCard({ data }: { data: CapitalDashboardPayload }) {
  const realized = pnlNum(data.total_realized_pnl)

  const rows = [
    { label: 'Total Realized P&L', value: formatCurrency(data.total_realized_pnl), color: realized >= 0 ? 'text-profit' : 'text-loss' },
    { label: 'Best Trade', value: formatCurrency(data.best_trade), color: 'text-profit' },
    { label: 'Worst Trade', value: formatCurrency(data.worst_trade), color: 'text-loss' },
    { label: 'Average Win', value: formatCurrency(data.average_win), color: 'text-profit' },
    { label: 'Average Loss', value: formatCurrency(data.average_loss), color: 'text-loss' },
    { label: 'Profit Factor', value: data.profit_factor?.toFixed(2) ?? '-', color: 'text-text-heading' },
  ]

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">P&L Stats</h3>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs text-text-muted">{r.label}</span>
            <span className={`text-sm font-data font-medium ${r.color}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AccountActivityCard({ data }: { data: CapitalDashboardPayload }) {
  const rows = [
    { label: 'Total Deposits', value: formatCurrency(data.total_deposits), color: 'text-profit' },
    { label: 'Total Withdrawals', value: formatCurrency(data.total_withdrawals), color: 'text-loss' },
    { label: 'Deployed Capital', value: formatCurrency(data.deployed_capital), color: 'text-text-heading' },
    { label: 'Available Capital', value: formatCurrency(data.available_capital), color: 'text-text-heading' },
    { label: 'Total Trades', value: String(data.total_trades), color: 'text-text-heading' },
    { label: 'Win Rate', value: data.win_rate != null ? `${data.win_rate.toFixed(1)}%` : '-', color: 'text-text-heading' },
  ]

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Account Activity</h3>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span className="text-xs text-text-muted">{r.label}</span>
            <span className={`text-sm font-data font-medium ${r.color}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EquityCurveSection({ data }: { data: CapitalDashboardPayload }) {
  const chartData = data.equity_curve.map((p) => ({
    date: p.date,
    equity: pnlNum(p.equity),
  }))

  return (
    <div className={`${CARD_STATIC} space-y-3`}>
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Equity Curve</h3>
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
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
            <Area
              type="monotone"
              dataKey="equity"
              name="Equity"
              stroke={COLORS.accent}
              fill="url(#equityGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-60 flex items-center justify-center text-text-muted text-sm">
          No equity data available
        </div>
      )}
    </div>
  )
}

function CapitalEventsManager({ data }: { data: CapitalDashboardPayload }) {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0])

  const createMutation = useMutation({
    mutationFn: (payload: { event_type: CapitalEventType; amount: string; timestamp: string; description?: string; account_id: number }) => createCapitalEvent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
      setShowModal(false)
      setAmount('')
      setDescription('')
      addToast({ title: 'Capital event added', message: `${modalType} saved successfully.`, variant: 'success' })
    },
    onError: (err) => addToast({ title: 'Failed', message: err.message, variant: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCapitalEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
      addToast({ title: 'Deleted', message: 'Capital event removed.', variant: 'success' })
    },
    onError: (err) => addToast({ title: 'Failed', message: err.message, variant: 'error' }),
  })

  const reconcileMutation = useMutation({
    mutationFn: () => reconcileAccount(data.account_id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
      if (res.event_created) {
        addToast({ title: 'Reconciled', message: `Balance adjusted by ${formatCurrency(res.delta)}.`, variant: 'info' })
      } else {
        addToast({ title: 'Reconciled', message: 'Balance already in sync.', variant: 'success' })
      }
    },
    onError: (err) => addToast({ title: 'Failed', message: err.message, variant: 'error' }),
  })

  const openModal = (type: 'deposit' | 'withdrawal') => {
    setModalType(type)
    setShowModal(true)
  }

  const handleSubmit = () => {
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return
    const finalAmount = modalType === 'withdrawal' ? -amountNum : amountNum
    createMutation.mutate({
      event_type: modalType,
      amount: String(finalAmount),
      timestamp: new Date(dateStr).toISOString(),
      description: description || undefined,
      account_id: data.account_id,
    })
  }

  const events = data.events

  return (
    <>
      <div className={`${CARD_STATIC} space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-text-heading font-display">Capital Events</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} />Reconcile
            </button>
            <button
              onClick={() => openModal('deposit')}
              className="inline-flex items-center gap-1 rounded-lg bg-profit/10 border border-profit/20 px-2.5 py-1.5 text-xs font-medium text-profit hover:bg-profit/20 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />Deposit
            </button>
            <button
              onClick={() => openModal('withdrawal')}
              className="inline-flex items-center gap-1 rounded-lg bg-loss/10 border border-loss/20 px-2.5 py-1.5 text-xs font-medium text-loss hover:bg-loss/20 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />Withdraw
            </button>
          </div>
        </div>
        {events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="text-left py-2 px-2 font-display">Date</th>
                  <th className="text-left py-2 px-2 font-display">Type</th>
                  <th className="text-right py-2 px-2 font-display">Amount</th>
                  <th className="text-left py-2 px-2 font-display">Description</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt, i) => {
                  const amt = pnlNum(evt.amount)
                  const isDeposit = evt.type === 'deposit'
                  const isWithdrawal = evt.type === 'withdrawal'
                  const badgeVariant = isDeposit ? 'profit' : isWithdrawal ? 'loss' : 'muted'
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-bg-elevated/30 transition-colors">
                      <td className="py-2 px-2 text-text-heading font-data">{evt.date}</td>
                      <td className="py-2 px-2">
                        <GlassBadge variant={badgeVariant}>{evt.type}</GlassBadge>
                      </td>
                      <td className={`py-2 px-2 text-right font-data ${amt >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(evt.amount)}
                      </td>
                      <td className="py-2 px-2 text-text-muted">{evt.description ?? '-'}</td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => {
                            if (confirm(`Delete this ${evt.type} of ${formatCurrency(evt.amount)}?`)) {
                              deleteMutation.mutate(evt.id)
                            }
                          }}
                          className="p-1 rounded hover:bg-loss/10 transition-colors cursor-pointer"
                          title="Delete event"
                        >
                          <Trash2 className="w-3 h-3 text-loss/60" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-text-muted text-sm">No capital events</div>
        )}
      </div>

      {/* Add/Withdraw Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-bg-card rounded-2xl border border-border shadow-xl animate-card-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-sm font-medium text-text-heading font-display flex items-center gap-2">
                {modalType === 'deposit' ? (
                  <><ArrowUpRight className="w-4 h-4 text-profit" /> Add Deposit</>
                ) : (
                  <><ArrowUpRight className="w-4 h-4 text-loss rotate-90" /> Add Withdrawal</>
                )}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer">
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Date</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 50000"
                  min="1"
                  className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly SIP, Bonus, ATM withdrawal..."
                  className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || !amount}
                  className={`flex-1 rounded-lg px-4 py-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                    modalType === 'deposit'
                      ? 'bg-profit text-white hover:bg-profit/90'
                      : 'bg-loss text-white hover:bg-loss/90'
                  }`}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                  ) : modalType === 'deposit' ? 'Add Deposit' : 'Add Withdrawal'}
                </button>
                <button onClick={() => setShowModal(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CapitalTiersSection({ data }: { data: CapitalDashboardPayload }) {
  const progress = data.progress_to_next_tier

  return (
    <div className={`${CARD_STATIC} space-y-4`}>
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading font-display">Capital Tiers</h3>
      </div>

      {progress != null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">Progress to next tier</span>
            <span className="text-text-heading font-data font-medium">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.tiers.map((tier) => {
          const isCurrent = tier.current
          return (
            <div
              key={tier.name}
              className={`flex items-center justify-between py-2.5 px-3 rounded-xl border transition-colors ${
                isCurrent
                  ? 'bg-accent-muted border-accent/30'
                  : 'bg-transparent border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-accent' : 'bg-text-muted'}`}
                />
                <div>
                  <div className={`text-sm font-medium font-display ${isCurrent ? 'text-accent' : 'text-text-heading'}`}>
                    {tier.name}
                  </div>
                  <div className="text-xs text-text-muted font-data">
                    {formatCurrency(tier.min)} - {tier.max ? formatCurrency(tier.max) : '∞'}
                  </div>
                </div>
              </div>
              {isCurrent && (
                <div className="flex items-center gap-1 text-xs text-accent font-data">
                  <ArrowUpRight className="w-3 h-3" />
                  Current
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TierEditor() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['tier-config'],
    queryFn: getTierConfig,
    staleTime: 30 * 1000,
  })
  const [tiers, setTiers] = useState<
    { name: string; min_amount: string; max_amount: string | null; sort_order: number }[]
  >([])

  useEffect(() => {
    if (data) {
      setTiers(data.items.map((t, i) => ({ ...t, sort_order: i })))
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: saveTierConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tier-config'] })
      queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
    },
  })

  const updateTier = (idx: number, field: 'name' | 'min_amount' | 'max_amount', value: string) => {
    const next = [...tiers]
    if (field === 'max_amount' && value === '') {
      next[idx] = { ...next[idx], max_amount: null }
    } else {
      next[idx] = { ...next[idx], [field]: value }
    }
    setTiers(next)
  }

  const addTier = () => {
    const prev = tiers[tiers.length - 1]
    const nextMin = prev?.max_amount != null && prev.max_amount !== '' ? prev.max_amount : String((Number(prev?.min_amount) || 0) + 100000)
    setTiers([...tiers, { name: 'New Tier', min_amount: nextMin, max_amount: null, sort_order: tiers.length }])
  }

  const removeTier = (idx: number) => {
    if (tiers.length <= 1) return
    setTiers(tiers.filter((_, i) => i !== idx))
  }

  const handleSave = () => {
    mutation.mutate(tiers.map((t, i) => ({ ...t, sort_order: i })))
  }

  if (isLoading) return <div className={`${CARD_STATIC} h-40 animate-pulse`} />

  return (
    <div className={`${CARD_STATIC} space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-medium text-text-heading font-display">Tier Settings</h3>
        </div>
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="space-y-2">
        {tiers.map((tier, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              value={tier.name}
              onChange={(e) => updateTier(idx, 'name', e.target.value)}
              className="w-32 rounded-lg border border-border-medium bg-bg-elevated/50 px-2.5 py-1.5 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
              placeholder="Tier name"
            />
            <input
              value={tier.min_amount}
              onChange={(e) => updateTier(idx, 'min_amount', e.target.value)}
              className="w-28 rounded-lg border border-border-medium bg-bg-elevated/50 px-2.5 py-1.5 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
              placeholder="Min ₹"
              type="number"
            />
            <input
              value={tier.max_amount ?? ''}
              onChange={(e) => updateTier(idx, 'max_amount', e.target.value)}
              className="w-28 rounded-lg border border-border-medium bg-bg-elevated/50 px-2.5 py-1.5 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
              placeholder="Max ₹ (empty = ∞)"
              type="number"
            />
            <button
              onClick={() => removeTier(idx)}
              className="p-1 rounded-md hover:bg-loss-muted transition-colors"
              title="Remove tier"
            >
              <Trash2 className="w-3.5 h-3.5 text-loss" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addTier}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-medium px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-heading hover:border-text-muted transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Tier
      </button>

      {mutation.isError && (
        <div className="text-xs text-loss font-data">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to save tiers'}
        </div>
      )}
    </div>
  )
}

export function CapitalPage() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const { data, isLoading, error } = useQuery<CapitalDashboardPayload>({
    queryKey: ['capital-dashboard'],
    queryFn: getCapitalDashboard,
    staleTime: 5 * 1000,
  })

  const [showEditAccount, setShowEditAccount] = useState(false)
  const [editName, setEditName] = useState('')
  const [editInitialBalance, setEditInitialBalance] = useState('')
  const [editBreakevenThreshold, setEditBreakevenThreshold] = useState('')

  useEffect(() => {
    if (data) {
      setEditName(data.account_name)
      setEditInitialBalance(data.initial_balance)
      setEditBreakevenThreshold(data.breakeven_threshold || '')
    }
  }, [data])

  const accountMutation = useMutation({
    mutationFn: (payload: { name?: string; initial_balance?: string; breakeven_threshold?: string }) => updateAccount(data!.account_id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
      setShowEditAccount(false)
      addToast({ title: 'Account updated', message: 'Starting capital saved.', variant: 'success' })
    },
    onError: (err) => addToast({ title: 'Failed', message: err.message, variant: 'error' }),
  })

  const handleSaveAccount = () => {
    accountMutation.mutate({ name: editName, initial_balance: editInitialBalance, breakeven_threshold: editBreakevenThreshold })
  }

  if (isLoading) {
    return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <div className="space-y-1">
          <div className="h-8 w-24 bg-bg-elevated rounded animate-pulse" />
          <div className="h-4 w-48 bg-bg-elevated rounded animate-pulse" />
        </div>
        <div className={`${CARD_STATIC} h-32 animate-pulse`} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${CARD_STATIC} h-48 animate-pulse`} />
          <div className={`${CARD_STATIC} h-48 animate-pulse`} />
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
          <h2 className="text-lg font-medium text-text-heading font-display mb-2">Failed to load capital data</h2>
          <p className="text-text-muted text-sm font-data">
            {(error as Error)?.message || 'Something went wrong fetching capital dashboard.'}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className={`${CARD_STATIC} py-12 text-center`}>
          <p className="text-text-muted font-data">No capital data available.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      <div className="space-y-1">
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Capital</h1>
        <p className="text-sm text-text-muted font-data">Account growth & equity tracking</p>
      </div>

      <NetEquityCard data={data} onEdit={() => setShowEditAccount(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PnlStatsCard data={data} />
        <AccountActivityCard data={data} />
      </div>

      <EquityCurveSection data={data} />
      <CapitalEventsManager data={data} />
      <CapitalTiersSection data={data} />
      <TierEditor />

      {/* Edit Starting Capital Modal */}
      {showEditAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-bg-card rounded-2xl border border-border shadow-xl animate-card-in">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-sm font-medium text-text-heading font-display flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-accent" /> Edit Account
              </h2>
              <button onClick={() => setShowEditAccount(false)} className="p-1 rounded-md hover:bg-bg-elevated transition-colors cursor-pointer">
                <X className="w-4 h-4 text-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Account Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Starting Capital (₹)</label>
                <input
                  type="number"
                  value={editInitialBalance}
                  onChange={(e) => setEditInitialBalance(e.target.value)}
                  min="0"
                  className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAccount() }}
                />
                <p className="text-[.6875rem] text-text-muted mt-1">
                  Changing this recalculates Net Equity. Deployed P&amp;L from trades is preserved.
                </p>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Breakeven Threshold (±₹)</label>
                <input
                  type="number"
                  value={editBreakevenThreshold}
                  onChange={(e) => setEditBreakevenThreshold(e.target.value)}
                  min="0"
                  step="10"
                  className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAccount() }}
                />
                <p className="text-[.6875rem] text-text-muted mt-1">
                  Trades with P&amp;L within ± this amount are classified as breakeven (not win/loss).
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveAccount}
                  disabled={accountMutation.isPending || !editName}
                  className="flex-1 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
                >
                  {accountMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Save Changes'}
                </button>
                <button onClick={() => setShowEditAccount(false)} className="rounded-lg border border-border px-4 py-2 text-xs text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
