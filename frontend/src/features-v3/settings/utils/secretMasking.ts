/**
 * Display-side secret masking helpers. The backend never returns API keys;
 * these utilities only render placeholder text describing whether a secret
 * is configured, never the secret itself.
 */

const PLACEHOLDER_STORED = '••••••••'
const PLACEHOLDER_NONE = 'Not configured'

export interface MaskedSecretDisplay {
  /** Text safe to render in the UI. Never contains the real secret. */
  displayText: string
  /** Whether the backend reports a secret is currently stored. */
  hasSecret: boolean
}

export function describeStoredSecret(hasSecret: boolean): MaskedSecretDisplay {
  return {
    displayText: hasSecret ? PLACEHOLDER_STORED : PLACEHOLDER_NONE,
    hasSecret,
  }
}

/**
 * Defensive masking — if a secret value somehow makes it into the frontend,
 * never display more than a short prefix/suffix preview, and never the
 * middle of the value. Used as a safety net only.
 */
export function maskApiKeyForDisplay(value: string | null | undefined): string {
  if (!value) return PLACEHOLDER_NONE
  const trimmed = value.trim()
  if (!trimmed) return PLACEHOLDER_NONE
  if (trimmed.length <= 8) return PLACEHOLDER_STORED
  const prefix = trimmed.slice(0, 4)
  const suffix = trimmed.slice(-2)
  return `${prefix}••••${suffix}`
}
