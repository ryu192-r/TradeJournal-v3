import { useState } from 'react'
import { useCreateEmotionLogMutation } from '@/hooks/useEmotionLogQuery'
import type { EmotionType } from '@/types'

const EMOTIONS: { value: EmotionType; label: string; emoji: string }[] = [
  { value: 'calm', label: 'Calm', emoji: '😌' },
  { value: 'disciplined', label: 'Disciplined', emoji: '💪' },
  { value: 'fomo', label: 'FOMO', emoji: '😤' },
  { value: 'fearful', label: 'Fearful', emoji: '😰' },
  { value: 'hesitant', label: 'Hesitant', emoji: '🤔' },
  { value: 'euphoric', label: 'Euphoric', emoji: '🤩' },
  { value: 'revenge', label: 'Revenge', emoji: '😡' },
]

interface EmotionLoggerProps {
  tradeId: number
  onClose: () => void
}

function SliderField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">{label}</span>
        <span className="text-[11px] font-data text-text-heading">{value ?? '—'}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value ?? 5}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(null)}
        className="w-full h-1.5 rounded-full appearance-none bg-border accent-accent cursor-pointer"
      />
      <div className="flex justify-between text-[9px] text-text-muted/50 px-0.5">
        <span>1</span><span>5</span><span>10</span>
      </div>
    </div>
  )
}

export function EmotionLogger({ tradeId, onClose }: EmotionLoggerProps) {
  const [emotion, setEmotion] = useState<EmotionType | ''>('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [stress, setStress] = useState<number | null>(null)
  const [conviction, setConviction] = useState<number | null>(null)
  const [patience, setPatience] = useState<number | null>(null)
  const [focus, setFocus] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const createMutation = useCreateEmotionLogMutation()

  const handleSubmit = () => {
    if (!emotion) return
    createMutation.mutate({
      tradeId,
      payload: {
        emotion,
        confidence,
        stress,
        conviction,
        patience,
        focus,
        note: note || null,
        timestamp: new Date().toISOString(),
      },
    }, { onSuccess: onClose })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {EMOTIONS.map((e) => (
          <button
            key={e.value}
            onClick={() => setEmotion(e.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${emotion === e.value ? 'border-accent bg-accent-faint text-accent' : 'border-border text-text-muted hover:text-text-heading hover:border-text-muted'}`}
          >
            <span className="mr-1">{e.emoji}</span>{e.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <SliderField label="Confidence" value={confidence} onChange={setConfidence} />
        <SliderField label="Stress" value={stress} onChange={setStress} />
        <SliderField label="Conviction" value={conviction} onChange={setConviction} />
        <SliderField label="Patience" value={patience} onChange={setPatience} />
        <SliderField label="Focus" value={focus} onChange={setFocus} />
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note..."
        className="w-full text-xs border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-none"
        rows={2}
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-heading transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!emotion || createMutation.isPending}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
        >
          {createMutation.isPending ? 'Saving...' : 'Log Emotion'}
        </button>
      </div>
    </div>
  )
}