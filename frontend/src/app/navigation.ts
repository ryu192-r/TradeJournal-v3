import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Lightbulb,
  Shield,
  Sparkles,
  TrendingUp,
  Globe,
  Settings,
  Wallet,
  FileText,
} from 'lucide-react'

export type NavMode = 'simple' | 'advanced'

export type ActiveView =
  | 'dashboard'
  | 'analytics'
  | 'coach'
  | 'trades'
  | 'playbook'
  | 'review'
  | 'ideas'
  | 'capital'
  | 'perf-os'
  | 'sa-notes'
  | 'settings'
  | 'journal'
  | 'calendar'
  | 'reports'
  | 'lifecycle'
  | 'risk'
  | 'market'

export type NavigationItem = {
  id: string
  label: string
  icon: LucideIcon
  view?: ActiveView
  simple?: boolean
  mobile?: boolean
  purpose?: string
  comingSoon?: boolean
}

export type NavigationSection = {
  id: string
  label: string
  items: NavigationItem[]
}

export const navigationSections: NavigationSection[] = [
  {
    id: 'command-center',
    label: 'Command Center',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        view: 'dashboard',
        simple: true,
        mobile: true,
        purpose: 'See what is open, what is risky, and what needs your attention first.',
      },
      {
        id: 'calendar',
        label: 'Calendar',
        icon: CalendarDays,
        view: 'calendar',
        purpose: 'Review your trading days as a month-level pattern surface.',
      },
      {
        id: 'reports',
        label: 'Reports',
        icon: FileText,
        view: 'reports',
        purpose: 'Generate repeatable weekly, monthly, setup, and behavior reports.',
      },
    ],
  },
  {
    id: 'trading-desk',
    label: 'Trading Desk',
    items: [
      {
        id: 'trades',
        label: 'Trades',
        icon: Briefcase,
        view: 'trades',
        simple: true,
        mobile: true,
        purpose: 'Research, filter, and manage every position and execution detail.',
      },
      {
        id: 'ideas',
        label: 'Ideas',
        icon: Lightbulb,
        view: 'ideas',
        purpose: 'Capture trade ideas before they become live positions.',
      },
    ],
  },
  {
    id: 'review-loop',
    label: 'Review Loop',
    items: [
      {
        id: 'perf-os',
        label: 'Performance OS',
        icon: Cpu,
        view: 'perf-os',
        simple: true,
        mobile: true,
        purpose: 'Run the daily workflow from pre-market planning through behavioral review.',
      },
      {
        id: 'journal',
        label: 'Journal',
        icon: BookOpen,
        view: 'journal',
        purpose: 'Write and compare daily notes, reflections, and weekly journal rollups.',
      },
      {
        id: 'sa-notes',
        label: 'SA Notes',
        icon: ClipboardList,
        view: 'sa-notes',
        purpose: 'Keep structured pre-market and post-market note templates in one place.',
      },
      {
        id: 'review',
        label: 'Review Queue',
        icon: TrendingUp,
        view: 'review',
        purpose: 'Process trades that still need notes, grades, tags, or re-review.',
      },
      {
        id: 'coach',
        label: 'AI Coach',
        icon: Sparkles,
        view: 'coach',
        purpose: 'Use AI reviews, pattern detection, and coaching prompts when you need depth.',
      },
    ],
  },
  {
    id: 'edge-lab',
    label: 'Edge Lab',
    items: [
      {
        id: 'playbook',
        label: 'Playbook',
        icon: ClipboardList,
        view: 'playbook',
        simple: true,
        mobile: true,
        purpose: 'Maintain setups, tactics, and the rule base behind your edge.',
      },
      {
        id: 'analytics',
        label: 'Analytics',
        icon: BarChart3,
        view: 'analytics',
        purpose: 'Inspect deterministic performance analytics beyond the command center.',
      },
      {
        id: 'lifecycle',
        label: 'Lifecycle',
        icon: Brain,
        view: 'lifecycle',
        purpose: 'Study emotions, execution grades, discipline, and behavioral drift together.',
      },
      {
        id: 'risk',
        label: 'Risk',
        icon: Shield,
        view: 'risk',
        purpose: 'Review portfolio heat, stop coverage, and exposure concentration in one place.',
      },
      {
        id: 'market',
        label: 'Market Context',
        icon: Globe,
        view: 'market',
        purpose: 'Compare your performance with regime, breadth, sector strength, and live quotes.',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'capital',
        label: 'Capital',
        icon: Wallet,
        view: 'capital',
        simple: true,
        mobile: true,
        purpose: 'Track account balance, capital events, and reconciliation health.',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        view: 'settings',
        simple: true,
        purpose: 'Configure themes, AI providers, and system-level preferences.',
      },
    ],
  },
]

export const mobileNavigationItems = navigationSections
  .flatMap((section) => section.items)
  .filter((item) => item.mobile && item.view)

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
            simple: Boolean(item.simple),
          },
        ])
    )
) as Record<ActiveView, { label: string; purpose: string; section: string; icon: LucideIcon; simple: boolean }>

export function isViewVisibleInMode(view: ActiveView, mode: NavMode) {
  if (mode === 'advanced') return true
  return viewMeta[view]?.simple ?? false
}
