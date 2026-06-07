import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  Receipt,
  Settings,
  Sparkles,
  TrendingUp,
  Wallet,
  BookOpenCheck,
  ClipboardList,
  Plus,
} from 'lucide-react'
import type { V3NavigationItem, V3NavigationSection } from './V3Shell.types'

/**
 * 5-group sidebar structure per V3_FINISH_PLAN §Phase 8:
 *   Today   — Cockpit, Trades, Calendar, Journal, Review
 *   Insight — Analytics, Playbook, Lifecycle
 *   Money   — Capital, Charges, Reports
 *   AI      — Coach
 *   System  — Settings
 *
 * Import is a topbar action / FAB — not a sidebar item.
 */
export const v3NavigationSections: V3NavigationSection[] = [
  {
    id: 'today',
    label: 'Today',
    items: [
      {
        id: 'cockpit',
        label: 'Cockpit',
        description: 'Command center: P&L, open risk, recent trades, and what needs attention.',
        icon: <LayoutDashboard aria-hidden="true" />,
      },
      {
        id: 'trades',
        label: 'Trades',
        description: 'Log, filter, and manage every position.',
        icon: <TrendingUp aria-hidden="true" />,
      },
      {
        id: 'calendar',
        label: 'Calendar',
        description: 'Month view of trading days and session patterns.',
        icon: <CalendarDays aria-hidden="true" />,
      },
      {
        id: 'journal',
        label: 'Journal',
        description: 'Daily notes and weekly journal rollups.',
        icon: <BookOpen aria-hidden="true" />,
      },
      {
        id: 'review',
        label: 'Review',
        description: 'Review queue for trades that need notes, grades, or cleanup.',
        icon: <ClipboardCheck aria-hidden="true" />,
      },
    ],
  },
  {
    id: 'insight',
    label: 'Insight',
    items: [
      {
        id: 'analytics',
        label: 'Analytics',
        description: 'Performance analytics: win rate, R-multiples, regime breakdown.',
        icon: <BarChart3 aria-hidden="true" />,
      },
      {
        id: 'playbooks',
        label: 'Playbook',
        description: 'Setups, tactics, rules, and the edge behind your strategies.',
        icon: <BookOpenCheck aria-hidden="true" />,
      },
      {
        id: 'lifecycle',
        label: 'Lifecycle',
        description: 'Emotions, execution grades, and behavioral drift.',
        icon: <Brain aria-hidden="true" />,
      },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      {
        id: 'capital',
        label: 'Capital',
        description: 'Account balance, deposits, withdrawals, reconciliation.',
        icon: <Wallet aria-hidden="true" />,
      },
      {
        id: 'charges',
        label: 'Charges',
        description: 'Daily contract-note charges ledger.',
        icon: <Receipt aria-hidden="true" />,
      },
      {
        id: 'reports',
        label: 'Reports',
        description: 'Weekly and monthly exportable reports.',
        icon: <FileBarChart aria-hidden="true" />,
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    items: [
      {
        id: 'coach',
        label: 'AI Coach',
        description: 'AI reviews, patterns, and coaching when you want depth.',
        icon: <Sparkles aria-hidden="true" />,
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
        description: 'Theme, AI providers, and preferences.',
        icon: <Settings aria-hidden="true" />,
      },
    ],
  },
]

/**
 * Mobile bottom nav: Cockpit · Trades · + (FAB) · Journal · Review
 * The center item (import/+) triggers the FAB create-trade action.
 */
export const v3MobileNavigationItems: V3NavigationItem[] = [
  {
    id: 'cockpit',
    label: 'Cockpit',
    description: 'Command center',
    icon: <LayoutDashboard aria-hidden="true" />,
  },
  {
    id: 'trades',
    label: 'Trades',
    description: 'Trade list',
    icon: <TrendingUp aria-hidden="true" />,
  },
  {
    id: 'import',
    label: 'Add',
    description: 'Create trade',
    icon: <Plus aria-hidden="true" />,
  },
  {
    id: 'journal',
    label: 'Journal',
    description: 'Daily journal',
    icon: <BookOpen aria-hidden="true" />,
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Review queue',
    icon: <ClipboardList aria-hidden="true" />,
  },
]

export function getV3NavigationItem(id: string): V3NavigationItem {
  return (
    [...v3NavigationSections.flatMap((section) => section.items), ...v3MobileNavigationItems].find(
      (item) => item.id === id,
    ) ?? v3NavigationSections[0].items[0]
  )
}
