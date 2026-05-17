import { useCallback, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

interface SwipeModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function SwipeModal({ open, onClose, children }: SwipeModalProps) {
  const y = useMotionValue(0)
  const [exiting, setExiting] = useState(false)

  const handleDragEnd = useCallback((_: any, info: any) => {
    if (info.offset.y > 100) {
      setExiting(true)
      animate(y, 600, { duration: 0.2, ease: 'easeIn' }).then(() => {
        onClose()
        setExiting(false)
        y.set(0)
      })
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 })
    }
  }, [onClose, y])

  if (!open && !exiting) return null

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ y }}
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-4 -mt-2">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
