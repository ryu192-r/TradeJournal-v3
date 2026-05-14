export interface AiConfigResponse {
  provider: string
  base_url: string
  api_key: string | null
  model: string
  timeout: number
  max_retries: number
  temperature: number
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
}

export interface TestResponse {
  status: string
  model?: string
  response?: string
  error?: string
}
