import type { LucideIcon } from 'lucide-react'
import {
  BookOpen,
  Brain,
  Briefcase,
  CalendarDays,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  Lightbulb,
  Radar,
  Shield,
  Sparkles,
  TrendingUp,
  Globe,
  Settings,
  Wallet,
  FileText,
} from 'lucide-react'

export type NavMode = 'simple' | 'pro'

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
  | 'recommendations'
  | 'coaching-intelligence'
  | 'edge-center'

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

/** V2 information architecture — five product areas */
export const navigationSections: NavigationSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        view: 'dashboard',
        simple: true,
        mobile: true,
        purpose: 'Command center: P&L, open risk, recent trades, and what needs attention.',
      },
    ],
  },
  {
    id: 'trades',
    label: 'Trades',
    items: [
      {
        id: 'trades',
        label: 'Trades',
        icon: Briefcase,
        view: 'trades',
        simple: true,
        mobile: true,
        purpose: 'Log, filter, and manage every position.',
      },
      {
        id: 'ideas',
        label: 'Ideas',
        icon: Lightbulb,
        view: 'ideas',
        purpose: 'Capture setups before they become live trades.',
      },
      {
        id: 'calendar',
        label: 'Calendar',
        icon: CalendarDays,
        view: 'calendar',
        purpose: 'Month view of trading days and session patterns.',
      },
    ],
  },
  {
    id: 'review-analytics',
    label: 'Review & Analytics',
    items: [
      {
        id: 'review',
        label: 'Review & Analytics',
        icon: TrendingUp,
        view: 'review',
        simple: true,
        mobile: true,
        purpose: 'Review queue plus performance analytics in one place.',
      },
      {
        id: 'perf-os',
        label: 'Performance OS',
        icon: Cpu,
        view: 'perf-os',
        purpose: 'Daily workflow: pre-market → execution → review.',
      },
      {
        id: 'journal',
        label: 'Journal',
        icon: BookOpen,
        view: 'journal',
        purpose: 'Daily notes and weekly journal rollups.',
      },
      {
        id: 'sa-notes',
        label: 'SA Notes',
        icon: ClipboardList,
        view: 'sa-notes',
        purpose: 'Structured pre/post-market note templates.',
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
        id: 'risk',
        label: 'Risk',
        icon: Shield,
        view: 'risk',
        purpose: 'Portfolio heat, stops, and concentration.',
      },
      {
        id: 'market',
        label: 'Market Context',
        icon: Globe,
        view: 'market',
        purpose: 'Regime, breadth, and live quotes vs your results.',
      },
    ],
  },
  {
    id: 'edge-lab',
    label: 'Edge Lab',
    items: [
      {
        id: 'edge-center',
        label: 'Edge Center',
        icon: Radar,
        view: 'edge-center',
        purpose: 'Full focus, avoid, review queue, and next best action.',
      },
      {
        id: 'recommendations',
        label: 'Intelligence',
        icon: Brain,
        view: 'recommendations',
        purpose: 'Data-driven recommendations from your history.',
      },
      {
        id: 'coaching-intelligence',
        label: 'Coaching Intel',
        icon: Sparkles,
        view: 'coaching-intelligence',
        purpose: 'Weekly coaching synthesis from journals and trades.',
      },
      {
        id: 'coach',
        label: 'AI Coach',
        icon: Sparkles,
        view: 'coach',
        purpose: 'AI reviews, patterns, and coaching when you want depth.',
      },
    ],
  },
  {
    id: 'playbook-knowledge',
    label: 'Playbook & Knowledge',
    items: [
      {
        id: 'playbook',
        label: 'Playbook',
        icon: ClipboardList,
        view: 'playbook',
        simple: true,
        mobile: true,
        purpose: 'Setups, tactics, and the rule base behind your edge.',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      {
        id: 'capital',
        label: 'Capital',
        icon: Wallet,
        view: 'capital',
        purpose: 'Account balance, deposits, withdrawals, reconciliation.',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        view: 'settings',
        simple: true,
        purpose: 'Theme, AI providers, navigation mode, and preferences.',
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
  if (mode === 'pro') return true
  return viewMeta[view]?.simple ?? false
}

export function filterNavigationSections(mode: NavMode): NavigationSection[] {
  return navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.comingSoon || !item.view || isViewVisibleInMode(item.view, mode)
      ),
    }))
    .filter((section) => section.items.length > 0)
}
