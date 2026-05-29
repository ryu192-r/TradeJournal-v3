export type ChartTimeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w'
export type ChartRange = 'auto' | '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y'
export type ChartSource = 'auto' | 'cache' | 'tapetide' | 'dhan' | 'mock'

export interface ChartCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}

export interface ChartMarker {
  time: number
  position: 'aboveBar' | 'belowBar'
  shape: 'arrowUp' | 'arrowDown' | 'circle'
  color: string
  text: string
}

export interface ChartPriceLine {
  price: number
  title: string
  color: string
}

export interface ChartAnnotations {
  entry_time: string | null
  exit_time: string | null
  partial_exits: {
    exit_time: string | null
    qty: string
    exit_price: string
    realized_pnl: string | null
  }[]
}

export interface ChartMeta {
  has_real_data: boolean
  is_mock: boolean
  message: string | null
}

export interface TradeChartData {
  trade_id: number
  symbol: string
  timeframe: ChartTimeframe
  range: ChartRange
  source: string
  candles: ChartCandle[]
  markers: ChartMarker[]
  price_lines: ChartPriceLine[]
  annotations: ChartAnnotations
  meta: ChartMeta
}