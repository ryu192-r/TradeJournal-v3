import type { ActiveView } from '@/app/navigation'
import type { V3PreviewSectionId } from './V3Shell.types'

export function activeViewToV3Section(
  activeView: ActiveView,
  tradeFormMode: 'list' | 'create' | 'edit' | 'detail',
  sectionOverride: V3PreviewSectionId | null,
): V3PreviewSectionId {
  if (sectionOverride) return sectionOverride
  if (tradeFormMode !== 'list') return 'trades'

  switch (activeView) {
    case 'dashboard':
      return 'cockpit'
    case 'trades':
      return 'trades'
    case 'review':
      return 'review'
    case 'analytics':
      return 'analytics'
    case 'playbook':
      return 'playbooks'
    case 'reports':
      return 'reports'
    case 'charges':
      return 'charges'
    case 'settings':
      return 'settings'
    default:
      return 'more'
  }
}

export function v3SectionToActiveView(section: V3PreviewSectionId): ActiveView | null {
  switch (section) {
    case 'cockpit':
      return 'dashboard'
    case 'trades':
      return 'trades'
    case 'review':
      return 'review'
    case 'analytics':
      return 'analytics'
    case 'playbooks':
      return 'playbook'
    case 'reports':
      return 'reports'
    case 'charges':
      return 'charges'
    case 'settings':
      return 'settings'
    case 'import':
    case 'more':
      return null
    default:
      return null
  }
}
