import { useRef, useCallback, useState, type ReactNode, type TouchEvent } from 'react'
import { Trash2 } from 'lucide-react'

interface SwipeToDeleteProps {
  onDelete: () => void
  children: ReactNode
  disabled?: boolean
}

const SWIPE_THRESHOLD = -80

export function SwipeToDelete({ onDelete, children, disabled }: SwipeToDeleteProps) {
  const startX = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return
    startX.current = e.touches[0].clientX
  }, [disabled])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled) return
    const dx = e.touches[0].clientX - startX.current
    if (dx > 0) return
    contentRef.current!.style.transform = `translateX(${Math.max(dx, -100)}px)`
  }, [disabled])

  const handleTouchEnd = useCallback(() => {
    if (disabled) return
    const el = contentRef.current!
    const x = new DOMMatrix(el.style.transform).m41 || 0

    if (x < SWIPE_THRESHOLD) {
      el.style.transform = 'translateX(-100px)'
      el.style.transition = 'transform 0.2s ease'
      setRevealed(true)
    } else {
      el.style.transform = 'translateX(0)'
      el.style.transition = 'transform 0.2s ease'
      setRevealed(false)
      setTimeout(() => { el.style.transition = '' }, 300)
    }
  }, [disabled])

  const handleDelete = useCallback(() => {
    onDelete()
    setRevealed(false)
  }, [onDelete])

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button behind */}
      {revealed && (
        <button
          onClick={handleDelete}
          className="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-center gap-1.5 bg-loss text-white text-xs font-medium cursor-pointer"
          style={{ borderRadius: '0.75rem' }}
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      )}
      <div
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="will-change-transform bg-bg-card"
      >
        {children}
      </div>
    </div>
  )
}
