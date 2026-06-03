import { EmptyState, MoneyValue, Panel, PercentValue } from '@/new-ui'
import type { CockpitSetupSummary } from '../types'

export function SetupIntelligence({ setups }: { setups: CockpitSetupSummary[] }) {
  return (
    <Panel title="Setup Intelligence" description="Setup snapshot from period trades. Open trades excluded from win rate.">
      {setups.length === 0 ? (
        <EmptyState title="No setup data yet" description="Tag trades with setups to unlock strategy intelligence." />
      ) : (
        <div className="tjv3-cockpit__row-list">
          {setups.slice(0, 5).map((setup) => (
            <div key={setup.name} className="tjv3-cockpit__setup-row">
              <div className="tjv3-cockpit__row-top">
                <div className="tjv3-cockpit__symbol">{setup.name}</div>
                <MoneyValue value={setup.grossPnl} tone="auto" />
              </div>
              <div className="tjv3-cockpit__row-bottom">
                <div className="tjv3-cockpit__micro">{setup.tradeCount} trades · {setup.closedCount} closed</div>
                <PercentValue value={setup.winRate} tone="neutral" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
