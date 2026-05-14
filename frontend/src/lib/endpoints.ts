// API endpoint definitions — single source of truth for every backend call
import apiClient from '@/lib/api'
import type { ApiTrade, ApiTradeListResponse, BackendTradeStatus } from '@/types'
import type { DailyJournal, DailyJournalPayload } from '@/types'
import type { FullDashboardPayload, CapitalDashboardPayload } from '@/types'
import type {
  SetupPlaybookItem, SetupPlaybookListResponse,
  SetupPlaybookCreatePayload, SetupPlaybookUpdatePayload,
} from '@/types/setupPlaybook'
import type {
  TradeIdeaItem, TradeIdeaListResponse,
  TradeIdeaCreatePayload, TradeIdeaUpdatePayload,
  ConvertToTradePayload, ConvertToTradeResponse, TradeIdeaStatus,
} from '@/types/tradeIdea'
import type { AiConfigResponse, AIProviderInfo, AiConfigSaveRequest, TestResponse } from '@/types/ai'

// ────────────────────────── Trades ──────────────────────────

interface ListTradesParams {
  status?: BackendTradeStatus
  symbol?: string
  skip?: number
  limit?: number
}

export function listTrades(params?: ListTradesParams) {
  const { status, symbol, skip = 0, limit = 100 } = params ?? {}
  const searchParams = new URLSearchParams()
  if (status) searchParams.append('status', status)
  if (symbol) searchParams.append('symbol', symbol)
  searchParams.append('skip', String(skip))
  searchParams.append('limit', String(limit))
  return apiClient.get<ApiTradeListResponse>(`/trades/?${searchParams.toString()}`).then(r => r.data)
}

export function getTrade(id: number) {
  return apiClient.get<ApiTrade>(`/trades/${id}`).then(r => r.data)
}

export function createTrade(payload: Record<string, unknown>) {
  return apiClient.post<ApiTrade>('/trades/', payload).then(r => r.data)
}

export function updateTrade(id: number, payload: Record<string, unknown>) {
  return apiClient.put<ApiTrade>(`/trades/${id}`, payload).then(r => r.data)
}

// ────────────────────────── Journal ──────────────────────────

export function getJournal(date: string) {
  return apiClient.get<DailyJournal>(`/journal/${date}`).then(r => r.data)
}

export function getWeeklyJournals(weekStart: string) {
  return apiClient.get<DailyJournal[]>('/journal/weekly', { params: { week_start: weekStart } }).then(r => r.data)
}

export function createJournal(payload: DailyJournalPayload) {
  return apiClient.post<DailyJournal>('/journal/', payload).then(r => r.data)
}

export function updateJournal(date: string, payload: DailyJournalPayload) {
  return apiClient.put<DailyJournal>(`/journal/${date}`, payload).then(r => r.data)
}

// ────────────────────────── Analytics ──────────────────────────

export function getDashboard(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<FullDashboardPayload>('/analytics/dashboard' + (qs ? `?${qs}` : '')).then(r => r.data)
}

// ────────────────────────── Setups ──────────────────────────

export function listSetups(is_active?: string) {
  const params = new URLSearchParams()
  if (is_active) params.append('is_active', is_active)
  const qs = params.toString()
  return apiClient.get<SetupPlaybookListResponse>('/setups/' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getSetup(id: number) {
  return apiClient.get<SetupPlaybookItem>(`/setups/${id}`).then(r => r.data)
}

export function createSetup(payload: SetupPlaybookCreatePayload) {
  return apiClient.post<SetupPlaybookItem>('/setups/', payload).then(r => r.data)
}

export function updateSetup(id: number, payload: SetupPlaybookUpdatePayload) {
  return apiClient.put<SetupPlaybookItem>(`/setups/${id}`, payload).then(r => r.data)
}

export async function archiveSetup(id: number): Promise<void> {
  await apiClient.delete(`/setups/${id}`)
}

export function seedSetups() {
  return apiClient.post<SetupPlaybookListResponse>('/setups/seed').then(r => r.data)
}

// ────────────────────────── Ideas ──────────────────────────

export function listIdeas(status?: TradeIdeaStatus, symbol?: string, direction?: string, confidence?: string) {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (symbol) params.append('symbol', symbol)
  if (direction) params.append('direction', direction)
  if (confidence) params.append('confidence', confidence)
  const qs = params.toString()
  return apiClient.get<TradeIdeaListResponse>('/ideas/' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getIdea(id: number) {
  return apiClient.get<TradeIdeaItem>(`/ideas/${id}`).then(r => r.data)
}

export function createIdea(payload: TradeIdeaCreatePayload) {
  return apiClient.post<TradeIdeaItem>('/ideas/', payload).then(r => r.data)
}

export function updateIdea(id: number, payload: TradeIdeaUpdatePayload) {
  return apiClient.put<TradeIdeaItem>(`/ideas/${id}`, payload).then(r => r.data)
}

export async function deleteIdea(id: number): Promise<void> {
  await apiClient.delete(`/ideas/${id}`)
}

export function convertIdeaToTrade(id: number, payload: ConvertToTradePayload) {
  return apiClient.post<ConvertToTradeResponse>(`/ideas/${id}/trade`, payload).then(r => r.data)
}

// ────────────────────────── AI ──────────────────────────

export function getAiConfig() {
  return apiClient.get<AiConfigResponse>('/ai/config').then(r => r.data)
}

export function getAiProviders() {
  return apiClient.get<Record<string, AIProviderInfo>>('/ai/providers').then(r => r.data)
}

export function saveAiConfig(config: AiConfigSaveRequest) {
  return apiClient.put<AiConfigResponse>('/ai/config', config).then(r => r.data)
}

// ───────────────────────── Capital Dashboard ─────────────────────────

export function getCapitalDashboard() {
  return apiClient.get<CapitalDashboardPayload>('/accounts/capital-dashboard').then(r => r.data)
}

export function testAiConnection() {
  return apiClient.post<TestResponse>('/ai/test').then(r => r.data)
}
