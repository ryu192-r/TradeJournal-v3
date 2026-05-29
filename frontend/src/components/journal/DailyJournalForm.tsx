import { useState, useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'
import {
  Star,
  CheckCircle2,
  Sun,
  Moon,
  TrendingUp,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import type { DailyJournal } from '@/types'
import { formatCurrency } from '@/utils/format'

const schema = z.object({
  preTradeNotes: z.string().max(5000).optional(),
  postTradeNotes: z.string().max(5000).optional(),
  tradeCount: z.number().min(0).optional(),
  moodRating: z.number().min(1).max(5).nullable().optional(),
  disciplineRating: z.number().min(1).max(5).nullable().optional(),
  moodNotes: z.string().max(1000).optional(),
  rulesFollowed: z.string().max(500).optional(),
  rulesViolated: z.string().max(500).optional(),
  lessonsLearned: z.string().max(3000).optional(),
})

type FormData = z.infer<typeof schema>

const inputCls =
  'w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed'

const STEPS = [
  { id: 0, label: 'Plan', icon: Sun },
  { id: 1, label: 'Reflect', icon: Moon },
  { id: 2, label: 'Summary', icon: TrendingUp },
] as const

// ---------------------------------------------------------------------------
// Mood rating widget
// ---------------------------------------------------------------------------

function MoodRating({
  value,
  onChange,
  error,
  label = 'Mood rating',
}: {
  value: number | null
  onChange: (val: number | null) => void
  error?: string
  label?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-text-muted mb-1.5">
        {label}
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
                'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold transition-all',
                index < current
                  ? 'bg-profit text-black'
                  : index === current
                    ? 'bg-accent-muted text-accent ring-2 ring-accent/50'
                    : 'bg-bg-elevated text-text-muted'
              )}
            >
              {index < current ? (
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <span
              className={cn(
                'mt-1 sm:mt-2 text-[10px] sm:text-xs',
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
                'flex-1 h-[2px] mx-2 sm:mx-4',
                index < current ? 'bg-profit' : 'bg-border'
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

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: journal
      ? {
          preTradeNotes: journal.pre_trade_notes ?? '',
          postTradeNotes: journal.post_trade_notes ?? '',
          tradeCount: journal.trade_count ?? undefined,
          moodRating: journal.mood_rating,
          disciplineRating: journal.discipline_rating,
          moodNotes: journal.mood_notes ?? '',
          rulesFollowed: journal.rules_followed ?? '',
          rulesViolated: journal.rules_violated ?? '',
          lessonsLearned: journal.lessons_learned ?? '',
        }
      : {
          preTradeNotes: '',
          postTradeNotes: '',
          tradeCount: summaryStats?.tradeCount ?? undefined,
          moodRating: null,
          disciplineRating: null,
          moodNotes: '',
          rulesFollowed: '',
          rulesViolated: '',
          lessonsLearned: '',
        },
  })

  useEffect(() => {
    reset(
      journal
        ? {
            preTradeNotes: journal.pre_trade_notes ?? '',
            postTradeNotes: journal.post_trade_notes ?? '',
            tradeCount: journal.trade_count ?? undefined,
            moodRating: journal.mood_rating,
            disciplineRating: journal.discipline_rating,
            moodNotes: journal.mood_notes ?? '',
            rulesFollowed: journal.rules_followed ?? '',
            rulesViolated: journal.rules_violated ?? '',
            lessonsLearned: journal.lessons_learned ?? '',
          }
        : {
            preTradeNotes: '',
            postTradeNotes: '',
            tradeCount: summaryStats?.tradeCount ?? undefined,
            moodRating: null,
            disciplineRating: null,
            moodNotes: '',
            rulesFollowed: '',
            rulesViolated: '',
            lessonsLearned: '',
          }
    )
  }, [journal, date, summaryStats?.tradeCount, reset])

  const onSubmit = (data: FormData) => {
    const payload: import('@/types').DailyJournalPayload = {
      date,
      pre_trade_notes: data.preTradeNotes?.trim() || null,
      post_trade_notes: data.postTradeNotes?.trim() || null,
      mood_rating: data.moodRating ?? null,
      discipline_rating: data.disciplineRating ?? null,
      mood_notes: data.moodNotes?.trim() || null,
      rules_followed: data.rulesFollowed != null ? String(data.rulesFollowed) : null,
      rules_violated: data.rulesViolated != null ? String(data.rulesViolated) : null,
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
      <div className="w-full">
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Market context, key levels, and today&apos;s plan
        </label>
        <textarea
          rows={10}
          placeholder="e.g. Nifty facing resistance at 23,500. Plan: only EP setups above pivot. No revenge trading if stopped out early."
          className={cn(inputCls, 'min-h-[10rem] resize-y')}
          {...register('preTradeNotes')}
        />
        {errors.preTradeNotes?.message && (
          <p className="mt-1 text-xs text-loss">{errors.preTradeNotes.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-bg-elevated/30 border border-border p-3 space-y-3">
          <label className="text-xs font-medium text-text-muted">
            Expected trade count
          </label>
          <Controller
            name="tradeCount"
            control={control}
            render={({ field }) => (
              <input
                type="number"
                min={0}
                placeholder="e.g. 3"
                className={cn(inputCls, 'w-full')}
                {...field}
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? undefined : Number(e.target.value)
                  )
                }
              />
            )}
          />
        </div>

        <div className="rounded-xl bg-bg-elevated/30 border border-border p-3 space-y-3">
          <Controller
            name="moodRating"
            control={control}
            render={({ field }) => (
              <MoodRating
                value={field.value ?? null}
                onChange={(val) => field.onChange(val)}
                label="Mood"
              />
            )}
          />
          <textarea
            rows={2}
            placeholder="Why this mood? (optional)"
            className={cn(inputCls, 'min-h-[2rem] resize-y')}
            {...register('moodNotes')}
          />
          {errors.moodNotes?.message && (
            <p className="mt-1 text-xs text-loss">{errors.moodNotes.message}</p>
          )}
        </div>
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
      <div className="w-full">
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          What actually happened today?
        </label>
        <textarea
          rows={8}
          placeholder="e.g. Took 2 trades. First was clean EP on RELIANCE, +1.2R. Second was emotional Reversal entry, stopped out -1R."
          className={cn(inputCls, 'min-h-[8rem] resize-y')}
          {...register('postTradeNotes')}
        />
        {errors.postTradeNotes?.message && (
          <p className="mt-1 text-xs text-loss">{errors.postTradeNotes.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-bg-elevated/30 border border-border p-3 space-y-3">
          <label className="text-xs font-medium text-text-heading flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-profit" />
            Rules followed
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Stopped out cleanly on INFY, waited for pullback on TCS"
            className={cn(inputCls, 'min-h-[2rem] resize-y')}
            {...register('rulesFollowed')}
          />
          {errors.rulesFollowed?.message && (
            <p className="mt-1 text-xs text-loss">{errors.rulesFollowed.message}</p>
          )}

          <label className="text-xs font-medium text-text-heading flex items-center gap-2">
            Rules violated
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Entered before 9:30, moved stop on RELIANCE"
            className={cn(inputCls, 'min-h-[2rem] resize-y')}
            {...register('rulesViolated')}
          />
          {errors.rulesViolated?.message && (
            <p className="mt-1 text-xs text-loss">{errors.rulesViolated.message}</p>
          )}
        </div>

        <div className="rounded-xl bg-bg-elevated/30 border border-border p-3 space-y-2">
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
        </div>

        <div className="rounded-xl bg-bg-elevated/30 border border-border p-3 space-y-2">
          <Controller
            name="disciplineRating"
            control={control}
            render={({ field }) => (
              <MoodRating
                value={field.value ?? null}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
          <p className="text-[10px] text-text-muted mt-1">Discipline — how well did you follow your rules?</p>
        </div>
      </div>

      <div className="w-full">
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Lessons learned
        </label>
        <textarea
          rows={4}
          placeholder="One thing you&apos;ll do differently tomorrow..."
          className={cn(inputCls, 'min-h-[4rem] resize-y')}
          {...register('lessonsLearned')}
        />
        {errors.lessonsLearned?.message && (
          <p className="mt-1 text-xs text-loss">{errors.lessonsLearned.message}</p>
        )}
      </div>
    </div>
  )

  // -------------------------------------------------------------------------
  // Step 2: PnL Summary (read-only, auto-filled)
  // -------------------------------------------------------------------------

  const renderSummary = () => {
    const totalPnl = summaryStats?.totalPnl ?? 0
    const isProfit = totalPnl >= 0

    const statCards = [
      { label: 'Trades taken', value: summaryStats?.tradeCount ?? 0, color: 'text-text-heading' },
      { label: 'Total P&L', value: `${isProfit ? '+' : ''}${formatCurrency(totalPnl)}`, color: isProfit ? 'text-profit' : 'text-loss' },
      { label: 'Win rate', value: `${summaryStats?.winRate ?? 0}%`, color: 'text-text-heading' },
      { label: 'Avg R-multiple', value: `${summaryStats?.avgR ?? 0}R`, color: 'text-text-heading' },
    ]

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-text-heading">
          <TrendingUp className="w-4 h-4 text-accent" />
          Today&apos;s P&L Summary
          <span className="text-text-muted text-xs font-normal ml-1">
            (auto-filled from trades)
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <div
              key={i}
              className="rounded-xl bg-bg-elevated/30 border border-border p-3 text-center"
            >
              <div className="text-xs text-text-muted mb-1">{s.label}</div>
              <div className={cn('text-xl font-bold font-data', s.color)}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-bg-elevated/30 border border-dashed border-border p-3">
          <p className="text-xs text-text-muted leading-relaxed">
            These stats are computed automatically from trades tagged with today&apos;s date.
            Trades with P&amp;L within ± the breakeven threshold (configurable in Capital page)
            are classified as breakeven — not wins or losses.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Pre-market notes (review)', key: 'preTradeNotes' },
            { label: 'Post-market notes (review)', key: 'postTradeNotes' },
            { label: 'Lessons learned (review)', key: 'lessonsLearned' },
          ].map((item) => {
            const current = watch(item.key as keyof FormData) as string | undefined
            return (
              <div key={item.key}>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  {item.label}
                </label>
                <textarea
                  rows={4}
                  readOnly
                  className={cn(inputCls, 'min-h-[4rem] resize-y bg-bg-elevated/20')}
                  value={current || ''}
                  onChange={() => {}}
                />
              </div>
            )
          })}
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

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-6">
        {step === 0 && renderPreMarket()}
        {step === 1 && renderPostMarket()}
        {step === 2 && renderSummary()}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="text-xs text-text-muted">
          {isDirty ? 'Unsaved changes' : journal ? 'All changes saved' : 'New entry'}
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          {!isLastStep && (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {isLastStep && (
            <button
              type="submit"
              disabled={isSaving || !isDirty}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save Entry
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
