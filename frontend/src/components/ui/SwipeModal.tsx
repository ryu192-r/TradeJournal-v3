import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SwipeModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function SwipeModal({ open, onClose, children }: SwipeModalProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`
              bg-bg-card border border-border w-full overflow-y-auto overscroll-contain
              ${isMobile
                ? 'fixed bottom-0 left-0 right-0 rounded-t-2xl max-h-[92vh] touch-pan-y'
                : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl w-[94vw] max-w-[540px] sm:max-w-[620px] md:max-w-[720px] max-h-[88vh] shadow-2xl'
              }
            `}
            initial={{ opacity: 0, y: isMobile ? 300 : 40, scale: isMobile ? 1 : 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? 300 : 0, scale: isMobile ? 1 : 0.96 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1 sticky top-0 z-10 bg-bg-card">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
            )}
            {!isMobile && (
              <div className="sticky top-0 z-10 flex justify-end p-3 pb-0">
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <div className={isMobile ? 'px-4 pb-8' : 'px-5 pb-6'}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}