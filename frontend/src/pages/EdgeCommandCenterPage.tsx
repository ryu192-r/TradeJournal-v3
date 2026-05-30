import { PageShell } from '@/components/layout/PageShell'
import { EdgeCommandCenter } from '@/components/edge/EdgeCommandCenter'

export function EdgeCommandCenterPage() {
  return (
    <PageShell className="space-y-[var(--page-gap)]">
      <EdgeCommandCenter />
    </PageShell>
  )
}
