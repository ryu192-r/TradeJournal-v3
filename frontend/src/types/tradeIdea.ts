// Trade Idea types — mirror of backend Pydantic schemas
// Backend serializes Decimal prices to strings

export type TradeIdeaStatus = 'draft' | 'active' | 'traded' | 'archived'
export type TradeIdeaDirection = 'LONG' | 'SHORT'
export type TradeIdeaConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TradeIdeaItem {
  id: number
  symbol: string
  direction: TradeIdeaDirection
  entry_price_target: string | null
  stop_price: string | null
  target_price: string | null
  thesis: string | null
  timeframe: string | null
  confidence: TradeIdeaConfidence | null
  tags: string | null
  revisit_date: string | null
  status: TradeIdeaStatus
  traded_trade_id: number | null
  triggered_at: string | null
  created_at: string
  updated_at: string
}

export interface TradeIdeaListResponse {
  total: number
  items: TradeIdeaItem[]
}

export interface TradeIdeaCreatePayload {
  symbol: string
  direction: TradeIdeaDirection
  entry_price_target?: string | null
  stop_price?: string | null
  target_price?: string | null
  thesis?: string | null
  timeframe?: string | null
  confidence?: TradeIdeaConfidence | null
  tags?: string | null
  revisit_date?: string | null
  status?: TradeIdeaStatus
}

export interface TradeIdeaUpdatePayload {
  symbol?: string | null
  direction?: TradeIdeaDirection | null
  entry_price_target?: string | null
  stop_price?: string | null
  target_price?: string | null
  thesis?: string | null
  timeframe?: string | null
  confidence?: TradeIdeaConfidence | null
  tags?: string | null
  revisit_date?: string | null
  status?: TradeIdeaStatus | null
}

export interface ConvertToTradePayload {
  entry_price?: string | null
  exit_price?: string | null
  quantity?: string | null
  fees?: string | null
  notes?: string | null
}

export interface ConvertToTradeResponse {
  idea: TradeIdeaItem
  trade_id: number | null
}
