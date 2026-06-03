import { useState } from 'react'
import { Badge, Button, DataList, DataRow, Stack, Value } from '@/new-ui'
import { User, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { SettingsSectionCard } from './SettingsSectionCard'

export function AccountSettingsPanel() {
  const { user, logout } = useAuthStore()
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <SettingsSectionCard
      title="Account"
      description="Your profile and session. Email and name are sourced from /auth/me; profile editing is not implemented yet."
      icon={<User size={16} aria-hidden="true" />}
      action={
        user ? (
          <Button size="sm" variant="danger" onClick={handleLogout} disabled={signingOut}>
            <LogOut size={14} aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        ) : null
      }
    >
      {user ? (
        <DataList>
          <DataRow title="Email" trailing={<Value value={user.email} />} />
          <DataRow
            title="Name"
            trailing={<Value value={user.full_name?.trim() ? user.full_name : 'Not set'} />}
          />
          <DataRow
            title="Status"
            trailing={
              <Badge variant={user.is_active ? 'success' : 'neutral'}>
                {user.is_active ? 'Active' : 'Inactive'}
              </Badge>
            }
          />
          <DataRow
            title="Profile editing"
            subtitle="Edit name/email is not exposed by the backend yet."
            trailing={<Value value="Read-only" />}
          />
        </DataList>
      ) : (
        <Stack gap="sm">
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
            No profile loaded. Sign in to view account details.
          </p>
        </Stack>
      )}
    </SettingsSectionCard>
  )
}
