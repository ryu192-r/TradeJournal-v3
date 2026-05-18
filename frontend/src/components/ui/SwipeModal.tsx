import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SwipeModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function SwipeModal({ open, onClose, children }: SwipeModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm
            flex items-end sm:items-center sm:justify-center
            p-0 sm:p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="
              bg-bg-card border border-border w-full overflow-y-auto overscroll-contain
              rounded-t-2xl sm:rounded-2xl
              max-h-[92vh] sm:max-h-[88vh] md:max-h-[85vh]
              sm:max-w-lg md:max-w-2xl lg:max-w-3xl
              shadow-xl sm:shadow-2xl
            "
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Close button — desktop only */}
            <div className="hidden sm:flex justify-end px-[var(--page-px)] pt-[var(--page-py)]">
              <button
                onClick={onClose}
                className="p-2 -mr-2 -mt-1 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content with fluid padding matching the rest of the app */}
            <div className="px-[var(--page-px)] pb-[var(--page-py)]">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}