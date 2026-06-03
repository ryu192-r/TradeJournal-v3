import {
  Badge,
  Button,
  DataList,
  DataRow,
  Drawer,
  EmptyState,
  Grid,
  MetricCard,
  MoneyValue,
  Page,
  Panel,
  SplitPane,
  Stack,
  TableShell,
  Value,
} from '@/new-ui'
import { BookOpenCheck, ClipboardCheck, LayoutDashboard, PanelsTopLeft, ReceiptText, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { V3PreviewSectionId } from '../shell/V3Shell.types'
import { getV3NavigationItem } from '../shell/v3Navigation'
import { V3PreviewSection } from './V3PreviewSection'

interface V3PreviewHomeProps {
  activeSection: V3PreviewSectionId
}

const previewCards = [
  {
    title: 'Cockpit foundation',
    body: 'Shell slot for N3. Layout only, no account or market values connected.',
    phase: 'N3',
    icon: <LayoutDashboard aria-hidden="true" />,
  },
  {
    title: 'Trades workspace',
    body: 'Route area for N4. Preview proves density, scrolling, and responsive spacing.',
    phase: 'N4',
    icon: <TrendingUp aria-hidden="true" />,
  },
  {
    title: 'Review workflow',
    body: 'Future review surface placeholder. Local preview state only.',
    phase: 'N6',
    icon: <ClipboardCheck aria-hidden="true" />,
  },
  {
    title: 'India-first charges intelligence',
    body: 'Future module placeholder. Not connected to broker notes, charges, or reports.',
    phase: 'Later',
    icon: <ReceiptText aria-hidden="true" />,
  },
]

export function V3PreviewHome({ activeSection }: V3PreviewHomeProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const current = getV3NavigationItem(activeSection)

  return (
    <>
      <Page
        title="V3 Shell Preview"
        subtitle="Isolated rebuild shell for the next TradeJournal interface."
        actions={
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer preview
          </Button>
        }
      >
        <Stack gap="lg">
          <Grid minColumnWidth="15rem">
            {previewCards.map((card) => (
              <V3PreviewSection key={card.title} {...card} />
            ))}
          </Grid>

          <SplitPane
            primary={
              <Panel
                title="Responsive canvas proof"
                description="Preview-only components showing shell spacing, wrapping, and density."
              >
                <Grid minColumnWidth="12rem">
                  <MetricCard label="Active shell slot" value={current.label} description={current.description} />
                  <MetricCard label="Next phase marker" value={current.phase ?? 'Preview'} description="Roadmap label, not app data." />
                  <MetricCard label="Connection state" value="Not connected" description="No API calls on this route." />
                  <MetricCard
                    label="Component preview value"
                    value={<MoneyValue value={0} tone="neutral" />}
                    description="Static formatting demo, not account data."
                  />
                </Grid>
              </Panel>
            }
            secondary={
              <Panel title="Preview state" description="Navigation changes local shell content only.">
                <DataList>
                  <DataRow title="Route" trailing={<Value value="/v3-preview" />} />
                  <DataRow title="Active section" trailing={<Badge variant="accent">{current.label}</Badge>} />
                  <DataRow title="Data source" trailing={<Value value="None" />} />
                  <DataRow title="Legacy routes" trailing={<Value value="Unchanged" />} />
                </DataList>
              </Panel>
            }
          />

          <Panel
            title="Workspace table shell"
            description="Responsive table wrapper placeholder. Rows describe migration slots, not trading records."
          >
            <TableShell>
              <table>
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Phase</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Cockpit</td>
                    <td>N3</td>
                    <td>Coming next</td>
                  </tr>
                  <tr>
                    <td>Trades</td>
                    <td>N4</td>
                    <td>Not migrated</td>
                  </tr>
                  <tr>
                    <td>Trade detail</td>
                    <td>N5</td>
                    <td>Not migrated</td>
                  </tr>
                  <tr>
                    <td>Review and reports</td>
                    <td>N6</td>
                    <td>Not migrated</td>
                  </tr>
                </tbody>
              </table>
            </TableShell>
            <div className="tjv3-preview-table-note">No production records are rendered in this preview route.</div>
          </Panel>

          <EmptyState
            icon={<BookOpenCheck aria-hidden="true" />}
            title="No production data connected"
            description="This route proves shell structure only. Real Cockpit, Trades, Review, Analytics, and Reports stay on legacy UI until later phases."
          />
        </Stack>
      </Page>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="V3 drawer preview"
        description="Overlay behavior proof for future detail and settings surfaces."
        footer={
          <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
            Close preview
          </Button>
        }
      >
        <Stack>
          <MetricCard label="Drawer status" value="Preview" description="No trade, account, or report data loaded." icon={<PanelsTopLeft aria-hidden="true" />} />
          <EmptyState
            title="Drawer content placeholder"
            description="Future phases can mount trade details, filters, or settings here."
          />
        </Stack>
      </Drawer>
    </>
  )
}
