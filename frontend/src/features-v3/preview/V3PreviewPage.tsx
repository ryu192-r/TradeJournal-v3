import { useState } from 'react'
import { CockpitV3Page } from '../cockpit'
import { V3Shell } from '../shell/V3Shell'
import type { V3PreviewSectionId } from '../shell/V3Shell.types'
import { V3PreviewHome } from './V3PreviewHome'

interface V3PreviewPageProps {
  dataEnabled?: boolean
}

export function V3PreviewPage({ dataEnabled = true }: V3PreviewPageProps) {
  const [activeSection, setActiveSection] = useState<V3PreviewSectionId>('cockpit')

  return (
    <V3Shell activeSection={activeSection} onSectionChange={setActiveSection}>
      {activeSection === 'cockpit' ? <CockpitV3Page dataEnabled={dataEnabled} /> : <V3PreviewHome activeSection={activeSection} />}
    </V3Shell>
  )
}
