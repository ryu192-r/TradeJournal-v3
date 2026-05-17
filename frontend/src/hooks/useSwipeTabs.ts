import { useRef, useCallback } from 'react'

interface SwipeTabsOptions {
  tabs: string[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export function useSwipeTabs({ tabs, activeTab, onTabChange }: SwipeTabsOptions) {
  const startX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current
    const currentIdx = tabs.indexOf(activeTab)
    if (Math.abs(dx) < 50) return
    if (dx < 0 && currentIdx < tabs.length - 1) {
      onTabChange(tabs[currentIdx + 1])
    } else if (dx > 0 && currentIdx > 0) {
      onTabChange(tabs[currentIdx - 1])
    }
  }, [tabs, activeTab, onTabChange])

  return {
    containerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
    },
  }
}
