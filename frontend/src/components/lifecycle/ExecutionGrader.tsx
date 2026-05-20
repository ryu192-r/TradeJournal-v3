import { useState, useEffect } from 'react'
import { useExecutionGradeQuery, useCreateExecutionGradeMutation, useUpdateExecutionGradeMutation } from '@/hooks/useExecutionGradeQuery'
import type { GradeLetter } from '@/types'

const GRADES: GradeLetter[] = ['A', 'B', 'C', 'D', 'F']

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  B: 'text-emerald-300 border-emerald-300/40 bg-emerald-300/10',
  C: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
  D: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
  F: 'text-red-400 border-red-400/40 bg-red-400/10',
}

const CATEGORIES: { key: keyof ExecutionGradeFields; label: string }[] = [
  { key: 'entry_quality', label: 'Entry' },
  { key: 'sizing_quality', label: 'Sizing' },
  { key: 'stop_quality', label: 'Stop' },
  { key: 'patience', label: 'Patience' },
  { key: 'rule_adherence', label: 'Rules' },
  { key: 'exit_quality', label: 'Exit' },
]

interface ExecutionGradeFields {
  entry_quality: GradeLetter | null
  sizing_quality: GradeLetter | null
  stop_quality: GradeLetter | null
  patience: GradeLetter | null
  rule_adherence: GradeLetter | null
  exit_quality: GradeLetter | null
  overall_grade: GradeLetter | null
  notes: string
}

interface ExecutionGraderProps {
  tradeId: number
}

export function ExecutionGrader({ tradeId }: ExecutionGraderProps) {
  const { data: existingGrade } = useExecutionGradeQuery(tradeId)
  const createMutation = useCreateExecutionGradeMutation()
  const updateMutation = useUpdateExecutionGradeMutation()

  const [fields, setFields] = useState<ExecutionGradeFields>({
    entry_quality: null,
    sizing_quality: null,
    stop_quality: null,
    patience: null,
    rule_adherence: null,
    exit_quality: null,
    overall_grade: null,
    notes: '',
  })

  useEffect(() => {
    if (existingGrade) {
      setFields({
        entry_quality: existingGrade.entry_quality ?? null,
        sizing_quality: existingGrade.sizing_quality ?? null,
        stop_quality: existingGrade.stop_quality ?? null,
        patience: existingGrade.patience ?? null,
        rule_adherence: existingGrade.rule_adherence ?? null,
        exit_quality: existingGrade.exit_quality ?? null,
        overall_grade: existingGrade.overall_grade ?? null,
        notes: existingGrade.notes ?? '',
      })
    }
  }, [existingGrade])

  const isExisting = !!existingGrade
  const mutation = isExisting ? updateMutation : createMutation
  const isPending = mutation.isPending

  const handleGrade = (key: keyof ExecutionGradeFields, grade: GradeLetter | null) => {
    setFields((prev) => ({ ...prev, [key]: prev[key] === grade ? null : grade }))
  }

  const handleSubmit = () => {
    const payload = {
      entry_quality: fields.entry_quality,
      sizing_quality: fields.sizing_quality,
      stop_quality: fields.stop_quality,
      patience: fields.patience,
      rule_adherence: fields.rule_adherence,
      exit_quality: fields.exit_quality,
      overall_grade: fields.overall_grade,
      notes: fields.notes || null,
    }
    if (isExisting) {
      updateMutation.mutate({ tradeId, payload })
    } else {
      createMutation.mutate({ tradeId, payload })
    }
  }

  return (
    <div className="space-y-3">
      {CATEGORIES.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="text-[length:var(--text-sm)] text-text-muted w-14 shrink-0">{label}</span>
          <div className="flex gap-1.5">
            {GRADES.map((g) => (
              <button
                key={g}
                onClick={() => handleGrade(key, g)}
                className={`w-7 h-7 text-xs font-semibold rounded border transition-all cursor-pointer ${fields[key] === g ? GRADE_COLORS[g] : 'border-border text-text-muted hover:border-text-muted'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
        <span className="text-[length:var(--text-sm)] font-medium text-text-heading">Overall</span>
        <div className="flex gap-1.5">
          {GRADES.map((g) => (
            <button
              key={g}
              onClick={() => handleGrade('overall_grade', g)}
              className={`w-8 h-8 text-sm font-bold rounded border transition-all cursor-pointer ${fields.overall_grade === g ? GRADE_COLORS[g] : 'border-border text-text-muted hover:border-text-muted'}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={fields.notes}
        onChange={(e) => setFields((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="Process notes — what did you do well? What would you change?"
        className="w-full text-sm border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-none"
        rows={2}
      />

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full text-[length:var(--text-sm)] font-medium py-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
      >
        {isPending ? 'Saving...' : isExisting ? 'Update Grade' : 'Save Grade'}
      </button>
    </div>
  )
}