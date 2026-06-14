import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Sparkles,
  Target,
  TrendingUp,
  Settings,
  Upload,
  Wallet,
  FileText,
} from 'lucide-react'

export type ActiveView =
  | 'dashboard'
  | 'analytics'
  | 'coach'
  | 'trades'
  | 'playbook'
  | 'review'
  | 'capital'
  | 'settings'
  | 'journal'
  | 'calendar'
  | 'reports'
  | 'lifecycle'
  | 'charges'
  | 'improvement'

export type NavigationItem = {
  id: string
  label: string
  icon: LucideIcon
  view?: ActiveView
  mobile?: boolean
  purpose?: string
  comingSoon?: boolean
}

export type NavigationSection = {
  id: string
  label: string
  items: NavigationItem[]
}

const dashboardItem: NavigationItem = {
  id: 'dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
  view: 'dashboard',
  mobile: true,
  purpose: 'Command center: P&L, open risk, recent trades, and what needs attention.',
}

const tradesItem: NavigationItem = {
  id: 'trades',
  label: 'Trades',
  icon: Briefcase,
  view: 'trades',
  mobile: true,
  purpose: 'Log, filter, and manage every position.',
}

const calendarItem: NavigationItem = {
  id: 'calendar',
  label: 'Calendar',
  icon: CalendarDays,
  view: 'calendar',
  mobile: true,
  purpose: 'Month view of trading days and session patterns.',
}

const reviewItem: NavigationItem = {
  id: 'review',
  label: 'Review',
  icon: TrendingUp,
  view: 'review',
  mobile: true,
  purpose: 'Review queue for trades that need notes, grades, or cleanup.',
}

const improvementItem: NavigationItem = {
  id: 'improvement',
  label: 'Improvement',
  icon: Target,
  view: 'improvement',
  purpose: 'Trading Improvement Loop command center: Now, Focus, Next Move, Backlog.',
}

const analyticsItem: NavigationItem = {
  id: 'analytics',
  label: 'Analytics',
  icon: BarChart3,
  view: 'analytics',
  purpose: 'Performance analytics tabs inside the review workspace.',
}

const playbookItem: NavigationItem = {
  id: 'playbook',
  label: 'Playbook',
  icon: ClipboardList,
  view: 'playbook',
  purpose: 'Setups, tactics, and the rule base behind your edge.',
}

const settingsItem: NavigationItem = {
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  view: 'settings',
  purpose: 'Theme, AI providers, and preferences.',
}

export const primaryNavigationItems = [
  dashboardItem,
  tradesItem,
  calendarItem,
  reviewItem,
  playbookItem,
  settingsItem,
] satisfies NavigationItem[]

export const desktopNavigationItems = [
  dashboardItem,
  tradesItem,
  calendarItem,
  reviewItem,
  improvementItem,
  analyticsItem,
  playbookItem,
  settingsItem,
] satisfies NavigationItem[]

const journalItem: NavigationItem = {
  id: 'journal',
  label: 'Journal',
  icon: BookOpen,
  view: 'journal',
  purpose: 'Daily notes and weekly journal rollups.',
}

const capitalItem: NavigationItem = {
  id: 'capital',
  label: 'Capital',
  icon: Wallet,
  view: 'capital',
  purpose: 'Account balance, deposits, withdrawals, reconciliation.',
}

const chargesItem: NavigationItem = {
  id: 'charges',
  label: 'Charges',
  icon: Receipt,
  view: 'charges',
  purpose: 'Daily contract-note charges ledger.',
}

const reportsItem: NavigationItem = {
  id: 'reports',
  label: 'Reports',
  icon: FileText,
  view: 'reports',
  purpose: 'Weekly and monthly exportable reports.',
}

const lifecycleItem: NavigationItem = {
  id: 'lifecycle',
  label: 'Lifecycle',
  icon: Brain,
  view: 'lifecycle',
  purpose: 'Emotions, execution grades, and behavioral drift.',
}

const coachItem: NavigationItem = {
  id: 'coach',
  label: 'AI Coach',
  icon: Sparkles,
  view: 'coach',
  purpose: 'AI reviews, patterns, and coaching when you want depth.',
}

export const advancedNavigationItems = [
  capitalItem,
  journalItem,
  reportsItem,
  lifecycleItem,
  coachItem,
] satisfies NavigationItem[]

export const mobileBottomNavigationItems = [
  dashboardItem,
  tradesItem,
  calendarItem,
  reviewItem,
] satisfies NavigationItem[]

export const mobileMoreNavigationItems = [
  playbookItem,
  settingsItem,
  {
    id: 'import-export',
    label: 'Import / Export',
    icon: Upload,
    view: 'trades',
    purpose: 'Open Trades; broker import and CSV export live there.',
  },
] satisfies NavigationItem[]

export const mobileNavigationItems = mobileBottomNavigationItems

export const navigationSections: NavigationSection[] = [
  {
    id: 'today',
    label: 'Today',
    items: [dashboardItem, tradesItem, calendarItem, journalItem, reviewItem, improvementItem],
  },
  {
    id: 'insight',
    label: 'Insight',
    items: [analyticsItem, playbookItem, lifecycleItem],
  },
  {
    id: 'money',
    label: 'Money',
    items: [capitalItem, chargesItem, reportsItem],
  },
  {
    id: 'ai',
    label: 'AI',
    items: [coachItem],
  },
  {
    id: 'system',
    label: 'System',
    items: [settingsItem],
  },
]

export const viewMeta = Object.fromEntries(
  navigationSections
    .flatMap((section) =>
      section.items
        .filter((item): item is NavigationItem & { view: ActiveView } => Boolean(item.view))
        .map((item) => [
          item.view,
          {
            label: item.label,
            purpose: item.purpose ?? '',
            section: section.label,
            icon: item.icon,
          },
        ])
    )
) as Record<ActiveView, { label: string; purpose: string; section: string; icon: LucideIcon }>
