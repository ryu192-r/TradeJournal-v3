import { useState, useRef, useCallback } from 'react'
import { Loader2, ArrowDown } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

const THRESHOLD = 80

export function PullToRefresh({ onRefresh, children, disabled, className }: PullToRefreshProps) {
  const [state, setState] = useState<'idle' | 'pulling' | 'refreshing'>('idle')
  const startY = useRef(0)
  const pullY = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const isScrolled = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || state === 'refreshing') return
    startY.current = e.touches[0].clientY
    pullY.current = 0
    isScrolled.current = e.currentTarget.scrollTop > 0
  }, [disabled, state])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || state === 'refreshing') return
    if (isScrolled.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) return
    pullY.current = dy
    const translateY = Math.min(dy * 0.4, 100)
    if (contentRef.current) {
      contentRef.current.style.transform = `translateY(${translateY}px)`
    }
    setState(dy > THRESHOLD ? 'pulling' : 'idle')
  }, [disabled, state])

  const handleTouchEnd = useCallback(async () => {
    if (disabled || state === 'refreshing') return
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.3s ease'
      contentRef.current.style.transform = 'translateY(0)'
    }
    if (pullY.current > THRESHOLD) {
      setState('refreshing')
      try {
        await onRefresh()
      } finally {
        setState('idle')
        if (contentRef.current) {
          contentRef.current.style.transition = ''
        }
      }
    } else {
      setState('idle')
    }
    pullY.current = 0
  }, [disabled, state, onRefresh])

  return (
    <div className={`relative overflow-auto overscroll-none ${className ?? ''}`}>
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center pointer-events-none"
        style={{
          height: state === 'refreshing' ? 48 : 0,
          transition: 'height 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {state === 'refreshing' ? (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
            Refreshing...
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <ArrowDown className={`w-4 h-4 transition-transform ${state === 'pulling' ? 'rotate-180' : ''}`} />
            {state === 'pulling' ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        )}
      </div>

      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="will-change-transform"
      >
        {children}
      </div>
    </div>
  )
}
