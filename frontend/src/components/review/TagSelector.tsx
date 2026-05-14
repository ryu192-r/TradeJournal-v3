// Tag selector for post-trade review
import { cn } from '@/lib/utils'
import { GlassBadge } from '@/components/ui/GlassBadge'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

export type ReviewTag =
  | 'entered-too-early'
  | 'broke-stop-rule'
  | 'took-stop-too-quick'
  | 'fomo-trade'
  | 'emotional-decision'
  | string

const DEFAULT_TAGS: ReviewTag[] = [
  'entered-too-early',
  'broke-stop-rule',
  'took-stop-too-quick',
  'fomo-trade',
  'emotional-decision',
]

function tagLabel(tag: ReviewTag): string {
  return tag
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface TagSelectorProps {
  selected: ReviewTag[]
  onChange: (tags: ReviewTag[]) => void
}

export function TagSelector({ selected, onChange }: TagSelectorProps) {
  const [customTag, setCustomTag] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const toggleTag = (tag: ReviewTag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag))
    } else {
      onChange([...selected, tag])
    }
  }

  const addCustomTag = () => {
    const trimmed = customTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed])
      setCustomTag('')
      setShowCustom(false)
    }
  }

  const removeTag = (tag: ReviewTag) => {
    onChange(selected.filter((t) => t !== tag))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {DEFAULT_TAGS.map((tag) => {
          const active = selected.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'transition-all duration-hover ease-out cursor-pointer',
                active ? 'opacity-100' : 'opacity-60 hover:opacity-80'
              )}
            >
              <GlassBadge
                variant={active ? 'loss' : 'muted'}
                size="sm"
              >
                {tagLabel(tag)}
              </GlassBadge>
            </button>
          )
        })}

        {selected
          .filter((tag) => !DEFAULT_TAGS.includes(tag))
          .map((tag) => (
            <button
              key={tag}
              onClick={() => removeTag(tag)}
              className="group inline-flex items-center gap-1 transition-opacity duration-hover cursor-pointer"
            >
            <GlassBadge variant="accent" size="sm">
              {tagLabel(tag) as string}
              <X className="w-3 h-3 ml-1 opacity-70 group-hover:opacity-100" />
            </GlassBadge>
            </button>
          ))}

        {!showCustom ? (
          <button
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border border-border text-text-muted hover:text-text hover:bg-bg-elevated/40 transition-all duration-hover cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Custom
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustomTag()
                if (e.key === 'Escape') setShowCustom(false)
              }}
              placeholder="Add tag..."
              className="px-2 py-0.5 text-xs rounded-md bg-bg-elevated border border-border text-text-heading focus:border-accent focus:outline-none w-28"
            />
            <button
              onClick={addCustomTag}
              disabled={!customTag.trim()}
              className="p-1 rounded-md hover:bg-bg-elevated text-accent disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
