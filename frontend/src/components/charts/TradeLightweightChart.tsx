import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType, CrosshairMode } from 'lightweight-charts'
import { useQuery } from '@tanstack/react-query'
import { getTradeChartData } from '@/lib/endpoints'
import type { ChartTimeframe, ChartRange, ChartSource, TradeChartData } from '@/types/chart'
import type { ApiTrade } from '@/types'
import { RefreshCw, Maximize2, Minimize2, BarChart3 } from 'lucide-react'

const TIMEFRAME_OPTIONS: { value: ChartTimeframe; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
]

const RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1d', label: '1D' },
  { value: '5d', label: '5D' },
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
]

const SOURCE_OPTIONS: { value: ChartSource; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'tapetide', label: 'Tapetide' },
  { value: 'cache', label: 'Cache' },
  { value: 'mock', label: 'Mock (dev)' },
]

interface TradeLightweightChartProps {
  trade: ApiTrade
}

export function TradeLightweightChart({ trade }: TradeLightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1d')
  const [range, setRange] = useState<ChartRange>('auto')
  const [source, setSource] = useState<ChartSource>('auto')

  const { data, isLoading, error, refetch } = useQuery<TradeChartData>({
    queryKey: ['chart-data', trade.id, timeframe, range, source],
    queryFn: () => getTradeChartData(trade.id, { timeframe, range, source }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const candles = useMemo(() => data?.candles ?? [], [data])
  const markers = useMemo(() => data?.markers ?? [], [data])
  const priceLines = useMemo(() => data?.price_lines ?? [], [data])
  const meta = data?.meta
  const hasNoData = !isLoading && (candles.length === 0 || (meta != null && !meta.has_real_data && !meta.is_mock))

  const isDark = useMemo(() => {
    if (typeof document === 'undefined') return true
    return document.documentElement.getAttribute('data-theme') !== 'light'
  }, [])

  // Chart render effect — all hooks declared unconditionally
  useEffect(() => {
    if (!containerRef.current) return
    if (candles.length === 0 && !meta?.is_mock) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      candleSeriesRef.current = null
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#0f1117' : '#ffffff' },
        textColor: isDark ? '#9ca3af' : '#6b7280',
      },
      grid: {
        vertLines: { color: isDark ? '#1f2937' : '#f3f4f6' },
        horzLines: { color: isDark ? '#1f2937' : '#f3f4f6' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: isDark ? '#374151' : '#e5e7eb' },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e5e7eb',
        timeVisible: timeframe !== '1d',
      },
      width: containerRef.current.clientWidth,
      height: isFullscreen ? window.innerHeight - 120 : 360,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
    })

    const hasVolume = candles.some(c => c.volume != null)
    let volumeSeries: ISeriesApi<'Histogram'> | null = null
    if (hasVolume) {
      volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      })
      chart.priceScale('volume').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      })
    }

    chartRef.current = chart
    candleSeriesRef.current = candleSeries

    // Set candle data
    const candleData: CandlestickData<Time>[] = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    candleSeries.setData(candleData)

    if (volumeSeries) {
      const volumeData = candles
        .filter(c => c.volume != null)
        .map(c => ({
          time: c.time as Time,
          value: c.volume!,
          color: c.close >= c.open ? 'rgba(22, 163, 74, 0.3)' : 'rgba(220, 38, 38, 0.3)',
        }))
      volumeSeries.setData(volumeData)
    }

    // Markers — use createSeriesMarkers for v5 compat
    if (markers.length > 0) {
      const markerData = markers.map(m => ({
        time: m.time as Time,
        position: m.position as 'aboveBar' | 'belowBar',
        shape: m.shape as 'arrowUp' | 'arrowDown' | 'circle',
        color: m.color,
        text: m.text,
      }))
      try {
        createSeriesMarkers(candleSeries, markerData)
      } catch {
        // Fallback: markers absent, chart functional
      }
    }

    // Price lines
    priceLines.forEach(pl => {
      candleSeries.createPriceLine({
        price: pl.price,
        color: pl.color,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: pl.title,
      })
    })

    if (candleData.length > 0) {
      chart.timeScale().fitContent()
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        candleSeriesRef.current = null
      }
    }
  }, [candles, markers, priceLines, isDark, isFullscreen, timeframe])

  // Resize observer — always declared
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (chartRef.current) {
          chartRef.current.applyOptions({
            width: entry.contentRect.width,
            height: isFullscreen ? window.innerHeight - 120 : 360,
          })
        }
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [isFullscreen])

  // All hooks above — conditional returns only below this line

  // Controls bar — rendered in both empty and data states
  const controlsBar = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        {TIMEFRAME_OPTIONS.map(tf => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`px-2 py-1 text-[length:var(--text-xs)] rounded-md transition-colors ${
              timeframe === tf.value
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-text-muted hover:text-text hover:bg-border'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-1">
        {RANGE_OPTIONS.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value as ChartRange)}
            className={`px-2 py-1 text-[length:var(--text-xs)] rounded-md transition-colors ${
              range === r.value
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-text-muted hover:text-text hover:bg-border'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-1">
        {SOURCE_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={`px-2 py-1 text-[length:var(--text-xs)] rounded-md transition-colors ${
              source === s.value
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-text-muted hover:text-text hover:bg-border'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <button
        onClick={() => refetch()}
        className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
        title="Refresh"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-border transition-colors"
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  )

  // Error state
  if (error) {
    return (
      <div className="flex flex-col gap-2">
        {controlsBar}
        <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-3">
          <BarChart3 className="w-10 h-10 opacity-40" />
          <p className="text-sm">Failed to load chart data</p>
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Empty state — no real data and not mock
  if (hasNoData) {
    const isIntraday = !['1d', '1w'].includes(timeframe)
    return (
      <div className="flex flex-col gap-2">
        {controlsBar}
        <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-3">
          <BarChart3 className="w-10 h-10 opacity-40" />
          <p className="text-sm font-medium text-text-heading">No candle data available</p>
          {isIntraday ? (
            <>
              <p className="text-[length:var(--text-xs)] text-text-muted max-w-xs text-center">
                Intraday candles are not configured yet. Switch to 1D for Tapetide daily charts.
              </p>
              <button
                onClick={() => { setTimeframe('1d'); refetch() }}
                className="text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                Switch to 1D
              </button>
            </>
          ) : (
            <p className="text-[length:var(--text-xs)] text-text-muted max-w-xs text-center">
              {meta?.message || 'No historical data provider is configured yet.'}
            </p>
          )}
          <p className="text-[length:var(--text-xs)] text-text-muted/60">
            Uploaded chart screenshots are still available in the Uploaded Images tab.
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {controlsBar}

      {/* Chart container */}
      <div className={`rounded-xl border border-border overflow-hidden bg-[#0f1117] ${isFullscreen ? 'fixed inset-0 z-50 p-4' : ''}`}>
        {isLoading && !data && (
          <div className="flex items-center justify-center h-[360px] text-text-muted">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
              <span className="text-xs">Loading chart...</span>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ minHeight: isFullscreen ? 'calc(100vh - 120px)' : '360px' }} />
      </div>

      {/* Meta info */}
      {meta && meta.is_mock && (
        <p className="text-[length:var(--text-xs)] text-amber-500/70">Mock data — for development only</p>
      )}
      {meta && meta.has_real_data && (
        <p className="text-[length:var(--text-xs)] text-text-muted">
          Source: {data?.source === 'tapetide' ? 'Tapetide daily OHLCV' : data?.source} &middot; {candles.length} candles
        </p>
      )}
    </div>
  )
}