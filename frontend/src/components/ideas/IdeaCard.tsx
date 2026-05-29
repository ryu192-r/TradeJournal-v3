// Trade Idea card: display symbol, direction, prices, thesis, tags, status with actions
import { useState } from 'react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassBadge } from '@/components/ui/GlassBadge'
import type { TradeIdeaItem, TradeIdeaStatus } from '@/types/tradeIdea'
import { formatDate } from '@/utils/format'
import {
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Pencil,
  Archive,
  Trash2,
  Target,
  ShieldAlert,
  TrendingUp,
  Tag,
  Calendar,
  Lightbulb,
  RotateCcw,
  Briefcase,
  CheckCircle,
} from 'lucide-react'

interface IdeaCardProps {
  idea: TradeIdeaItem
  onEdit: (id: number) => void
  onArchive: (id: number) => void
  onActivate: (id: number) => void
  onConvert: (id: number) => void
  onRestore?: (id: number) => void
}

const statusConfig: Record<TradeIdeaStatus, { label: string; variant: 'default' | 'profit' | 'loss' | 'accent' | 'muted' }> = {
  draft:   { label: 'Draft',    variant: 'muted' },
  active:  { label: 'Active',   variant: 'accent' },
  traded:  { label: 'Traded',   variant: 'profit' },
  archived:{ label: 'Archived', variant: 'muted' },
}

const confidenceConfig: Record<string, { color: string; label: string }> = {
  LOW:    { color: 'text-text-muted', label: 'Low' },
  MEDIUM: { color: 'text-accent', label: 'Medium' },
  HIGH:   { color: 'text-profit', label: 'High' },
}

export function IdeaCard({ idea, onEdit, onArchive, onActivate, onConvert, onRestore }: IdeaCardProps) {
  const [expanded, setExpanded] = useState(false)

  const status = statusConfig[idea.status]
  const conf = idea.confidence ? confidenceConfig[idea.confidence] : null

  return (
    <GlassCard hover={false} className="overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-base font-semibold text-text-heading">{idea.symbol}</h3>
            <GlassBadge variant={idea.direction === 'LONG' ? 'profit' : 'loss'}>
              <span className="inline-flex items-center gap-0.5">
                {idea.direction === 'LONG' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {idea.direction}
              </span>
            </GlassBadge>
            <GlassBadge variant={status.variant}>{status.label}</GlassBadge>
            {conf && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${conf.color}`}>
                <Lightbulb className="w-3 h-3" />
                {conf.label} Confidence
              </span>
            )}
          </div>

          {/* Price targets */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted mb-1.5">
            {idea.entry_price_target && (
              <span className="inline-flex items-center gap-1">
                <Target className="w-3 h-3 text-accent" />
                Entry: {idea.entry_price_target}
              </span>
            )}
            {idea.stop_price && (
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-loss" />
                Stop: {idea.stop_price}
              </span>
            )}
            {idea.target_price && (
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-profit" />
                Target: {idea.target_price}
              </span>
            )}
            {idea.timeframe && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3 text-text-muted" />
                {idea.timeframe}
              </span>
            )}
          </div>

          {/* Tags */}
          {idea.tags && (
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <Tag className="w-3 h-3 text-text-muted" />
              {idea.tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag, i) => (
                <span key={i} className="text-xs bg-bg-elevated/50 text-text-muted px-1.5 py-0.5 rounded border border-border">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-text-muted">
            Created {formatDate(new Date(idea.created_at))}
            {idea.revisit_date && (
              <span className="ml-2">· Revisit {formatDate(new Date(idea.revisit_date))}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {idea.status === 'draft' && (
            <button
              onClick={() => onActivate(idea.id)}
              className="p-1.5 rounded-md hover:bg-accent-muted text-accent hover:text-accent-hover transition-colors cursor-pointer"
              title="Activate"
              aria-label={`Activate ${idea.symbol} idea`}
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {idea.status === 'active' && (
            <button
              onClick={() => onConvert(idea.id)}
              className="p-1.5 rounded-md hover:bg-profit-muted text-profit hover:text-profit transition-colors cursor-pointer"
              title="Convert to Trade"
              aria-label={`Convert ${idea.symbol} to trade`}
            >
              <Briefcase className="w-4 h-4" />
            </button>
          )}
          {idea.status === 'archived' && onRestore && (
            <button
              onClick={() => onRestore(idea.id)}
              className="p-1.5 rounded-md hover:bg-accent-muted text-accent hover:text-accent-hover transition-colors cursor-pointer"
              title="Restore"
              aria-label={`Restore ${idea.symbol} idea`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(idea.id)}
            className="p-1.5 rounded-md hover:bg-accent-muted text-accent hover:text-accent-hover transition-colors cursor-pointer"
            title="Edit"
            aria-label={`Edit ${idea.symbol} idea`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onArchive(idea.id)}
            className="p-1.5 rounded-md hover:bg-loss-muted text-text-muted hover:text-loss transition-colors cursor-pointer"
            title={idea.status === 'archived' ? 'Delete' : 'Archive'}
            aria-label={idea.status === 'archived' ? `Delete ${idea.symbol} idea` : `Archive ${idea.symbol} idea`}
          >
            {idea.status === 'archived' ? <Trash2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-md hover:bg-bg-elevated/50 text-text-muted hover:text-text transition-colors cursor-pointer"
            title={expanded ? 'Collapse' : 'Expand'}
            aria-label={expanded ? `Collapse ${idea.symbol} card` : `Expand ${idea.symbol} card`}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded thesis */}
      {expanded && idea.thesis && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-sm font-medium text-text-heading mb-2">
            <Lightbulb className="w-4 h-4 text-accent" />
            Thesis
          </div>
          <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">{idea.thesis}</p>
        </div>
      )}

      {expanded && idea.traded_trade_id != null && (
        <div className="mt-3 text-xs text-profit">
          Converted to Trade #{idea.traded_trade_id}
        </div>
      )}
    </GlassCard>
  )
}
