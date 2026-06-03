import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface DataRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
}

export function DataRow({ title, subtitle, meta, leading, trailing, onClick, className, ...props }: DataRowProps) {
  const content = (
    <>
      {leading && <div className="tjv3-data-row__leading">{leading}</div>}
      <div className="tjv3-data-row__main">
        <div className="tjv3-data-row__title">{title}</div>
        {subtitle && <div className="tjv3-data-row__subtitle">{subtitle}</div>}
        {meta && <div className="tjv3-data-row__meta">{meta}</div>}
      </div>
      {trailing && <div className="tjv3-data-row__trailing">{trailing}</div>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={cn('tjv3-data-row', className)} onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <div className={cn('tjv3-data-row', className)} {...props}>
      {content}
    </div>
  )
}
