import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'

interface EdgeSwipeProps {
  children: React.ReactNode
  edgeWidth?: number
}

export function EdgeSwipe({ children, edgeWidth = 30 }: EdgeSwipeProps) {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const startX = useRef(0)

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (sidebarOpen) return
      const dx = e.changedTouches[0].clientX - startX.current
      if (startX.current <= edgeWidth && dx > 50) {
        setSidebarOpen(true)
      }
    }

    // Capture phase — catches touch BEFORE React synthetic events
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true })
      document.removeEventListener('touchend', onTouchEnd, { capture: true })
    }
  }, [sidebarOpen, setSidebarOpen, edgeWidth])

  return <>{children}</>
}
