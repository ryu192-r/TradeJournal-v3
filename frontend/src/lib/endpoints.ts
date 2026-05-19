// API endpoint definitions — single source of truth for every backend call
import apiClient from '@/lib/api'
import type { ApiTrade, ApiTradeListResponse, BackendTradeStatus } from '@/types'
import type { DailyJournal, DailyJournalPayload } from '@/types'
import type { WeeklyJournalStats } from '@/types'
import type { FullDashboardPayload, CapitalDashboardPayload } from '@/types'
import type { CapitalEvent, CapitalEventType, AccountInfo, BrokerInfo, BrokerImportResult } from '@/types'
import type { RiskDashboardPayload } from '@/types/riskDashboard'
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
import type {
  CoachReviewResponse, CoachReviewListResponse,
  AskCoachRequest, PatternDetectionResponse, RuleReminderResponse,
} from '@/types/coach'

// ────────────────────────── Trades ──────────────────────────

interface ListTradesParams {
  status?: BackendTradeStatus
  symbol?: string
  from_date?: string
  to_date?: string
  skip?: number
  limit?: number
}

export function listTrades(params?: ListTradesParams) {
  const { status, symbol, from_date, to_date, skip = 0, limit = 100 } = params ?? {}
  const searchParams = new URLSearchParams()
  if (status) searchParams.append('status', status)
  if (symbol) searchParams.append('symbol', symbol)
  if (from_date) searchParams.append('from_date', from_date)
  if (to_date) searchParams.append('to_date', to_date)
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

export function deleteTrade(id: number) {
  return apiClient.delete(`/trades/${id}`)
}

export function pyramidTrade(id: number, payload: { entry_price: number; quantity: number; entry_time?: string; fees?: number; stop_price?: number }) {
  return apiClient.post<ApiTrade>(`/trades/${id}/pyramid`, payload).then(r => r.data)
}

export function listStopHistory(tradeId: number) {
  return apiClient.get<import('@/types').StopHistoryListResponse>(`/trades/${tradeId}/stop-history`).then(r => r.data)
}

export function createStopHistory(tradeId: number, payload: import('@/types').StopHistoryCreatePayload) {
  return apiClient.post<import('@/types').StopHistoryEntry>(`/trades/${tradeId}/stop-history`, payload).then(r => r.data)
}

export function uploadChartImage(tradeId: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post<{ url: string; images: string[] }>(`/trades/${tradeId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export function deleteChartImage(tradeId: number, url: string) {
  return apiClient.delete<{ images: string[] }>(`/trades/${tradeId}/images`, { params: { url } }).then(r => r.data)
}

// ────────────────────────── Journal ──────────────────────────

export function getJournal(date: string) {
  return apiClient.get<DailyJournal>(`/journal/${date}`).then(r => r.data)
}

export function getWeeklyJournals(weekStart: string) {
  return apiClient.get<DailyJournal[]>('/journal/weekly', { params: { week_start: weekStart } }).then(r => r.data)
}

export function getWeeklyJournalStats(weekStart: string) {
  return apiClient.get<WeeklyJournalStats>('/journal/weekly-stats', { params: { week_start: weekStart } }).then(r => r.data)
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
  return apiClient.get<{ providers: Record<string, AIProviderInfo> }>('/ai/providers').then(r => r.data.providers)
}

export function saveAiConfig(config: AiConfigSaveRequest) {
  return apiClient.put<AiConfigResponse>('/ai/config', config).then(r => r.data)
}

export function getAiMentors() {
  return apiClient.get<{ mentors: import('@/types/ai').MentorInfo[] }>('/ai/mentors').then(r => r.data.mentors)
}

// ───────────────────────── Capital Dashboard ─────────────────────────

export function getCapitalDashboard() {
  return apiClient.get<CapitalDashboardPayload>('/accounts/capital-dashboard').then(r => r.data)
}

export function getRiskDashboard() {
  return apiClient.get<RiskDashboardPayload>('/risk-dashboard/').then(r => r.data)
}

export function getAccountInfo(accountId: number) {
  return apiClient.get<AccountInfo>(`/accounts/${accountId}`).then(r => r.data)
}

export function updateAccount(accountId: number, payload: { name?: string; broker?: string; account_number?: string; initial_balance?: string; currency?: string; breakeven_threshold?: string }) {
  return apiClient.put<AccountInfo>(`/accounts/${accountId}`, payload).then(r => r.data)
}

// ───────────────────────── Capital Events ─────────────────────────

export function listCapitalEvents(accountId: number, eventType?: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams()
  params.append('account_id', String(accountId))
  if (eventType) params.append('event_type', eventType)
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)
  return apiClient.get<{ total: number; items: CapitalEvent[] }>(`/capital-events/?${params.toString()}`).then(r => r.data)
}

export function createCapitalEvent(payload: { event_type: CapitalEventType; amount: string; timestamp: string; description?: string; account_id: number }) {
  return apiClient.post<CapitalEvent>('/capital-events/', payload).then(r => r.data)
}

export function updateCapitalEvent(eventId: number, payload: { event_type?: CapitalEventType; amount?: string; timestamp?: string; description?: string }) {
  return apiClient.put<CapitalEvent>(`/capital-events/${eventId}`, payload).then(r => r.data)
}

export function deleteCapitalEvent(eventId: number) {
  return apiClient.delete(`/capital-events/${eventId}`).then(() => {})
}

export function reconcileAccount(accountId: number) {
  return apiClient.post<{ account_id: number; delta: string; new_balance: string; event_created: boolean }>(`/capital-events/accounts/${accountId}/reconcile`).then(r => r.data)
}

// ───────────────────────── Tier Config ─────────────────────────

export function getTierConfig() {
  return apiClient.get<{ items: { id?: number; name: string; min_amount: string; max_amount: string | null; sort_order: number }[] }>('/tier-config').then(r => r.data)
}

export function saveTierConfig(tiers: { name: string; min_amount: string; max_amount: string | null; sort_order: number }[]) {
  return apiClient.put<{ items: { id?: number; name: string; min_amount: string; max_amount: string | null; sort_order: number }[] }>('/tier-config', tiers).then(r => r.data)
}

export function testAiConnection() {
  return apiClient.post<TestResponse>('/ai/test').then(r => r.data)
}

// ───────────────────────── Broker Import ─────────────────────────

export function getBrokers() {
  return apiClient.get<{ brokers: BrokerInfo[] }>('/trades/brokers').then(r => r.data)
}

export function getBrokerTemplate(broker: string) {
  return apiClient.get(`/trades/import/template/${broker}`, { responseType: 'blob' }).then(r => r.data)
}

export function importBrokerCsv(broker: string, file: File, dryRun = false) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post<BrokerImportResult>(`/trades/import?broker=${broker}${dryRun ? '&dry_run=true' : ''}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

export function previewBrokerImport(broker: string, file: File) {
  return importBrokerCsv(broker, file, true)
}

export function exportTradesXlsx(from_date?: string, to_date?: string, trade_status?: string) {
  const params = new URLSearchParams()
  if (from_date) params.append('from_date', from_date)
  if (to_date) params.append('to_date', to_date)
  if (trade_status) params.append('trade_status', trade_status)
  const qs = params.toString()
  return apiClient.get(`/export/xlsx${qs ? `?${qs}` : ''}`, { responseType: 'blob' }).then(r => r.data)
}

// ───────────────────────── AI Coach ─────────────────────────

export function generateDailyReview(period_start?: string, period_end?: string) {
  return apiClient.post<CoachReviewResponse>('/coach/review/daily', { period_start, period_end }).then(r => r.data)
}

export function generateWeeklyReview(period_start?: string, period_end?: string) {
  return apiClient.post<CoachReviewResponse>('/coach/review/weekly', { period_start, period_end }).then(r => r.data)
}

export function generateTradeInsight(trade_ids: number[], context?: string) {
  return apiClient.post<CoachReviewResponse>('/coach/insight', { trade_ids, context }).then(r => r.data)
}

export function askCoach(payload: AskCoachRequest) {
  return apiClient.post<CoachReviewResponse>('/coach/ask', payload).then(r => r.data)
}

export function detectPatterns(lookback_days?: number) {
  return apiClient.post<PatternDetectionResponse>('/coach/patterns', { lookback_days }).then(r => r.data)
}

export function checkRuleReminders(lookback_days?: number, rules?: string[]) {
  return apiClient.post<RuleReminderResponse>('/coach/rule-reminders', { lookback_days, rules }).then(r => r.data)
}

export function listCoachReviews(review_type?: string, skip?: number, limit?: number) {
  const params = new URLSearchParams()
  if (review_type) params.append('review_type', review_type)
  if (skip !== undefined) params.append('skip', String(skip))
  if (limit !== undefined) params.append('limit', String(limit))
  const qs = params.toString()
  return apiClient.get<CoachReviewListResponse>(`/coach/reviews${qs ? `?${qs}` : ''}`).then(r => r.data)
}

export function getCoachReview(id: number) {
  return apiClient.get<CoachReviewResponse>(`/coach/reviews/${id}`).then(r => r.data)
}

export function deleteCoachReview(id: number) {
  return apiClient.delete(`/coach/reviews/${id}`).then(() => {})
}

// ───────────────────────── Trade Timeline ─────────────────────────

export function listTimeline(tradeId: number) {
  return apiClient.get<import('@/types').TimelineListResponse>(`/trades/${tradeId}/timeline`).then(r => r.data)
}

export function createTimelineEvent(tradeId: number, payload: import('@/types').TimelineEventCreatePayload) {
  return apiClient.post<import('@/types').TimelineEvent>(`/trades/${tradeId}/timeline`, payload).then(r => r.data)
}

export function deleteTimelineEvent(tradeId: number, eventId: number) {
  return apiClient.delete(`/trades/${tradeId}/timeline/${eventId}`).then(() => {})
}

// ───────────────────────── Partial Exits ─────────────────────────

export function listPartialExits(tradeId: number) {
  return apiClient.get<import('@/types').PartialExitListResponse>(`/trades/${tradeId}/partial-exits`).then(r => r.data)
}

export function createPartialExit(tradeId: number, payload: import('@/types').PartialExitCreatePayload) {
  return apiClient.post<import('@/types').PartialExit>(`/trades/${tradeId}/partial-exits`, payload).then(r => r.data)
}

export function deletePartialExit(tradeId: number, exitId: number) {
  return apiClient.delete(`/trades/${tradeId}/partial-exits/${exitId}`).then(() => {})
}

// ───────────────────────── Emotion Logs ─────────────────────────

export function listEmotionLogs(tradeId: number) {
  return apiClient.get<import('@/types').EmotionLogListResponse>(`/trades/${tradeId}/emotions`).then(r => r.data)
}

export function createEmotionLog(tradeId: number, payload: import('@/types').EmotionLogCreatePayload) {
  return apiClient.post<import('@/types').EmotionLog>(`/trades/${tradeId}/emotions`, payload).then(r => r.data)
}

export function deleteEmotionLog(tradeId: number, logId: number) {
  return apiClient.delete(`/trades/${tradeId}/emotions/${logId}`).then(() => {})
}

// ───────────────────────── Execution Grades ─────────────────────────

export function getExecutionGrade(tradeId: number) {
  return apiClient.get<import('@/types').ExecutionGrade>(`/trades/${tradeId}/execution-grade`).then(r => r.data)
}

export function createExecutionGrade(tradeId: number, payload: import('@/types').ExecutionGradeCreatePayload) {
  return apiClient.post<import('@/types').ExecutionGrade>(`/trades/${tradeId}/execution-grade`, payload).then(r => r.data)
}

export function updateExecutionGrade(tradeId: number, payload: import('@/types').ExecutionGradeUpdatePayload) {
  return apiClient.put<import('@/types').ExecutionGrade>(`/trades/${tradeId}/execution-grade`, payload).then(r => r.data)
}

export function deleteExecutionGrade(tradeId: number) {
  return apiClient.delete(`/trades/${tradeId}/execution-grade`).then(() => {})
}

// ───────────────────────── Lifecycle Analytics ─────────────────────────

export function getEmotionSummary(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').EmotionSummaryResponse>('/lifecycle/emotion-summary' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getGradeSummary(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').GradeSummaryResponse>('/lifecycle/grade-summary' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getBehavioralAnalytics(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').BehavioralAnalyticsResponse>('/lifecycle/behavioral' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getRevengeTrades(fromDate?: string, toDate?: string, hoursWindow?: number) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  if (hoursWindow) params.append('hours_window', String(hoursWindow))
  const qs = params.toString()
  return apiClient.get<import('@/types').RevengeTradesResponse>('/lifecycle/revenge-trades' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getOvertradingDetection(fromDate?: string, toDate?: string, dailyThreshold?: number, weeklyThreshold?: number) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  if (dailyThreshold) params.append('daily_threshold', String(dailyThreshold))
  if (weeklyThreshold) params.append('weekly_threshold', String(weeklyThreshold))
  const qs = params.toString()
  return apiClient.get<import('@/types').OvertradingResponse>('/lifecycle/overtrading' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getEarlyExitAnalysis(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').EarlyExitResponse>('/lifecycle/early-exits' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getDisciplineScore(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').DisciplineScoreResponse>('/lifecycle/discipline-score' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getBehavioralScore(lookbackDays?: number) {
  return apiClient.post<import('@/types').BehavioralScoreResponse>('/coach/behavioral-score', null, {
    params: lookbackDays ? { lookback_days: lookbackDays } : undefined,
  }).then(r => r.data)
}

// ───────────────────────── Trade Review Engine ─────────────────────────

export function generateTradeReview(tradeId: number) {
  return apiClient.post<import('@/types/coach').TradeReviewResponse>('/coach/trade-review', { trade_id: tradeId }).then(r => r.data)
}

// ───────────────────────── Playbook Intelligence ─────────────────────────

export function getPlaybookOverview(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').PlaybookOverviewResponse>('/playbook/intelligence/overview' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getSetupIntelligence(setupName: string, fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').SetupIntelligenceResponse>(`/playbook/intelligence/${encodeURIComponent(setupName)}` + (qs ? `?${qs}` : '')).then(r => r.data)
}

// ───────────────────────── Market Context ─────────────────────────

export function getMarketSnapshots(days?: number) {
  return apiClient.get<import('@/types').MarketSnapshotsResponse>('/market/snapshots', {
    params: days ? { days } : undefined,
  }).then(r => r.data)
}

export function getMarketSnapshot(date: string) {
  return apiClient.get<import('@/types').MarketSnapshotEntry>(`/market/snapshot/${date}`).then(r => r.data)
}

export function saveMarketSnapshot(payload: Record<string, unknown>) {
  return apiClient.post<{ id: number; date: string; message: string }>('/market/snapshot', payload).then(r => r.data)
}

export function fetchMarketData(payload: Record<string, unknown>) {
  return apiClient.post<{ id: number; date: string; message: string }>('/market/fetch', payload).then(r => r.data)
}

export function seedMarketSnapshots(snapshots: Record<string, unknown>[]) {
  return apiClient.post<{ added: number; skipped: number; errors: string[]; total: number }>('/market/seed', { snapshots }).then(r => r.data)
}

export function getMarketPerformanceCorrelation(fromDate?: string, toDate?: string) {
  const params = new URLSearchParams()
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  const qs = params.toString()
  return apiClient.get<import('@/types').MarketPerformanceCorrelation>('/market/performance-correlation' + (qs ? `?${qs}` : '')).then(r => r.data)
}

export function getMarketRegimeSummary(days?: number) {
  return apiClient.get<import('@/types').MarketRegimeSummary>('/market/regime-summary', {
    params: days ? { days } : undefined,
  }).then(r => r.data)
}

export function getMySymbols() {
  return apiClient.get<import('@/types').MySymbolsResponse>('/market/my-symbols').then(r => r.data)
}

export function upsertLiveQuotes(quotes: Record<string, unknown>[]) {
  return apiClient.post<{ upserted: number; errors: string[]; total: number }>('/market/live-quotes', { quotes }).then(r => r.data)
}

export function getLiveQuotes() {
  return apiClient.get<import('@/types').LiveQuotesResponse>('/market/live-quotes').then(r => r.data)
}
