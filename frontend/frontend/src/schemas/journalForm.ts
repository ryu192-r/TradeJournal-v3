import { z } from 'zod'

// ---------------------------------------------------------------------------
// Zod schema for the daily journal multi-step form
// ---------------------------------------------------------------------------

export const dailyJournalFormSchema = z.object({
  preTradeNotes: z.string().max(5000, 'Maximum 5000 characters').optional(),
  postTradeNotes: z.string().max(5000, 'Maximum 5000 characters').optional(),
  tradeCount: z.number().min(0, 'Must be 0 or more').optional(),
  moodRating: z.number().min(1).max(5).nullable().optional(),
  moodNotes: z.string().max(1000, 'Maximum 1000 characters').optional(),
  rulesFollowed: z.string().max(500).optional(),
  rulesViolated: z.string().max(500).optional(),
  lessonsLearned: z.string().max(3000).optional(),
})

export type DailyJournalFormData = z.infer<typeof dailyJournalFormSchema>

// ---------------------------------------------------------------------------
// Convert form values to API payload
// ---------------------------------------------------------------------------

export function formDataToJournalPayload(
  data: DailyJournalFormData,
  date: string
): import('@/types').DailyJournalPayload {
  return {
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
}

// ---------------------------------------------------------------------------
// Hydrate form defaults from existing journal entry
// ---------------------------------------------------------------------------

function coerceBool(val: unknown): boolean | undefined {
  if (typeof val === 'boolean') return val
  if (typeof val === 'string') return val.toLowerCase() === 'true'
  if (typeof val === 'number') return val !== 0
  return undefined
}

export function journalToFormDefaults(
  journal: import('@/types').DailyJournal | null | undefined
): DailyJournalFormData {
  if (!journal) {
    return {
      preTradeNotes: '',
      postTradeNotes: '',
      tradeCount: undefined,
      moodRating: null,
      moodNotes: '',
      rulesFollowed: true,
      rulesViolated: false,
      lessonsLearned: '',
    }
  }
  return {
    preTradeNotes: journal.pre_trade_notes ?? '',
    postTradeNotes: journal.post_trade_notes ?? '',
    tradeCount: journal.trade_count ?? undefined,
    moodRating: journal.mood_rating,
    moodNotes: journal.mood_notes ?? '',
    rulesFollowed: coerceBool(journal.rules_followed) ?? true,
    rulesViolated: coerceBool(journal.rules_violated) ?? false,
    lessonsLearned: journal.lessons_learned ?? '',
  }
}
