import { Button, DataList, DataRow, Page, Stack, Value } from '@/new-ui'
import type { ActiveView } from '@/app/navigation'
import { useAppStore } from '@/store/appStore'
import { canAccessView } from '@/app/interfaceMode'
import { viewMeta } from '@/app/navigation'

const MORE_VIEWS: ActiveView[] = [
  'ideas',
  'coach',
  'perf-os',
  'sa-notes',
  'risk',
  'market',
  'recommendations',
  'coaching-intelligence',
  'edge-center',
]

export function V3MoreSection() {
  const { navMode, setActiveView } = useAppStore()
  const accessibleViews = MORE_VIEWS.filter((view) => canAccessView(view, navMode))

  return (
    <Page
      title="More"
      subtitle="Additional legacy workflows stay available until their V3 surfaces ship."
    >
      <Stack gap="lg">
        <DataList>
          {accessibleViews.map((view) => {
            const meta = viewMeta[view]
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

        {accessibleViews.length === 0 && (
          <DataRow
            title="No extra views in Simple mode"
            trailing={<Value value="Switch to Pro in Settings" />}
          />
        )}
      </Stack>
    </Page>
  )
}
