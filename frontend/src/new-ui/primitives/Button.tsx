import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('tjv3-button', `tjv3-button--${variant}`, `tjv3-button--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  )
}
