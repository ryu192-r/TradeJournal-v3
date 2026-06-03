import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical'
}

export function Divider({ orientation = 'horizontal', className, ...props }: DividerProps) {
  return (
    <hr
      aria-orientation={orientation}
      className={cn('tjv3-divider', `tjv3-divider--${orientation}`, className)}
      {...props}
    />
  )
}
