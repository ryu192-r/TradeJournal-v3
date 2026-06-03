import { DataList, DataRow, Value } from '@/new-ui'
import { Database } from 'lucide-react'
import { SettingsSectionCard } from './SettingsSectionCard'

export function SystemStatusPanel() {
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api/v1'

  return (
    <SettingsSectionCard
      title="System"
      description="Read-only build and connection info."
      icon={<Database size={16} aria-hidden="true" />}
    >
      <DataList>
        <DataRow title="API base URL" trailing={<Value value={apiUrl} />} />
        <DataRow title="UI version" trailing={<Value value="v3.0" />} />
        <DataRow
          title="Auth"
          subtitle="JWT (access + refresh) stored in browser localStorage. Refresh handled by axios interceptor."
          trailing={<Value value="Active" />}
        />
      </DataList>
    </SettingsSectionCard>
  )
}
