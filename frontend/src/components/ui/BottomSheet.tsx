import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
}

export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[101] bg-bg-card rounded-t-2xl border border-border shadow-xl max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'Bottom sheet'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-8 h-1 rounded-full bg-border" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pb-3 border-b border-border">
                <h3 className="font-display text-base text-text-heading">{title}</h3>
                <button onClick={onClose} className="p-2 min-h-10 min-w-10 rounded-lg text-text-muted hover:text-text-heading transition-colors cursor-pointer" aria-label="Close sheet">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="p-5">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
