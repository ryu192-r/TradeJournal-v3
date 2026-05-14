// Trade Ideas page: list, filter by status, create/edit, convert to trade, archive
import { useState } from 'react'
import { IdeaCard } from './IdeaCard'
import { IdeaFormModal } from './IdeaFormModal'
import { ConvertToTradeModal } from './ConvertToTradeModal'
import { ConfirmModal } from '@/components/playbook/ConfirmModal'
import {
  useTradeIdeasQuery,
  useCreateIdeaMutation,
  useUpdateIdeaMutation,
  useDeleteIdeaMutation,
  useConvertToTradeMutation,
} from '@/hooks/useTradeIdeasQuery'
import { useToastStore } from '@/store/toastStore'
import { Loader2, Plus, Filter, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TradeIdeaStatus, TradeIdeaCreatePayload, TradeIdeaUpdatePayload, ConvertToTradePayload } from '@/types/tradeIdea'

type StatusFilter = 'all' | TradeIdeaStatus

export function TradeIdeasPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [convertId, setConvertId] = useState<number | null>(null)

  const statusParam: TradeIdeaStatus | undefined = filter === 'all' ? undefined : filter
  const { data, isLoading, error } = useTradeIdeasQuery(statusParam)

  const createMutation = useCreateIdeaMutation()
  const updateMutation = useUpdateIdeaMutation()
  const deleteMutation = useDeleteIdeaMutation()
  const convertMutation = useConvertToTradeMutation()

  const editingIdea = editingId != null ? data?.items.find((i) => i.id === editingId) ?? null : null
  const convertingIdea = convertId != null ? data?.items.find((i) => i.id === convertId) ?? null : null

  const handleCreate = () => {
    setEditingId(null)
    setModalOpen(true)
  }

  const handleEdit = (id: number) => {
    setEditingId(id)
    setModalOpen(true)
  }

  const handleArchivePrompt = (id: number) => {
    const idea = data?.items.find((i) => i.id === id)
    if (idea?.status === 'archived') {
      setConfirmDelete(id)
    } else {
      setConfirmArchive(id)
    }
  }

  const handleArchiveConfirm = async () => {
    if (!confirmArchive) return
    try {
      await updateMutation.mutateAsync({ id: confirmArchive, payload: { status: 'archived' } })
      addToast({ title: 'Archived', message: 'Idea archived.', variant: 'info' })
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to archive idea.', variant: 'error' })
    } finally {
      setConfirmArchive(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    try {
      await deleteMutation.mutateAsync(confirmDelete)
      addToast({ title: 'Deleted', message: 'Idea permanently removed.', variant: 'info' })
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to delete idea.', variant: 'error' })
    } finally {
      setConfirmDelete(null)
    }
  }

  const handleActivate = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, payload: { status: 'active' } })
      addToast({ title: 'Activated', message: 'Idea is now active.', variant: 'info' })
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to activate idea.', variant: 'error' })
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await updateMutation.mutateAsync({ id, payload: { status: 'draft' } })
      addToast({ title: 'Restored', message: 'Idea restored to draft.', variant: 'info' })
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to restore idea.', variant: 'error' })
    }
  }

  const handleConvert = (id: number) => {
    setConvertId(id)
  }

  const handleConvertSubmit = async (payload: ConvertToTradePayload) => {
    if (!convertId) return
    try {
      await convertMutation.mutateAsync({ id: convertId, payload })
      addToast({ title: 'Converted', message: 'Idea converted to trade successfully.', variant: 'info' })
      setConvertId(null)
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to convert idea to trade.', variant: 'error' })
    }
  }

  const handleSubmit = async (payload: TradeIdeaCreatePayload | TradeIdeaUpdatePayload) => {
    try {
      if (editingId != null) {
        await updateMutation.mutateAsync({ id: editingId, payload: payload as TradeIdeaUpdatePayload })
        addToast({ title: 'Updated', message: 'Idea updated successfully.', variant: 'info' })
      } else {
        await createMutation.mutateAsync(payload as TradeIdeaCreatePayload)
        addToast({ title: 'Created', message: 'New trade idea created.', variant: 'info' })
      }
      setModalOpen(false)
      setEditingId(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save idea.'
      addToast({ title: 'Error', message: msg, variant: 'error' })
    }
  }

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || convertMutation.isPending

  const filteredItems = data?.items ?? []

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'traded', label: 'Traded' },
    { value: 'archived', label: 'Archived' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-accent" />
          <h1 className="font-display text-xl sm:text-2xl text-text-heading">Trade Ideas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCreate}
            disabled={isMutating}
          >
            <Plus className="w-4 h-4" />
            New Idea
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-text-muted shrink-0" />
        {filterOptions.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-[150ms] ease-out cursor-pointer whitespace-nowrap',
              filter === f.value
                ? 'bg-accent-muted text-accent border border-accent/20'
                : 'text-text-muted hover:text-text hover:bg-bg-elevated/50 border border-transparent'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List container */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        {isLoading && (
          <div className="py-12 text-center">
            <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-2" />
            <p className="text-sm text-text-muted">Loading ideas...</p>
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-sm text-loss">Failed to load trade ideas.</p>
            <p className="text-xs text-text-muted mt-1">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="space-y-3">
            {filteredItems.length > 0 ? (
              filteredItems.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  onEdit={handleEdit}
                  onArchive={handleArchivePrompt}
                  onActivate={handleActivate}
                  onConvert={handleConvert}
                  onRestore={handleRestore}
                />
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-text-muted">No trade ideas found.</p>
                <p className="text-xs text-text-muted mt-1">
                  Click "New Idea" to capture your first trade idea.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <IdeaFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingId(null)
        }}
        onSubmit={handleSubmit}
        idea={editingIdea}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {convertingIdea && (
        <ConvertToTradeModal
          open={convertId != null}
          onClose={() => setConvertId(null)}
          onSubmit={handleConvertSubmit}
          symbol={convertingIdea.symbol}
          direction={convertingIdea.direction}
          isPending={convertMutation.isPending}
        />
      )}

      <ConfirmModal
        open={confirmArchive != null}
        title="Archive Idea?"
        message="This idea will be archived. You can restore it later from the Archived filter."
        onConfirm={handleArchiveConfirm}
        onCancel={() => setConfirmArchive(null)}
        isPending={updateMutation.isPending}
        confirmLabel="Archive"
      />

      <ConfirmModal
        open={confirmDelete != null}
        title="Delete Idea?"
        message="This will permanently delete the archived idea. This action cannot be undone."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
        isPending={deleteMutation.isPending}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
