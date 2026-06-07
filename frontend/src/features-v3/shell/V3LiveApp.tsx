import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LoadingState } from '@/components/ui'
import { useAppStore } from '@/store/appStore'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { CockpitV3Page } from '../cockpit'
import { TradesV3Page } from '../trades'
import { CoachV3Page } from '../coach'
import { V3MoreSection } from './V3MoreSection'
import { V3Shell } from './V3Shell'
import type { V3PreviewSectionId, V3ShellMode } from './V3Shell.types'
import { activeViewToV3Section, v3SectionToActiveView } from './v3ViewMapping'

// Heavy V3 pages — lazy to keep V3LiveApp chunk small.
const TradeDetailV3Page = lazy(() =>
  import('../trade-detail').then((m) => ({ default: m.TradeDetailV3Page })),
)
const ChargesLedgerPage = lazy(() =>
  import('../charges').then((m) => ({ default: m.ChargesLedgerPage })),
)
const TradeFormV3Page = lazy(() =>
  import('../trade-form').then((m) => ({ default: m.TradeFormV3Page })),
)
const ReviewV3Page = lazy(() =>
  import('../review').then((m) => ({ default: m.ReviewV3Page })),
)
const AnalyticsV3Page = lazy(() =>
  import('../analytics').then((m) => ({ default: m.AnalyticsV3Page })),
)
const ReportsV3Page = lazy(() =>
  import('../reports').then((m) => ({ default: m.ReportsV3Page })),
)
const PlaybookV3Page = lazy(() =>
  import('../playbook').then((m) => ({ default: m.PlaybookV3Page })),
)
const ImportV3Page = lazy(() =>
  import('../import').then((m) => ({ default: m.ImportV3Page })),
)
const SettingsV3Page = lazy(() =>
  import('../settings').then((m) => ({ default: m.SettingsV3Page })),
)
const CalendarV3Page = lazy(() =>
  import('../calendar').then((m) => ({ default: m.CalendarV3Page })),
)
const JournalV3Page = lazy(() =>
  import('../journal').then((m) => ({ default: m.JournalV3Page })),
)
const CapitalV3Page = lazy(() =>
  import('../capital').then((m) => ({ default: m.CapitalV3Page })),
)
const LifecycleV3Page = lazy(() =>
  import('../lifecycle').then((m) => ({ default: m.LifecycleV3Page })),
)

const SetupPlaybookPage = lazy(() =>
  import('@/components/playbook/SetupPlaybookPage').then((m) => ({ default: m.SetupPlaybookPage })),
)
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const TradeDetailPage = lazy(() => import('@/pages/TradeDetailPage').then((m) => ({ default: m.TradeDetailPage })))
const PerformanceOSPage = lazy(() =>
  import('@/pages/PerformanceOSPage').then((m) => ({ default: m.PerformanceOSPage })),
)
const DailySANotesPage = lazy(() =>
  import('@/pages/DailySANotesPage').then((m) => ({ default: m.DailySANotesPage })),
)

function ViewFallback() {
  return (
    <div className="tjv3-live-fallback">
      <LoadingState variant="page" />
    </div>
  )
}

interface V3LiveAppProps {
  mode?: V3ShellMode
}

