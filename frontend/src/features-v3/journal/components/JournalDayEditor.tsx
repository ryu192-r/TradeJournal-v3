import { Badge, Button, LoadingState, Panel, Stack } from '@/new-ui'
import { useJournalEditor, type JournalFormState } from '../hooks/useJournalEditor'

const RATINGS = [1, 2, 3, 4, 5]

interface JournalDayEditorProps {
  date: string
}

export function JournalDayEditor({ date }: JournalDayEditorProps) {
  const editor = useJournalEditor(date)

  if (editor.isLoading) {
    return (
      <Panel title="Journal entry">
        <LoadingState label="Loading entry…" />
      </Panel>
    )
  }

  return (
    <Panel
      title={`Journal — ${date}`}
      description={editor.isExisting ? 'Editing existing entry' : 'New entry'}
      action={
        <Badge variant={editor.isExisting ? 'success' : 'neutral'}>
          {editor.isExisting ? 'Saved' : 'Draft'}
        </Badge>
      }
    >
      <Stack gap="md">
        <TextField
          label="Pre-trade notes"
          value={editor.form.pre_trade_notes}
          onChange={(v) => editor.setField('pre_trade_notes', v)}
        />
        <TextField
          label="Post-trade notes"
          value={editor.form.post_trade_notes}
          onChange={(v) => editor.setField('post_trade_notes', v)}
        />

        <RatingField
          label="Mood"
          value={editor.form.mood_rating}
          onChange={(v) => editor.setField('mood_rating', v)}
        />
        <RatingField
          label="Discipline"
          value={editor.form.discipline_rating}
          onChange={(v) => editor.setField('discipline_rating', v)}
        />

        <TextField
          label="Rules followed"
          value={editor.form.rules_followed}
          onChange={(v) => editor.setField('rules_followed', v)}
        />
        <TextField
          label="Rules violated"
          value={editor.form.rules_violated}
          onChange={(v) => editor.setField('rules_violated', v)}
        />
        <TextField
          label="Lessons learned"
          value={editor.form.lessons_learned}
          onChange={(v) => editor.setField('lessons_learned', v)}
        />

        {editor.saveError && (
          <div className="tjv3-journal__save-error">{editor.saveError.message}</div>
        )}

        <div className="tjv3-journal__editor-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={editor.save}
            disabled={editor.isSaving || !editor.isDirty}
          >
            {editor.isSaving ? 'Saving…' : editor.isExisting ? 'Update entry' : 'Save entry'}
          </Button>
          {editor.isDirty && <span className="tjv3-journal__dirty">Unsaved changes</span>}
        </div>
      </Stack>
    </Panel>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="tjv3-journal__field">
      <span className="tjv3-journal__field-label">{label}</span>
      <textarea
        className="tjv3-journal__textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
    </label>
  )
}

function RatingField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <div className="tjv3-journal__field">
      <span className="tjv3-journal__field-label">{label}</span>
      <div className="tjv3-journal__ratings">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            className={`tjv3-journal__rating${value === r ? ' tjv3-journal__rating--active' : ''}`}
            onClick={() => onChange(value === r ? null : r)}
            aria-pressed={value === r}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

export type { JournalFormState }
