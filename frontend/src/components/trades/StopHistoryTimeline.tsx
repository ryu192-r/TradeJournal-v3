import { useStopHistoryQuery, useCreateStopHistoryMutation } from '@/hooks/useStopHistoryQuery'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useToastStore } from '@/store/toastStore'
import { formatPrice } from '@/utils/format'

interface StopHistoryTimelineProps {
  tradeId: number
}

const STOP_TYPE_LABELS: Record<string, string> = {
  initial: 'Initial Stop',
  manual: 'Manual Adjustment',
  breakeven: 'Moved to Breakeven',
  trailing: 'Trailing Stop',
  target: 'Target Hit',
}

const STOP_TYPE_COLORS: Record<string, string> = {
  initial: 'bg-accent',
  manual: 'bg-yellow-500',
  breakeven: 'bg-profit',
  trailing: 'bg-blue-500',
  target: 'bg-purple-500',
}

export function StopHistoryTimeline({ tradeId }: StopHistoryTimelineProps) {
  const addToast = useToastStore((s) => s.addToast)
  const { data, isLoading } = useStopHistoryQuery(tradeId)
  const createMutation = useCreateStopHistoryMutation()
  const [showForm, setShowForm] = useState(false)
  const [newType, setNewType] = useState('manual')
  const [newPrice, setNewPrice] = useState('')

  const entries = data?.items ?? []
  const canAdd = !isLoading

  const handleAdd = async () => {
    if (!newPrice) return
    try {
      await createMutation.mutateAsync({
        tradeId,
        payload: {
          stop_type: newType,
          price: newPrice,
          timestamp: new Date().toISOString(),
        },
      })
      setShowForm(false)
      setNewPrice('')
      setNewType('manual')
      addToast({ title: 'Recorded', message: 'Stop adjustment saved.', variant: 'success' })
    } catch {
      addToast({ title: 'Error', message: 'Failed to record stop.', variant: 'error' })
    }
  }

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-heading">Stop History</h3>
        {canAdd && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-accent hover:bg-accent-muted transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 mb-3 space-y-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-sm bg-bg-card border border-border text-text-heading"
          >
            {Object.entries(STOP_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Stop price"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-sm bg-bg-card border border-border text-text-heading"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newPrice || createMutation.isPending}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
            >
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1 rounded-lg text-xs font-medium text-text-muted hover:text-text-heading transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="py-4 text-center">
          <Loader2 className="w-4 h-4 text-accent animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text-xs text-text-muted text-center py-4">No stop adjustments recorded.</p>
      )}

      {entries.length > 0 && (
        <div className="relative pl-6 space-y-3">
          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
          {entries.map((entry) => (
            <div key={entry.id} className="relative">
              <div className={`absolute -left-[14px] top-1 w-2 h-2 rounded-full ${STOP_TYPE_COLORS[entry.stop_type] || 'bg-text-muted'}`} />
              <div className="text-xs">
                <span className="text-text-heading font-medium">{STOP_TYPE_LABELS[entry.stop_type] || entry.stop_type}</span>
                <span className="text-text-muted ml-2">{formatPrice(Number(entry.price))}</span>
              </div>
              <div className="text-[10px] text-text-muted mt-0.5">
                {new Date(entry.timestamp).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
