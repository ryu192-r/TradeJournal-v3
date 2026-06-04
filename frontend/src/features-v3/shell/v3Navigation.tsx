import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Brain,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  Import,
  LayoutDashboard,
  MoreHorizontal,
  Receipt,
  Settings,
  SquarePlus,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type { V3NavigationItem, V3NavigationSection } from './V3Shell.types'

export const v3NavigationSections: V3NavigationSection[] = [
  {
    id: 'command',
    label: 'Command',
    items: [
      {
        id: 'cockpit',
        label: 'Cockpit',
        description: 'Command center shell slot',
        icon: <LayoutDashboard aria-hidden="true" />,
        phase: 'N3',
      },
      {
        id: 'trades',
        label: 'Trades',
        description: 'Workspace shell slot',
        icon: <TrendingUp aria-hidden="true" />,
        phase: 'N4',
      },
      {
        id: 'calendar',
        label: 'Calendar',
        description: 'Month view of sessions and PnL',
        icon: <CalendarDays aria-hidden="true" />,
        phase: 'N3',
      },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      {
        id: 'review',
        label: 'Review',
        description: 'Review flow placeholder',
        icon: <ClipboardCheck aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'journal',
        label: 'Journal',
        description: 'Weekly journal + daily editor',
        icon: <BookOpen aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'import',
        label: 'Import',
        description: 'Import surface placeholder',
        icon: <Import aria-hidden="true" />,
        phase: 'N6',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      {
        id: 'playbooks',
        label: 'Playbooks',
        description: 'Setup library placeholder',
        icon: <BookOpenCheck aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Analysis shell slot',
        icon: <BarChart3 aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'reports',
        label: 'Reports',
        description: 'Reporting shell slot',
        icon: <FileBarChart aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'charges',
        label: 'Charges',
        description: 'Daily contract-note charges ledger',
        icon: <Receipt aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'capital',
        label: 'Capital',
        description: 'Equity, deposits, withdrawals, reconciliation',
        icon: <Wallet aria-hidden="true" />,
        phase: 'N6',
      },
      {
        id: 'lifecycle',
        label: 'Lifecycle',
        description: 'Emotions, grades, behavioral patterns, discipline',
        icon: <Brain aria-hidden="true" />,
        phase: 'N6',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        description: 'Settings shell slot',
        icon: <Settings aria-hidden="true" />,
        phase: 'Later',
      },
    ],
  },
]

export const v3MobileNavigationItems: V3NavigationItem[] = [
  {
    id: 'cockpit',
    label: 'Today',
    description: 'Preview today shell',
    icon: <LayoutDashboard aria-hidden="true" />,
    phase: 'N3',
  },
  {
    id: 'trades',
    label: 'Trades',
    description: 'Preview trades shell',
    icon: <TrendingUp aria-hidden="true" />,
    phase: 'N4',
  },
  {
    id: 'import',
    label: 'Add',
    description: 'Preview action shell',
    icon: <SquarePlus aria-hidden="true" />,
    phase: 'Preview',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Preview review shell',
    icon: <ClipboardCheck aria-hidden="true" />,
    phase: 'N6',
  },
  {
    id: 'more',
    label: 'More',
    description: 'Preview more shell',
    icon: <MoreHorizontal aria-hidden="true" />,
    phase: 'Preview',
  },
]

export function getV3NavigationItem(id: string): V3NavigationItem {
  return (
    [...v3NavigationSections.flatMap((section) => section.items), ...v3MobileNavigationItems].find((item) => item.id === id) ??
    v3NavigationSections[0].items[0]
  )
}
