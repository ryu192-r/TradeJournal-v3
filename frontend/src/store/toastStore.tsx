import { create } from 'zustand'
import { X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  title?: string
  message: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
}

let toastId = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastId}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    // Auto-dismiss after 4s
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
    return id
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-profit/30 bg-profit-muted text-profit',
  error: 'border-loss/30 bg-loss-muted text-loss',
  warning: 'border-yellow-500/30 bg-yellow-500/15 text-yellow-400',
  info: 'border-accent/30 bg-accent-muted text-accent',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={
            'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-glass backdrop-blur-sm ' +
            variantStyles[toast.variant]
          }
        >
          <div className="flex-1 min-w-0">
            {toast.title && (
              <div className="font-medium text-sm mb-0.5">{toast.title}</div>
            )}
            <div className="text-sm opacity-90">{toast.message}</div>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
