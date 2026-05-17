import { useRef, useCallback } from 'react'

interface UseRowGesturesOptions {
  onDoubleTap: () => void
  onSwipeRight?: () => void
  onLongPress?: () => void
  disabled?: boolean
}

export function useRowGestures({ onDoubleTap, onSwipeRight, onLongPress, disabled }: UseRowGesturesOptions) {
  const lastTap = useRef(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const longPressTimer = useRef<number | undefined>(undefined)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    if (onLongPress) {
      longPressTimer.current = window.setTimeout(() => onLongPress(), 600)
    }
  }, [disabled, onLongPress])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = undefined
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = undefined
    }

    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current

    // Swipe right
    if (dx > 80 && Math.abs(dy) < 30) {
      onSwipeRight?.()
      return
    }

    // Double tap (only if not a swipe)
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
      const now = Date.now()
      if (now - lastTap.current < 300) {
        onDoubleTap()
        lastTap.current = 0
        return
      }
      lastTap.current = now
    }
  }, [disabled, onDoubleTap, onSwipeRight])

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  }
}
