export interface AiConfigResponse {
  provider: string
  base_url: string
  has_api_key: boolean
  model: string
  timeout: number
  max_retries: number
  temperature: number
  personality: Record<string, number> | null
}

export interface AIProviderInfo {
  label: string
  default_url: string
  needs_api_key: boolean
  models: string[]
  api_format?: string
}

export interface AiConfigSaveRequest {
  provider: string
  base_url: string
  api_key?: string | null
  model: string
  timeout: number
  max_retries: number
  temperature: number
  personality?: Record<string, number>
}

export interface TestResponse {
  status: string
  model?: string
  response?: string
  error?: string
}

export interface MentorInfo {
  key: string
  name: string
  description: string
}
