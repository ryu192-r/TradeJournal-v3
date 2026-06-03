import { Button, Page, Stack } from '@/new-ui'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { TradeEntryForm } from '@/components/forms/TradeEntryForm'
import { useCreateTradeMutation, useUpdateTradeMutation, useTradeQuery } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'

interface TradeFormV3PageProps {
  mode: 'create' | 'edit'
  tradeId?: number
}

export function TradeFormV3Page({ mode, tradeId }: TradeFormV3PageProps) {
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const createMutation = useCreateTradeMutation()
  const updateMutation = useUpdateTradeMutation()

  const { data: trade, isLoading, error } = useTradeQuery(
    mode === 'edit' && tradeId ? tradeId : 0,
  )

  const title = mode === 'create' ? 'Add Trade' : 'Edit Trade'
  const subtitle = mode === 'create'
    ? 'Create a new journal trade with plan, risk, and market context.'
    : 'Update trade details without changing lifecycle history.'

  if (mode === 'edit' && isLoading) {
    return (
      <Page title={title} subtitle={subtitle} actions={<BackButton onClick={closeTradeForm} />}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-accent)' }} />
          <span className="ml-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading trade…</span>
        </div>
      </Page>
    )
  }

  if (mode === 'edit' && (error || !trade)) {
    return (
      <Page title={title} subtitle={subtitle} actions={<BackButton onClick={closeTradeForm} />}>
        <Stack gap="md" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: 'var(--color-loss)', fontWeight: 600 }}>Trade not found</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Could not load trade #{tradeId}. It may have been deleted.
          </p>
          <Button variant="ghost" size="sm" onClick={closeTradeForm}>Back to Trades</Button>
        </Stack>
      </Page>
    )
  }

  return (
    <Page title={title} subtitle={subtitle} actions={<BackButton onClick={closeTradeForm} />}>
      <TradeEntryForm
        mode={mode}
        initialData={mode === 'edit' ? trade : undefined}
        submitFn={
          mode === 'create'
            ? (payload) => createMutation.mutateAsync(payload)
            : (payload) => updateMutation.mutateAsync({ id: tradeId ?? 0, payload })
        }
        onSubmitSuccess={closeTradeForm}
        onCancel={closeTradeForm}
      />
    </Page>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft size={16} />
      Back
    </Button>
  )
}
