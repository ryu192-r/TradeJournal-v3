import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface AppCanvasProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function AppCanvas({ className, children, ...props }: AppCanvasProps) {
  return (
    <div className={cn('tjv3-ui tjv3-app-canvas', className)} {...props}>
      <div className="tjv3-app-canvas__inner">{children}</div>
    </div>
  )
}
