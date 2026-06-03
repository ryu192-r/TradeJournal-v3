import { Badge, DataList, DataRow, Panel, Stack, Value } from '@/new-ui'

export function ImportInstructionsPanel() {
  return (
    <Panel
      title="What happens on import"
      description="The import flow uses the existing stable parser. No business logic changes in V3."
    >
      <Stack gap="md">
        <DataList>
          <DataRow
            title="P&L treatment"
            subtitle="Imported trade P&L is stored gross / pre-charges. Daily charges are tracked separately in Charges Ledger so net P&L stays honest."
            trailing={<Badge variant="info">Gross only</Badge>}
          />
          <DataRow
            title="Duplicate handling"
            subtitle="Rows that already exist in your journal (matched on fingerprint or order ID) are greyed out in preview and skipped on confirm."
            trailing={<Value value="Auto-skip" />}
          />
          <DataRow
            title="Market metadata (C5)"
            subtitle="Zerodha and Dhan parsers map exchange, segment, product type, and executed order count automatically. Generic CSV does not — review metadata after import."
            trailing={<Badge variant="info">Per broker</Badge>}
          />
          <DataRow
            title="Trade lifecycle"
            subtitle="Stop-loss timeline, partial exits, reviews, and AI insights are not contained in broker CSVs and remain user-managed."
            trailing={<Value value="User-managed" />}
          />
        </DataList>

        <p
          style={{
            margin: 0,
            color: 'var(--color-text-muted)',
            fontSize: '0.75rem',
            lineHeight: 1.5,
          }}
        >
          Tip: download the template for your broker first, confirm the column layout matches, then upload. Preview shows you exactly what will change before you commit.
        </p>
      </Stack>
    </Panel>
  )
}
