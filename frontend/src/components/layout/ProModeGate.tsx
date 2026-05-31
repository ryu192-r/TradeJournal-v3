import { Sparkles, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { getSimpleFallbackView, interfaceModeLabel, viewLabel } from '@/app/interfaceMode'
import type { ActiveView } from '@/app/navigation'
import { CARD } from '@/components/layout/layoutTokens'
import { PageShell } from '@/components/layout/PageShell'

type ProModeGateProps = {
  view: ActiveView
}

export function ProModeGate({ view }: ProModeGateProps) {
  const setNavMode = useAppStore((s) => s.setNavMode)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const fallback = getSimpleFallbackView(view)

  return (
    <PageShell>
      <div className={`${CARD} max-w-lg mx-auto text-center py-10 px-6`}>
        <div className="w-12 h-12 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-6 h-6 text-accent" />
        </div>
        <h2 className="font-display text-xl text-text-heading">Available in Pro Mode</h2>
        <p className="mt-2 text-[length:var(--text-sm)] text-text-muted leading-relaxed">
          <span className="font-medium text-text-heading">{viewLabel(view)}</span> is part of the power-user
          toolkit. Switch to {interfaceModeLabel('pro')} in Settings → Interface Mode to unlock Edge Lab,
          deep analytics tabs, intelligence widgets, and legacy research views.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setNavMode('pro')}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[length:var(--text-sm)] font-medium text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Enable Pro Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveView(fallback)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[length:var(--text-sm)] font-medium text-text-muted hover:text-text-heading transition-colors cursor-pointer"
          >
            Go to {viewLabel(fallback)}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </PageShell>
  )
}
