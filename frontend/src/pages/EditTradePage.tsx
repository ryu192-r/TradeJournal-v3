// Page component for editing an existing trade
import { TradeEntryForm } from '@/components/forms/TradeEntryForm'
import { useTradeQuery, useUpdateTradeMutation } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { Loader2 } from 'lucide-react'

interface EditTradePageProps {
  tradeId?: number
}

export function EditTradePage({ tradeId }: EditTradePageProps) {
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const { data: trade, isLoading, error } = useTradeQuery(tradeId ?? 0)
  const updateMutation = useUpdateTradeMutation()

  const handleSubmitSuccess = () => {
    closeTradeForm()
  }

  const handleCancel = () => {
    closeTradeForm()
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <GlassCard className="flex items-center gap-3 px-6 py-4" hover={false}>
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
          <span className="text-sm text-text-muted">Loading trade...</span>
        </GlassCard>
      </div>
    )
  }

  if (error || !trade) {
    return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <GlassCard className="py-12 text-center" hover={false}>
          <div className="text-lg font-medium text-loss mb-2">Trade not found</div>
          <p className="text-text-muted">
            Could not load trade #{tradeId}. It may have been deleted.
          </p>
          <button
            onClick={handleCancel}
            className="mt-4 text-sm text-accent hover:text-accent-hover underline cursor-pointer"
          >
            Back to Trades
          </button>
        </GlassCard>
      </div>
    )
  }

  return (
    <div className="p-6">
      <TradeEntryForm
        mode="edit"
        initialData={trade}
        submitFn={(payload) =>
          updateMutation.mutateAsync({ id: tradeId ?? 0, payload })
        }
        onSubmitSuccess={handleSubmitSuccess}
        onCancel={handleCancel}
      />
    </div>
  )
}
