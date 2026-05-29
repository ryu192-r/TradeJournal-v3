import { CardSkeleton, MetricSkeleton, SectionSkeleton } from '@/components/ui/StateComponents'

interface LoadingStateProps {
  variant?: 'page' | 'cards' | 'skeleton'
  cards?: number
}

export function LoadingState({ variant = 'page', cards = 3 }: LoadingStateProps) {
  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-[var(--page-gap)] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <CardSkeleton key={index} height="h-32" />
        ))}
      </div>
    )
  }

  if (variant === 'skeleton') {
    return <SectionSkeleton rows={5} />
  }

  return (
    <div className="space-y-[var(--page-gap)]">
      <div className="grid grid-cols-1 gap-[var(--page-gap)] sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </div>
      <CardSkeleton height="h-56" />
      <CardSkeleton height="h-56" />
    </div>
  )
}

