import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface NavItemProps {
  label: ReactNode
  icon?: ReactNode
  active?: boolean
  disabled?: boolean
  badge?: ReactNode
  href?: string
  onClick?: () => void
  className?: string
}

export function NavItem({
  label,
  icon,
  active = false,
  disabled = false,
  badge,
  href,
  onClick,
  className,
}: NavItemProps) {
  const content = (
    <>
      {icon && <span className="tjv3-nav-item__icon">{icon}</span>}
      <span className="tjv3-nav-item__label">{label}</span>
      {badge && <span className="tjv3-nav-item__badge">{badge}</span>}
    </>
  )

  const classes = cn('tjv3-nav-item', active && 'tjv3-nav-item--active', className)

  if (href) {
    return (
      <a
        className={classes}
        href={disabled ? undefined : href}
        aria-current={active ? 'page' : undefined}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault()
            return
          }
          onClick?.()
        }}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={classes}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {content}
    </button>
  )
}
