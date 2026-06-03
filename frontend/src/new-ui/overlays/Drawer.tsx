import { useEffect, useId, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

export type DrawerSide = 'right' | 'left' | 'bottom'

export interface DrawerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  side?: DrawerSide
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
  ...props
}: DrawerProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className={cn('tjv3-drawer', `tjv3-drawer--${side}`)} {...props}>
      <div className="tjv3-drawer__backdrop" aria-hidden="true" onMouseDown={onClose} />
      <div
        className={cn('tjv3-drawer__panel', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="tjv3-drawer__header">
          <div>
            {title && (
              <h2 className="tjv3-drawer__title" id={titleId}>
                {title}
              </h2>
            )}
            {description && (
              <p className="tjv3-drawer__description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button type="button" className="tjv3-drawer__close" aria-label="Close drawer" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="tjv3-drawer__body">{children}</div>
        {footer && <footer className="tjv3-drawer__footer">{footer}</footer>}
      </div>
    </div>
  )
}
