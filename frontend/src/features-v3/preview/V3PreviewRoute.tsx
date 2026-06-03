import { useState } from 'react'
import { V3PreviewDemoLogin } from './V3PreviewDemoLogin'
import { V3PreviewPage } from './V3PreviewPage'

interface V3PreviewRouteProps {
  isAuthenticated: boolean
}

export function V3PreviewRoute({ isAuthenticated }: V3PreviewRouteProps) {
  const [demoUnlocked, setDemoUnlocked] = useState(() => localStorage.getItem('tjv3_preview_demo') === 'enabled')

  if (isAuthenticated || demoUnlocked) {
    return <V3PreviewPage dataEnabled={isAuthenticated} />
  }

  return <V3PreviewDemoLogin onUnlock={() => setDemoUnlocked(true)} />
}
