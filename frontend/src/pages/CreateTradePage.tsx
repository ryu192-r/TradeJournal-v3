// Page component for creating a new trade
import { TradeEntryForm } from '@/components/forms/TradeEntryForm'
import { useCreateTradeMutation } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'

export function CreateTradePage() {
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const createMutation = useCreateTradeMutation()

  return (
    <div className="p-6">
      <TradeEntryForm
        mode="create"
        submitFn={(payload) => createMutation.mutateAsync(payload)}
        onSubmitSuccess={closeTradeForm}
        onCancel={closeTradeForm}
      />
    </div>
  )
}
