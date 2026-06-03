import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function Section({ title, description, action, className, children, ...props }: SectionProps) {
  return (
    <section className={cn('tjv3-section', className)} {...props}>
      {(title || description || action) && (
        <header className="tjv3-section__header">
          <div>
            {title && <h2 className="tjv3-section__title">{title}</h2>}
            {description && <p className="tjv3-section__description">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
