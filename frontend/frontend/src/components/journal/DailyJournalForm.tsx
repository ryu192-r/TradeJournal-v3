import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { GlassInput } from '@/components/ui/GlassInput'
import {
  Star,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  TrendingUp,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import type { DailyJournal } from '@/types'
import { formatCurrency } from '@/utils/format'

// ---------------------------------------------------------------------------
// Inline schema (kept here so the component is self-contained)
// ---------------------------------------------------------------------------

const schema = z.object({
  preTradeNotes: z.string().max(5000).optional(),
  postTradeNotes: z.string().max(5000).optional(),
  tradeCount: z.number().min(0).optional(),
  moodRating: z.number().min(1).max(5).nullable().optional(),
  moodNotes: z.string().max(1000).optional(),
  rulesFollowed: z.boolean().optional(),
  rulesViolated: z.boolean().optional(),
  lessonsLearned: z.string().max(3000).optional(),
})

type FormData = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Step labels
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 0, label: 'Pre-market', icon: Sun },
  { id: 1, label: 'Post-market', icon: Moon },
  { id: 2, label: 'Summary', icon: TrendingUp },
] as const

// ---------------------------------------------------------------------------
// Mood rating widget
// ---------------------------------------------------------------------------

function MoodRating({
  value,
  onChange,
  error,
}: {
  value: number | null
  onChange: (val: number | null) => void
  error?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-text-muted mb-1.5">
        Mood rating
      </label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer transition-transform duration-150 hover:scale-110"
          >
            <Star
              className={
                n <= display
                  ? 'w-5 h-5 text-accent fill-accent'
                  : 'w-5 h-5 text-text-muted'
              }
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-text-muted">
          {value ? `${value}/5` : 'Not rated'}
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-loss">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step indicators (horizontal progress dots)
// ---------------------------------------------------------------------------

function StepIndicators({
  current,
  labels,
}: {
  current: number
  labels: readonly string[]
}) {
  return (
    <div className="flex items-center justify-between">
      {labels.map((label, index) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all',
                index < current
                  ? 'bg-emerald-500 text-white'
                  : index === current
                    ? 'bg-accent-muted text-accent ring-2 ring-accent/50'
                    : 'bg-white/5 text-text-muted'
              )}
            >
              {index < current ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span
              className={cn(
                'mt-2 text-xs',
                index === current
                  ? 'text-accent font-medium'
                  : 'text-text-muted'
              )}
            >
              {label}
            </span>
          </div>
          {index < labels.length - 1 && (
            <div
              className={cn(
                'flex-1 h-[2px] mx-4',
                index < current ? 'bg-emerald-500' : 'bg-white/10'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DailyJournalFormProps {
  journal: DailyJournal | null | undefined
  date: string
  onSave: (payload: import('@/types').DailyJournalPayload) => void
  isSaving: boolean
  summaryStats?: {
    tradeCount: number
    totalPnl: number
    winRate: number
    avgR: number
  } | null
}

// ---------------------------------------------------------------------------
// Helper: coerce DB string booleans to real booleans
// ---------------------------------------------------------------------------

function coerceBool(val: unknown): boolean | undefined {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  if (typeof val === 'number') return val !== 0
  return undefined
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailyJournalForm({
  journal,
  date,
  onSave,
  isSaving,
  summaryStats,
}: DailyJournalFormProps) {
  const [step, setStep] = useState(0)

  const defaults: FormData = journal
    ? {
        preTradeNotes: journal.pre_trade_notes ?? '',
        postTradeNotes: journal.post_trade_notes ?? '',
        tradeCount: journal.trade_count ?? undefined,
        moodRating: journal.mood_rating,
        moodNotes: journal.mood_notes ?? '',
        rulesFollowed: coerceBool(journal.rules_followed) ?? true,
        rulesViolated: coerceBool(journal.rules_violated) ?? false,
        lessonsLearned: journal.lessons_learned ?? '',
      }
    : {
        preTradeNotes: '',
        postTradeNotes: '',
        tradeCount: summaryStats?.tradeCount ?? undefined,
        moodRating: null,
        moodNotes: '',
        rulesFollowed: true,
        rulesViolated: false,
        lessonsLearned: '',
      }

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  })

  const onSubmit = (data: FormData) => {
    const payload: import('@/types').DailyJournalPayload = {
      date,
      pre_trade_notes: data.preTradeNotes?.trim() || null,
      post_trade_notes: data.postTradeNotes?.trim() || null,
      trade_count: data.tradeCount ?? null,
      mood_rating: data.moodRating ?? null,
      mood_notes: data.moodNotes?.trim() || null,
      rules_followed: data.rulesFollowed ?? null,
      rules_violated: data.rulesViolated ?? null,
      lessons_learned: data.lessonsLearned?.trim() || null,
    }
    onSave(payload)
  }

  const isLastStep = step === STEPS.length - 1

  // -------------------------------------------------------------------------
  // Step 0: Pre-market
  // -------------------------------------------------------------------------

  const renderPreMarket = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-text-heading">
        <Sun className="w-4 h-4 text-accent" />
        Pre-market plan
      </div>
      <GlassTextarea
        label="Market context, key levels, and today's plan"
        rows={10}
        placeholder="e.g. Nifty facing resistance at 23,500. Plan: only EP setups above pivot. No revenge trading if stopped out early."
        error={errors.preTradeNotes?.message}
        {...register('preTradeNotes')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard padding="sm" className="space-y-3 bg-bg-elevated/30">
          <label className="text-xs font-medium text-text-muted">
            Expected trade count
          </label>
          <Controller
            name="tradeCount"
            control={control}
            render={({ field }) => (
              <GlassInput
                type="number"
                min={0}
                placeholder="e.g. 3"
                className="w-full"
                error={errors.tradeCount?.message}
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
              />
            )}
          />
        </GlassCard>

        <GlassCard padding="sm" className="space-y-3 bg-bg-elevated/30">
          <Controller
            name="moodRating"
            control={control}
            render={({ field }) => (
              <MoodRating
                value={field.value ?? null}
                onChange={(val) => field.onChange(val)}
                error={errors.moodRating?.message}
              />
            )}
          />
          <GlassTextarea
            rows={2}
            placeholder="Why this mood? (optional)"
            error={errors.moodNotes?.message}
            {...register('moodNotes')}
          />
        </GlassCard>
      </div>
    </div>
  )

  // -------------------------------------------------------------------------
  // Step 1: Post-market
  // -------------------------------------------------------------------------

  const renderPostMarket = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-text-heading">
        <Moon className="w-4 h-4 text-accent" />
        Post-market reflection
      </div>
      <GlassTextarea
        label="What actually happened today?"
        rows={8}
        placeholder="e.g. Took 2 trades. First was clean EP on RELIANCE, +1.2R. Second was emotional Reversal entry, stopped out -1R."
        error={errors.postTradeNotes?.message}
        {...register('postTradeNotes')}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GlassCard padding="sm" className="space-y-3">
          <Controller
            name="rulesFollowed"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border-strong bg-bg-card/50 text-accent focus:ring-accent/20"
                  checked={field.value ?? true}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <span className="text-sm text-text-heading">Rules followed today</span>
                <CheckCircle2 className="w-4 h-4 text-profit ml-auto" />
              </label>
            )}
          />
          <Controller
            name="rulesViolated"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border-strong bg-bg-card/50 text-loss focus:ring-loss/20"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <span className="text-sm text-text-heading">Rules violated today</span>
                <XCircle className="w-4 h-4 text-loss ml-auto" />
              </label>
            )}
          />
        </GlassCard>

        <GlassCard padding="sm" className="space-y-2">
          <Controller
            name="moodRating"
            control={control}
            render={({ field }) => (
              <MoodRating
                value={field.value ?? null}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
        </GlassCard>
      </div>

      <GlassTextarea
        label="Lessons learned"
        rows={4}
        placeholder="One thing you'll do differently tomorrow..."
        error={errors.lessonsLearned?.message}
        {...register('lessonsLearned')}
      />
    </div>
  )

  // -------------------------------------------------------------------------
  // Step 2: PnL Summary (read-only, auto-filled)
  // -------------------------------------------------------------------------

  const renderSummary = () => {
    const totalPnl = summaryStats?.totalPnl ?? 0
    const isProfit = totalPnl >= 0

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-text-heading">
          <TrendingUp className="w-4 h-4 text-accent" />
          Today's P&amp;L Summary
          <span className="text-text-muted text-xs font-normal ml-1">
            (auto-filled from trades)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard padding="sm" className="text-center">
            <div className="text-xs text-text-muted mb-1">Trades taken</div>
            <div className="text-xl font-bold text-text-heading">
              {summaryStats?.tradeCount ?? 0}
            </div>
          </GlassCard>
          <GlassCard
            padding="sm"
            className={cn(
              'text-center',
              isProfit ? 'border-profit/20' : 'border-loss/20'
            )}
          >
            <div className="text-xs text-text-muted mb-1">Total P&amp;L</div>
            <div
              className={cn(
                'text-xl font-bold',
                isProfit ? 'text-profit' : 'text-loss'
              )}
            >
              {isProfit ? '+' : ''}
              {formatCurrency(totalPnl)}
            </div>
          </GlassCard>
          <GlassCard padding="sm" className="text-center">
            <div className="text-xs text-text-muted mb-1">Win rate</div>
            <div className="text-xl font-bold text-text-heading">
              {summaryStats?.winRate ?? 0}%
            </div>
          </GlassCard>
          <GlassCard padding="sm" className="text-center">
            <div className="text-xs text-text-muted mb-1">Avg R-multiple</div>
            <div className="text-xl font-bold text-text-heading">
              {summaryStats?.avgR ?? 0}R
            </div>
          </GlassCard>
        </div>

        <GlassCard padding="sm" className="bg-bg-elevated/30 border-dashed border-border">
          <p className="text-xs text-text-muted leading-relaxed">
            These stats are computed automatically from trades tagged with today's date.
            They update when you add, edit, or remove trades. The journal entry itself
            stores only your subjective notes and self-assessment.
          </p>
        </GlassCard>

        <div className="space-y-3">
          <GlassTextarea
            label="Pre-market notes (review)"
            rows={4}
            readOnly
            className="bg-bg-elevated/20"
            value={watch('preTradeNotes') || ''}
            onChange={() => {}}
          />
          <GlassTextarea
            label="Post-market notes (review)"
            rows={4}
            readOnly
            className="bg-bg-elevated/20"
            value={watch('postTradeNotes') || ''}
            onChange={() => {}}
          />
          <GlassTextarea
            label="Lessons learned (review)"
            rows={3}
            readOnly
            className="bg-bg-elevated/20"
            value={watch('lessonsLearned') || ''}
            onChange={() => {}}
          />
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <StepIndicators
        current={step}
        labels={STEPS.map((s) => s.label)}
      />

      <GlassCard className="space-y-6">
        {step === 0 && renderPreMarket()}
        {step === 1 && renderPostMarket()}
        {step === 2 && renderSummary()}
      </GlassCard>

      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted">
          {isDirty ? 'Unsaved changes' : journal ? 'All changes saved' : 'New entry'}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </GlassButton>
          )}
          {!isLastStep && (
            <GlassButton
              type="button"
              onClick={() => setStep((s) => s + 1)}
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </GlassButton>
          )}
          {isLastStep && (
            <GlassButton
              type="submit"
              variant="accent"
              disabled={isSaving || !isDirty}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save Entry
            </GlassButton>
          )}
        </div>
      </div>
    </form>
  )
}
