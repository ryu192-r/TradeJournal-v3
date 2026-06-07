import { Button, DataList, DataRow, Page, Stack } from '@/new-ui'
import type { ActiveView } from '@/app/navigation'
import { useAppStore } from '@/store/appStore'
import { viewMeta } from '@/app/navigation'

const MORE_VIEWS: ActiveView[] = [
  'coach',
]

export function V3MoreSection() {
  const { setActiveView } = useAppStore()

  return (
    <Page
      title="More"
      subtitle="Additional legacy workflows stay available until their V3 surfaces ship."
    >
      <Stack gap="lg">
        <DataList>
          {MORE_VIEWS.map((view) => {
            const meta = viewMeta[view]
            if (!meta) return null
            return (
              <DataRow
                key={view}
                title={meta.label}
                subtitle={meta.purpose}
                trailing={
                  <Button variant="secondary" size="sm" onClick={() => setActiveView(view)}>
                    Open
                  </Button>
                }
              />
            )
          })}
        </DataList>
      </Stack>
    </Page>
  )
}
