import { Badge, Card } from '@/new-ui'
import type { ReactNode } from 'react'

interface V3PreviewSectionProps {
  title: string
  body: string
  phase: string
  icon?: ReactNode
}

export function V3PreviewSection({ title, body, phase, icon }: V3PreviewSectionProps) {
  return (
    <Card className="tjv3-preview-card" variant="elevated">
      <div className="tjv3-preview-card__top">
        <div>
          <h3 className="tjv3-preview-card__title">{title}</h3>
          <p className="tjv3-preview-card__copy">{body}</p>
        </div>
        {icon}
      </div>
      <Badge variant="accent">{phase}</Badge>
    </Card>
  )
}
