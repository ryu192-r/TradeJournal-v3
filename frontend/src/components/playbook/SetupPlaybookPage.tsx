// Setup Playbook page: tabbed view — Setups (CRUD) + Intelligence (deep analytics)
import { useState } from 'react'
import { GlassButton } from '@/components/ui/GlassButton'
import { SetupCard } from './SetupCard'
import { SetupFormModal } from './SetupFormModal'
import { ConfirmModal } from './ConfirmModal'
import {
  useSetupsQuery,
  useCreateSetupMutation,
  useUpdateSetupMutation,
  useArchiveSetupMutation,
  useSeedSetupsMutation,
} from '@/hooks/useSetupPlaybookQuery'
import { useToastStore } from '@/store/toastStore'
import { Loader2, Plus, RefreshCw, Filter, BookOpen, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SetupPlaybookCreatePayload, SetupPlaybookUpdatePayload } from '@/types/setupPlaybook'
import { PlaybookIntelligenceFull } from './PlaybookIntelligenceFull'

type TabKey = 'setups' | 'intelligence'

export function SetupPlaybookPage() {
  const addToast = useToastStore((s) => s.addToast)
  const [activeTab, setActiveTab] = useState<TabKey>('setups')
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmArchive, setConfirmArchive] = useState<number | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())

  const isActiveParam = filter === 'all' ? undefined : filter
  const { data, isLoading, error } = useSetupsQuery(isActiveParam)

  const createMutation = useCreateSetupMutation()
  const updateMutation = useUpdateSetupMutation()
  const archiveMutation = useArchiveSetupMutation()
  const seedMutation = useSeedSetupsMutation()

  const editingSetup = editingId != null ? data?.items.find((s) => s.id === editingId) ?? null : null

  const filteredItems =
    data?.items.filter((s) => {
      if (filter === 'all') return true
      return s.is_active === filter
    }) ?? []

  const toggleCard = (id: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleCreate = () => {
    setEditingId(null)
    setModalOpen(true)
  }

  const handleEdit = (id: number) => {
    setEditingId(id)
    setModalOpen(true)
  }

  const handleArchivePrompt = (id: number) => {
    setConfirmArchive(id)
  }

  const handleArchiveConfirm = async () => {
    if (!confirmArchive) return
    try {
      await archiveMutation.mutateAsync(confirmArchive)
      addToast({ title: 'Archived', message: 'Setup archived successfully.', variant: 'info' })
    } catch {
      addToast({ title: 'Error', message: 'Failed to archive setup.', variant: 'error' })
    } finally {
      setConfirmArchive(null)
    }
  }

  const handleSubmit = async (payload: SetupPlaybookCreatePayload | SetupPlaybookUpdatePayload) => {
    try {
      if (editingId != null) {
        await updateMutation.mutateAsync({ id: editingId, payload: payload as SetupPlaybookUpdatePayload })
        addToast({ title: 'Updated', message: 'Setup updated successfully.', variant: 'info' })
      } else {
        await createMutation.mutateAsync(payload as SetupPlaybookCreatePayload)
        addToast({ title: 'Created', message: 'New setup created.', variant: 'info' })
      }
      setModalOpen(false)
      setEditingId(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save setup.'
      addToast({ title: 'Error', message: msg, variant: 'error' })
    }
  }

  const handleSeed = async () => {
    try {
      await seedMutation.mutateAsync()
      addToast({ title: 'Seeded', message: 'Default setups loaded.', variant: 'info' })
    } catch {
      addToast({ title: 'Error', message: 'Failed to seed defaults.', variant: 'error' })
    }
  }

  const isMutating =
    createMutation.isPending || updateMutation.isPending || archiveMutation.isPending || seedMutation.isPending

  return (
    <div className="p-4 sm:p-6 lg:p-[2rem_2.5rem_3.5rem_3rem] lg:max-w-[calc(100vw-14rem)]">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-text-heading tracking-tight">
            My Playbook
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Your edge, written down. Trade the plan, not the moment.
          </p>
        </div>
        <div className="flex flex-col sm:items-end gap-2 self-start">
          {/* Session badge */}
          <div className="inline-flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-bg-card border border-border text-xs text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            Closed · Opens 9:15 AM IST
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <GlassButton variant="ghost" size="sm" onClick={handleSeed} disabled={isMutating}>
              <RefreshCw className={cn('w-4 h-4', seedMutation.isPending && 'animate-spin')} />
              Seed Defaults
            </GlassButton>
            <GlassButton variant="accent" size="sm" onClick={handleCreate} disabled={isMutating}>
              <Plus className="w-4 h-4" />
              New Setup
            </GlassButton>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6">
        <button
          onClick={() => setActiveTab('setups')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            activeTab === 'setups'
              ? 'bg-accent-muted text-accent border border-accent/20'
              : 'text-text-muted hover:text-text hover:bg-bg-elevated/50 border border-transparent'
          )}
        >
          <BookOpen className="w-4 h-4" />
          Setups
        </button>
        <button
          onClick={() => setActiveTab('intelligence')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            activeTab === 'intelligence'
              ? 'bg-accent-muted text-accent border border-accent/20'
              : 'text-text-muted hover:text-text hover:bg-bg-elevated/50 border border-transparent'
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Intelligence
        </button>
      </div>

      {/* Intelligence tab */}
      {activeTab === 'intelligence' && (
        <PlaybookIntelligenceFull />
      )}

      {/* Setups tab */}
      {activeTab === 'setups' && (
      <>
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-text-muted" />
        {(['all', 'active', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-hover cursor-pointer',
              filter === f
                ? 'bg-accent-muted text-accent border border-accent/20'
                : 'text-text-muted hover:text-text hover:bg-bg-elevated/50 border border-transparent'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-2" />
          <p className="text-sm text-text-muted">Loading setups...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="py-12 text-center">
          <p className="text-sm text-loss">Failed to load setups.</p>
          <p className="text-xs text-text-muted mt-1">{error.message}</p>
        </div>
      )}

      {/* Cards grid */}
      {!isLoading && !error && (
        <>
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((setup, index) => (
                <SetupCard
                  key={setup.id}
                  setup={setup}
                  onEdit={handleEdit}
                  onArchive={handleArchivePrompt}
                  expanded={expandedCards.has(setup.id)}
                  onToggle={() => toggleCard(setup.id)}
                  staggerDelay={Math.min(index * 30 + 20, 170)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">No setups found.</p>
              {filter === 'all' && (
                <p className="text-xs text-text-muted mt-1">
                  Click "Seed Defaults" to load the 7 canonical setups, or "New Setup" to create one.
                </p>
              )}
            </div>
          )}
        </>
      )}
      </>
      )}

      <SetupFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingId(null)
        }}
        onSubmit={handleSubmit}
        setup={editingSetup}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmModal
        open={confirmArchive != null}
        title="Archive Setup?"
        message="This will archive the setup. It can be restored later by editing and setting status to active."
        onConfirm={handleArchiveConfirm}
        onCancel={() => setConfirmArchive(null)}
        isPending={archiveMutation.isPending}
        confirmLabel="Archive"
        danger
      />
    </div>
  )
}
