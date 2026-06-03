import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface PageProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function Page({ title, subtitle, actions, className, children, ...props }: PageProps) {
  return (
    <main className={cn('tjv3-page', className)} {...props}>
      {(title || subtitle || actions) && (
        <header className="tjv3-page__header">
          <div>
            {title && <h1 className="tjv3-page__title">{title}</h1>}
            {subtitle && <p className="tjv3-page__subtitle">{subtitle}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </header>
      )}
      {children}
    </main>
  )
}
