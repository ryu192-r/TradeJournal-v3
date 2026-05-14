// Chart gallery for a trade review: TV screenshots + OHLC chart placeholder
import { ImageOff, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface ChartGalleryProps {
  chartImages?: string[]
}

export function ChartGallery({ chartImages }: ChartGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const hasImages = chartImages && chartImages.length > 0
  // Build a gallery of existing images + one auto-chart placeholder
  const slides: { type: 'image'; src: string }[] =
    hasImages
      ? (chartImages as string[]).map((src) => ({ type: 'image' as const, src }))
      : []
  slides.push({ type: 'image', src: '' }) // placeholder slot for auto-chart

  const totalSlides = slides.length
  const current = slides[activeIndex]

  const goPrev = () => setActiveIndex((i) => (i > 0 ? i - 1 : totalSlides - 1))
  const goNext = () => setActiveIndex((i) => (i < totalSlides - 1 ? i + 1 : 0))

  return (
    <div className="space-y-2">
      <div className="relative aspect-video rounded-lg overflow-hidden bg-bg-elevated/50 border border-border">
        {current && current.type === 'image' && current.src ? (
          <img
            src={current.src}
            alt="Trade chart"
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted">
            <div className="w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-accent" />
            </div>
            <div className="text-xs text-center space-y-1">
              <p>Auto-generated OHLC chart</p>
              <p className="text-text-muted/60">Placeholder — requires backend chart service</p>
            </div>
          </div>
        )}

        {totalSlides > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-bg-card/80 backdrop-blur-sm border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-text" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-bg-card/80 backdrop-blur-sm border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-text" />
            </button>
          </>
        )}

        {totalSlides > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-hover ${
                  idx === activeIndex ? 'bg-accent w-3' : 'bg-text-muted/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {!hasImages && (
        <div className="flex items-center gap-2 text-[11px] text-text-muted/60">
          <ImageOff className="w-3 h-3" />
          No TradingView screenshot uploaded
        </div>
      )}
    </div>
  )
}
