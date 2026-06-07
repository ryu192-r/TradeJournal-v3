import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Sparkles,
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
  analyticsItem,
  playbookItem,
  settingsItem,
] satisfies NavigationItem[]

export const advancedNavigationItems = [
  {
    id: 'capital',
    label: 'Capital',
    icon: Wallet,
    view: 'capital',
    purpose: 'Account balance, deposits, withdrawals, reconciliation.',
  },
  {
    id: 'journal',
    label: 'Journal',
    icon: BookOpen,
    view: 'journal',
    purpose: 'Daily notes and weekly journal rollups.',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    view: 'reports',
    purpose: 'Weekly and monthly exportable reports.',
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    icon: Brain,
    view: 'lifecycle',
    purpose: 'Emotions, execution grades, and behavioral drift.',
  },
  {
    id: 'coach',
    label: 'AI Coach',
    icon: Sparkles,
    view: 'coach',
    purpose: 'AI reviews, patterns, and coaching when you want depth.',
  },
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
    id: 'primary',
    label: 'Primary',
    items: desktopNavigationItems,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    items: advancedNavigationItems,
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
