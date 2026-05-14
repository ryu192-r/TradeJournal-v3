// Archive confirmation dialog
import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  isPending?: boolean
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  isPending,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmModalProps) {
  if (!open) return null

  const btnGhost =
    'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#a8a39a] hover:text-[#e8e5df] hover:bg-[rgba(201,122,63,.07)] transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const btnPrimary =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#c97a3f] text-white hover:bg-[#d9915a] transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const btnDanger =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#f87171] text-white hover:bg-[#f87171]/20 transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#181c2a] rounded-2xl border border-[rgba(255,255,255,.06)] p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[rgba(248,113,113,.15)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#f87171]" />
          </div>
          <h3 className="font-display text-lg text-[#e8e5df]">{title}</h3>
        </div>
        <p className="text-sm text-[#6e685e] mb-6">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button className={btnGhost} onClick={onCancel} disabled={isPending}>Cancel</button>
          <button
            className={danger ? btnDanger : btnPrimary}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
