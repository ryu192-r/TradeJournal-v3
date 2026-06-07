import { useEffect, useState } from 'react'
import {
  useJournalQuery,
  useCreateJournalMutation,
  useUpdateJournalMutation,
} from '@/hooks/useJournalMutation'
import type { DailyJournal, DailyJournalPayload } from '@/types'

export interface JournalFormState {
  pre_trade_notes: string
  bias_notes: string
  post_trade_notes: string
  mood_rating: number | null
  rules_followed: string
  rules_violated: string
  lessons_learned: string
}

function fromJournal(j: DailyJournal | null): JournalFormState {
  return {
    pre_trade_notes: j?.pre_trade_notes ?? '',
    bias_notes: j?.bias_notes ?? '',
    post_trade_notes: j?.post_trade_notes ?? '',
    mood_rating: j?.mood_rating ?? null,
    rules_followed: j?.rules_followed ?? '',
    rules_violated: j?.rules_violated ?? '',
    lessons_learned: j?.lessons_learned ?? '',
  }
}

export interface UseJournalEditor {
  form: JournalFormState
  setField: <K extends keyof JournalFormState>(key: K, value: JournalFormState[K]) => void
  isLoading: boolean
  isSaving: boolean
  isExisting: boolean
  isDirty: boolean
  saveError: Error | null
  save: () => void
}

export function useJournalEditor(date: string): UseJournalEditor {
  const query = useJournalQuery(date)
  const createMut = useCreateJournalMutation()
  const updateMut = useUpdateJournalMutation()

  const [form, setForm] = useState<JournalFormState>(() => fromJournal(query.data ?? null))
  const [baseline, setBaseline] = useState<JournalFormState>(form)

  // Reload form when the date changes or data arrives.
  useEffect(() => {
    if (query.isLoading) return
    const next = fromJournal(query.data ?? null)
    setForm(next)
    setBaseline(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, query.isLoading, query.data])

  const setField: UseJournalEditor['setField'] = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const isExisting = query.data != null
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline)

  const save = () => {
    const payload: DailyJournalPayload = {
      date,
      pre_trade_notes: form.pre_trade_notes || null,
      bias_notes: form.bias_notes || null,
      post_trade_notes: form.post_trade_notes || null,
      mood_rating: form.mood_rating,
      rules_followed: form.rules_followed || null,
      rules_violated: form.rules_violated || null,
      lessons_learned: form.lessons_learned || null,
    }
    if (isExisting) {
      updateMut.mutate(
        { date, payload },
        { onSuccess: () => setBaseline(form) },
      )
    } else {
      createMut.mutate(payload, { onSuccess: () => setBaseline(form) })
    }
  }

  return {
    form,
    setField,
    isLoading: query.isLoading,
    isSaving: createMut.isPending || updateMut.isPending,
    isExisting,
    isDirty,
    saveError: (createMut.error as Error | null) ?? (updateMut.error as Error | null) ?? null,
    save,
  }
}