export function V3LiveApp({ mode = 'live' }: V3LiveAppProps) {
  const {
    activeView,
    tradeFormMode,
    selectedTradeId,
    setActiveView,
    closeTradeForm,
    openCreateTrade,
    openDetailTrade,
  } = useAppStore()
  const [sectionOverride, setSectionOverride] = useState<V3PreviewSectionId | null>(null)
  const [legacyDetailFallback, setLegacyDetailFallback] = useState(false)
  const [legacyPlaybookFallback, setLegacyPlaybookFallback] = useState(false)
  const [legacySettingsFallback, setLegacySettingsFallback] = useState(false)

  useEffect(() => {
    if (tradeFormMode !== 'detail') {
      setLegacyDetailFallback(false)
    }
  }, [tradeFormMode])

  useEffect(() => {
    if (activeView !== 'playbook') {
      setLegacyPlaybookFallback(false)
    }
  }, [activeView])

  useEffect(() => {
    if (activeView !== 'settings') {
      setLegacySettingsFallback(false)
    }
  }, [activeView])

  const activeSection = useMemo(
    () => activeViewToV3Section(activeView, tradeFormMode, sectionOverride),
    [activeView, tradeFormMode, sectionOverride],
  )

  const handleSectionChange = useCallback(
    (section: V3PreviewSectionId) => {
      const mappedView = v3SectionToActiveView(section)
      if (mappedView) {
        setSectionOverride(null)
        setActiveView(mappedView)
        return
      }

      if (section === 'import') {
        setSectionOverride('import')
        closeTradeForm()
        return
      }

      if (section === 'more') {
        setSectionOverride('more')
        closeTradeForm()
      }
    },
    [closeTradeForm, setActiveView],
  )

  const handleMobileAdd = useCallback(() => {
    setSectionOverride(null)
    openCreateTrade()
  }, [openCreateTrade])

  const renderContent = () => {
    if (tradeFormMode === 'create') {
      return (
        <ErrorBoundary name="TradeFormV3Create">
          <TradeFormV3Page mode="create" />
        </ErrorBoundary>
      )
    }

    if (tradeFormMode === 'edit' && selectedTradeId != null) {
      return (
        <ErrorBoundary name="TradeFormV3Edit">
          <TradeFormV3Page mode="edit" tradeId={selectedTradeId} />
        </ErrorBoundary>
      )
    }

    if (tradeFormMode === 'detail' && selectedTradeId != null) {
      if (legacyDetailFallback) {
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="LegacyTradeDetail">
              <TradeDetailPage tradeId={selectedTradeId} />
            </ErrorBoundary>
          </div>
        )
      }

      return (
        <ErrorBoundary name="TradeDetailV3">
          <TradeDetailV3Page
            tradeId={selectedTradeId}
            onOpenLegacyWorkspace={() => setLegacyDetailFallback(true)}
          />
        </ErrorBoundary>
      )
    }

    if (sectionOverride === 'import') {
      return (
        <ErrorBoundary name="ImportV3">
          <ImportV3Page />
        </ErrorBoundary>
      )
    }

    if (sectionOverride === 'more') {
      return <V3MoreSection />
    }

    switch (activeView) {
      case 'dashboard':
        return (
          <ErrorBoundary name="CockpitV3">
            <CockpitV3Page dataEnabled />
          </ErrorBoundary>
        )
      case 'trades':
        return (
          <ErrorBoundary name="TradesV3">
            <TradesV3Page dataEnabled onOpenTradeDetail={openDetailTrade} />
          </ErrorBoundary>
        )
      case 'review':
        return (
          <ErrorBoundary name="ReviewV3">
            <ReviewV3Page dataEnabled />
          </ErrorBoundary>
        )
      case 'analytics':
        return (
          <ErrorBoundary name="AnalyticsV3">
            <AnalyticsV3Page dataEnabled />
          </ErrorBoundary>
        )
      case 'playbook':
        if (legacyPlaybookFallback) {
          return (
            <div className="tjv3-legacy-embed">
              <ErrorBoundary name="LegacyPlaybook">
                <SetupPlaybookPage />
              </ErrorBoundary>
            </div>
          )
        }
        return (
          <ErrorBoundary name="PlaybookV3">
            <PlaybookV3Page
              dataEnabled
              onOpenLegacy={() => setLegacyPlaybookFallback(true)}
            />
          </ErrorBoundary>
        )
      case 'reports':
        return (
          <ErrorBoundary name="ReportsV3">
            <ReportsV3Page dataEnabled />
          </ErrorBoundary>
        )
      case 'charges':
        return (
          <ErrorBoundary name="ChargesLedger">
            <ChargesLedgerPage />
          </ErrorBoundary>
        )
      case 'settings':
        if (legacySettingsFallback) {
          return (
            <div className="tjv3-legacy-embed">
              <ErrorBoundary name="LegacySettings">
                <SettingsPage />
              </ErrorBoundary>
            </div>
          )
        }
        return (
          <ErrorBoundary name="SettingsV3">
            <SettingsV3Page onOpenLegacy={() => setLegacySettingsFallback(true)} />
          </ErrorBoundary>
        )
      case 'capital':
        return (
          <ErrorBoundary name="CapitalV3">
            <CapitalV3Page />
          </ErrorBoundary>
        )
      case 'coach':
        return (
          <ErrorBoundary name="CoachV3">
            <CoachV3Page />
          </ErrorBoundary>
        )
      case 'perf-os':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="PerfOS">
              <PerformanceOSPage />
            </ErrorBoundary>
          </div>
        )
      case 'journal':
        return (
          <ErrorBoundary name="JournalV3">
            <JournalV3Page dataEnabled />
          </ErrorBoundary>
        )
      case 'calendar':
        return (
          <ErrorBoundary name="CalendarV3">
            <CalendarV3Page dataEnabled />
          </ErrorBoundary>
        )
      case 'sa-notes':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="SANotes">
              <DailySANotesPage />
            </ErrorBoundary>
          </div>
        )
      case 'lifecycle':
        return (
          <ErrorBoundary name="LifecycleV3">
            <LifecycleV3Page />
          </ErrorBoundary>
        )
      default:
        return (
          <ErrorBoundary name="CockpitV3">
            <CockpitV3Page dataEnabled />
          </ErrorBoundary>
        )
    }
  }

  return (
    <V3Shell
      mode={mode}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onMobileAdd={handleMobileAdd}
      onAddTrade={openCreateTrade}
    >
      <Suspense fallback={<ViewFallback />}>{renderContent()}</Suspense>
    </V3Shell>
  )
}
