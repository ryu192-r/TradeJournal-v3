import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'

interface GlassTagInputProps {
  label?: string
  error?: string
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export function GlassTagInput({
  label,
  error,
  value,
  onChange,
  placeholder = 'Add tag...',
  maxTags = 10,
}: GlassTagInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    if (value.includes(trimmed)) return
    if (value.length >= maxTags) return
    onChange([...value, trimmed])
    setInput('')
  }

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          {label}
        </label>
      )}
      <div
        className={cn(
          'min-h-[2.5rem] rounded-lg border border-border-strong bg-bg-card/60 px-3 py-1.5 text-sm',
          'focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20',
          'transition-all duration-hover ease-out',
          'flex flex-wrap gap-2 items-center cursor-text',
          error && 'border-loss/50 focus-within:border-loss/50 focus-within:ring-loss/20'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-accent-faint text-accent px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(tag)
              }}
              className="hover:text-accent-hover cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-text-heading placeholder:text-text-faint text-sm py-0.5"
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-loss">{error}</p>
      )}
      <div className="text-[10px] text-text-muted mt-1">
        {value.length}/{maxTags} tags
      </div>
    </div>
  )
}
