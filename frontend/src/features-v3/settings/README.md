# Settings V3 (V9)

V3-native settings workspace. Reuses every existing endpoint (`/auth/me`,
`/ai/config`, `/ai/providers`, `/ai/test`, `/ai/mentors`) with no business
logic changes.

## Sections

- **Account** — read-only profile from `useAuthStore`. Logout button. Profile
  editing is honestly labeled "Read-only" because no edit endpoint is exposed.
- **App preferences** — theme toggle (browser-only) and Simple/Pro interface
  mode.
- **System** — read-only API base URL and UI version.
- **AI provider** — provider, base URL, model, advanced settings, masked API
  key with "Stored key" badge and explicit "Remove on save" checkbox. Backend
  never returns the secret; the input is `type=password` and shows only what
  the user types this session.
- **AI coach personality** — mentor weight sliders, persisted via the same
  `saveAiConfig` payload.
- **Legacy fallback** — link back to the original `SettingsPage` (preserved for
  parity).

## Files

```
SettingsV3Page.tsx
index.ts
components/
  SettingsSectionCard.tsx
  AccountSettingsPanel.tsx
  AppPreferencesPanel.tsx
  SystemStatusPanel.tsx
  AiProviderSettingsPanel.tsx
  AiPersonalityPanel.tsx
  SettingsFallbackPanel.tsx
hooks/
  useAiSettingsState.ts        # encapsulates load/save/test/personality
utils/
  secretMasking.ts             # describeStoredSecret, maskApiKeyForDisplay
__tests__/
  secretMasking.test.ts
  SettingsV3Page.test.tsx
```

## Honesty

- Stored API key shown as `••••••••` badge only — never the actual value.
- Connection test result displayed verbatim from `/ai/test` response — no
  faked OK/error states.
- Profile edit not faked — labeled "Read-only" until backend exposes it.
- No fake provider sync, no fake save success (only flips `Saved` badge after
  PUT actually returns).
