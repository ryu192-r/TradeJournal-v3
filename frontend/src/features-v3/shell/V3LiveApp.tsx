import { canAccessView } from '@/app/interfaceMode'
import { ProModeGate } from '@/components/layout/ProModeGate'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LoadingState } from '@/components/ui'
import { useAppStore } from '@/store/appStore'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { CockpitV3Page } from '../cockpit'
import { TradesV3Page } from '../trades'
import { TradeDetailV3Page } from '../trade-detail'
import { ChargesLedgerPage } from '../charges'
import { TradeFormV3Page } from '../trade-form'
import { V3ImportSection } from './V3ImportSection'
import { V3MoreSection } from './V3MoreSection'
import { V3Shell } from './V3Shell'
import type { V3PreviewSectionId, V3ShellMode } from './V3Shell.types'
import { activeViewToV3Section, v3SectionToActiveView } from './v3ViewMapping'

const ReviewAnalyticsPage = lazy(() =>
  import('@/pages/ReviewAnalyticsPage').then((m) => ({ default: m.ReviewAnalyticsPage })),
)
const SetupPlaybookPage = lazy(() =>
  import('@/components/playbook/SetupPlaybookPage').then((m) => ({ default: m.SetupPlaybookPage })),
)
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const TradeDetailPage = lazy(() => import('@/pages/TradeDetailPage').then((m) => ({ default: m.TradeDetailPage })))
const CapitalPage = lazy(() => import('@/pages/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const TradeIdeasPage = lazy(() =>
  import('@/components/ideas/TradeIdeasPage').then((m) => ({ default: m.TradeIdeasPage })),
)
const AICoachPage = lazy(() => import('@/components/coach/AICoachPage').then((m) => ({ default: m.AICoachPage })))
const PerformanceOSPage = lazy(() =>
  import('@/pages/PerformanceOSPage').then((m) => ({ default: m.PerformanceOSPage })),
)
const DailySANotesPage = lazy(() =>
  import('@/pages/DailySANotesPage').then((m) => ({ default: m.DailySANotesPage })),
)
const JournalPage = lazy(() => import('@/pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const LifecyclePage = lazy(() => import('@/pages/LifecyclePage').then((m) => ({ default: m.LifecyclePage })))
const RiskPage = lazy(() => import('@/pages/RiskPage').then((m) => ({ default: m.RiskPage })))
const MarketContextPage = lazy(() =>
  import('@/pages/MarketContextPage').then((m) => ({ default: m.MarketContextPage })),
)
const RecommendationsPage = lazy(() =>
  import('@/pages/RecommendationsPage').then((m) => ({ default: m.RecommendationsPage })),
)
const CoachingIntelligencePage = lazy(() =>
  import('@/pages/CoachingIntelligencePage').then((m) => ({ default: m.CoachingIntelligencePage })),
)
const EdgeCommandCenterPage = lazy(() =>
  import('@/pages/EdgeCommandCenterPage').then((m) => ({ default: m.EdgeCommandCenterPage })),
)
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TradesPage = lazy(() => import('@/pages/TradesPage').then((m) => ({ default: m.TradesPage })))

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
    navMode,
    setActiveView,
    closeTradeForm,
    openCreateTrade,
    openDetailTrade,
  } = useAppStore()
  const [sectionOverride, setSectionOverride] = useState<V3PreviewSectionId | null>(null)
  const [legacyDetailFallback, setLegacyDetailFallback] = useState(false)

  useEffect(() => {
    if (tradeFormMode !== 'detail') {
      setLegacyDetailFallback(false)
    }
  }, [tradeFormMode])

  const activeSection = useMemo(
    () => activeViewToV3Section(activeView, tradeFormMode, sectionOverride),
    [activeView, tradeFormMode, sectionOverride],
  )
  const viewBlocked = !canAccessView(activeView, navMode)

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
    if (viewBlocked) {
      return <ProModeGate view={activeView} />
    }

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
      return <V3ImportSection />
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
      case 'analytics':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="ReviewAnalytics">
              <ReviewAnalyticsPage defaultTab={activeView === 'analytics' ? 'overview' : 'queue'} />
            </ErrorBoundary>
          </div>
        )
      case 'playbook':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Playbook">
              <SetupPlaybookPage />
            </ErrorBoundary>
          </div>
        )
      case 'reports':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Reports">
              <ReportsPage />
            </ErrorBoundary>
          </div>
        )
      case 'charges':
        return (
          <ErrorBoundary name="ChargesLedger">
            <ChargesLedgerPage />
          </ErrorBoundary>
        )
      case 'settings':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Settings">
              <SettingsPage />
            </ErrorBoundary>
          </div>
        )
      case 'ideas':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Ideas">
              <TradeIdeasPage />
            </ErrorBoundary>
          </div>
        )
      case 'capital':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Capital">
              <CapitalPage />
            </ErrorBoundary>
          </div>
        )
      case 'coach':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="AICoach">
              <AICoachPage />
            </ErrorBoundary>
          </div>
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
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Journal">
              <JournalPage />
            </ErrorBoundary>
          </div>
        )
      case 'calendar':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Calendar">
              <CalendarPage />
            </ErrorBoundary>
          </div>
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
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Lifecycle">
              <LifecyclePage />
            </ErrorBoundary>
          </div>
        )
      case 'risk':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Risk">
              <RiskPage />
            </ErrorBoundary>
          </div>
        )
      case 'market':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="MarketContext">
              <MarketContextPage />
            </ErrorBoundary>
          </div>
        )
      case 'recommendations':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="Recommendations">
              <RecommendationsPage />
            </ErrorBoundary>
          </div>
        )
      case 'coaching-intelligence':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="CoachingIntelligence">
              <CoachingIntelligencePage />
            </ErrorBoundary>
          </div>
        )
      case 'edge-center':
        return (
          <div className="tjv3-legacy-embed">
            <ErrorBoundary name="EdgeCenter">
              <EdgeCommandCenterPage />
            </ErrorBoundary>
          </div>
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

/** Internal fallback pages kept available for future debug routes. */
export function V3LegacyDashboardFallback() {
  return (
    <div className="tjv3-legacy-embed">
      <ErrorBoundary name="LegacyDashboard">
        <DashboardPage />
      </ErrorBoundary>
    </div>
  )
}

export function V3LegacyTradesFallback() {
  return (
    <div className="tjv3-legacy-embed">
      <ErrorBoundary name="LegacyTrades">
        <TradesPage />
      </ErrorBoundary>
    </div>
  )
}
