import { useCallback, useMemo, useState } from 'react'
import { Page, Stack } from '@/new-ui'
import { BrokerImportModal } from '@/components/trades/BrokerImportModal'
import { useToastStore } from '@/store/toastStore'
import { useQueryClient } from '@tanstack/react-query'
import { getBrokerTemplate } from '@/lib/endpoints'
import type { BrokerImportResult } from '@/types'
import { ImportSourceCards } from './components/ImportSourceCards'
import { ImportInstructionsPanel } from './components/ImportInstructionsPanel'
import { ImportResultSummary } from './components/ImportResultSummary'
import { ImportFallbackPanel } from './components/ImportFallbackPanel'
import { useBrokersQuery } from './hooks/useBrokersQuery'

interface ImportV3PageProps {
  /** Optional: callback when user explicitly opens the legacy modal directly. */
  onOpenLegacy?: () => void
}

export function ImportV3Page({ onOpenLegacy }: ImportV3PageProps) {
  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()
  const brokersQuery = useBrokersQuery(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [lastResult, setLastResult] = useState<BrokerImportResult | null>(null)
  const [lastBrokerName, setLastBrokerName] = useState<string | null>(null)
  const [lastRanAt, setLastRanAt] = useState<string | null>(null)
  const [pendingBrokerId, setPendingBrokerId] = useState<string | null>(null)

  const brokers = useMemo(() => brokersQuery.data?.brokers ?? [], [brokersQuery.data])

  const handleStartImport = useCallback((brokerId: string) => {
    const broker = brokers.find((b) => b.id === brokerId)
    setPendingBrokerId(brokerId)
    setLastBrokerName(broker?.name ?? brokerId)
    setModalOpen(true)
  }, [brokers])

  const handleDownloadTemplate = useCallback(async (brokerId: string) => {
    try {
      addToast({ title: 'Downloading template', message: `${brokerId} template`, variant: 'info' })
      const blob = await getBrokerTemplate(brokerId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${brokerId}_import_template.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      addToast({ title: 'Error', message: 'Failed to download template', variant: 'error' })
    }
  }, [addToast])

  const handleImported = useCallback(() => {
    // Import creates/merges trades → refresh every trade-domain consumer.
    void queryClient.invalidateQueries({ queryKey: ['trades'] })
    void queryClient.invalidateQueries({ queryKey: ['daily-charges'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'operational'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'intelligence'] })
    void queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['analytics'] })
    void queryClient.invalidateQueries({ queryKey: ['setups'] })
  }, [queryClient])

  const handleImportComplete = useCallback((result: BrokerImportResult) => {
    setLastResult(result)
    setLastRanAt(new Date().toISOString().slice(0, 16).replace('T', ' '))
  }, [])

  const handleOpenLegacy = useCallback(() => {
    if (onOpenLegacy) {
      onOpenLegacy()
      return
    }
    // Default fallback: open the same modal directly without preselected broker.
    setPendingBrokerId(null)
    setLastBrokerName(null)
    setModalOpen(true)
  }, [onOpenLegacy])

  return (
    <>
      <Page
        title="Import"
        subtitle="Bring broker trades into your journal without changing your review workflow."
      >
        <Stack gap="lg">
          <ImportSourceCards
            brokers={brokers}
            isLoading={brokersQuery.isLoading && !brokersQuery.data}
            onDownloadTemplate={handleDownloadTemplate}
            onStartImport={handleStartImport}
          />
          <ImportInstructionsPanel />
          <ImportResultSummary
            brokerName={lastBrokerName}
            result={lastResult}
            ranAt={lastRanAt}
          />
          <ImportFallbackPanel onOpenLegacy={handleOpenLegacy} />
        </Stack>
      </Page>

      <BrokerImportModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setPendingBrokerId(null)
        }}
        onImported={handleImported}
        onImportComplete={handleImportComplete}
        key={pendingBrokerId ?? 'modal'}
      />
    </>
  )
}
