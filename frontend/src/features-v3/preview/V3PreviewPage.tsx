import { useState } from 'react'
import { V3Shell } from '../shell/V3Shell'
import type { V3PreviewSectionId } from '../shell/V3Shell.types'
import { V3PreviewHome } from './V3PreviewHome'

export function V3PreviewPage() {
  const [activeSection, setActiveSection] = useState<V3PreviewSectionId>('cockpit')

  return (
    <V3Shell activeSection={activeSection} onSectionChange={setActiveSection}>
      <V3PreviewHome activeSection={activeSection} />
    </V3Shell>
  )
}
