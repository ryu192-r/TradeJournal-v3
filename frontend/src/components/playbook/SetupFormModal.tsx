// Modal form for creating/editing a setup playbook entry
import { useState, useEffect } from 'react'
import type {
  SetupPlaybookItem,
  SetupPlaybookCreatePayload,
  SetupPlaybookUpdatePayload,
  Tactic,
} from '@/types/setupPlaybook'
import { X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface SetupFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: SetupPlaybookCreatePayload | SetupPlaybookUpdatePayload) => void
  setup?: SetupPlaybookItem | null
  isPending?: boolean
}

function emptyTactic(): Tactic {
  return { name: '', win_rate: null, avg_r: null, conditions: [''] }
}

export function SetupFormModal({ open, onClose, onSubmit, setup, isPending }: SetupFormModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tactics, setTactics] = useState<Tactic[]>([emptyTactic()])
  const [idealConditions, setIdealConditions] = useState<string[]>([''])
  const [rules, setRules] = useState<string[]>([''])
  const [maxRiskPct, setMaxRiskPct] = useState('')
  const [positionSizing, setPositionSizing] = useState('')
  const [stopStyle, setStopStyle] = useState('')
  const [expandedTactic, setExpandedTactic] = useState<number | null>(0)
  const [error, setError] = useState('')

  const isEdit = !!setup

  useEffect(() => {
    if (!open) return
    if (setup) {
      setName(setup.name)
      setDescription(setup.description || '')
      setTactics(
        setup.tactics.length > 0
          ? setup.tactics.map((t) => ({
              ...t,
              win_rate: t.win_rate ?? null,
              avg_r: t.avg_r ?? null,
              conditions: t.conditions.length > 0 ? t.conditions : [''],
            }))
          : [emptyTactic()]
      )
      setIdealConditions(setup.ideal_conditions.length > 0 ? setup.ideal_conditions : [''])
      setRules(setup.rules.length > 0 ? setup.rules : [''])
      setMaxRiskPct(setup.risk_profile.max_risk_pct?.toString() ?? '')
      setPositionSizing(setup.risk_profile.position_sizing_rule ?? '')
      setStopStyle(setup.risk_profile.stop_style ?? '')
      setExpandedTactic(0)
    } else {
      setName('')
      setDescription('')
      setTactics([emptyTactic()])
      setIdealConditions([''])
      setRules([''])
      setMaxRiskPct('')
      setPositionSizing('')
      setStopStyle('')
      setExpandedTactic(0)
    }
    setError('')
  }, [open, setup])

  const handleTacticChange = (index: number, field: keyof Tactic, value: unknown) => {
    setTactics((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value } as Tactic
      return next
    })
  }

  const addTactic = () => {
    setTactics((prev) => [...prev, emptyTactic()])
    setExpandedTactic(tactics.length)
  }

  const removeTactic = (index: number) => {
    setTactics((prev) => prev.filter((_, i) => i !== index))
    if (expandedTactic === index) setExpandedTactic(null)
  }

  const handleConditionChange = (
    list: string[],
    setList: (v: string[]) => void,
    index: number,
    value: string
  ) => {
    const next = [...list]
    next[index] = value
    setList(next)
  }

  const addItem = (list: string[], setList: (v: string[]) => void) => {
    setList([...list, ''])
  }

  const removeItem = (list: string[], setList: (v: string[]) => void, index: number) => {
    if (list.length <= 1) {
      setList([''])
      return
    }
    setList(list.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Setup name is required')
      return
    }

    const cleanedTactics = tactics
      .filter((t) => t.name.trim())
      .map((t) => ({
        name: t.name.trim(),
        win_rate: t.win_rate?.trim() || null,
        avg_r: t.avg_r?.trim() || null,
        conditions: t.conditions.filter((c) => c.trim()),
      }))

    const cleanedConditions = idealConditions.filter((c) => c.trim())
    const cleanedRules = rules.filter((r) => r.trim())

    const payload: SetupPlaybookCreatePayload | SetupPlaybookUpdatePayload = {
      name: name.trim(),
      description: description.trim() || null,
      tactics: cleanedTactics,
      ideal_conditions: cleanedConditions,
      rules: cleanedRules,
      risk_profile: {
        max_risk_pct: maxRiskPct ? (Number.isNaN(Number(maxRiskPct)) ? null : Number(maxRiskPct)) : null,
        position_sizing_rule: positionSizing.trim() || null,
        stop_style: stopStyle.trim() || null,
      },
    }

    onSubmit(payload)
  }

  if (!open) return null

  const btnPrimary =
    'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const btnGhost =
    'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const btnDangerIcon =
    'p-1.5 rounded-md hover:bg-loss-muted text-text-muted hover:text-loss transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg'
  const inputCls =
    'w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-[150ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed'
  const labelCls = 'block text-xs font-medium text-text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-8">
        <div className="bg-bg-card rounded-2xl border border-border p-6 relative" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit setup dialog' : 'New setup dialog'}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 min-h-10 min-w-10 rounded-md hover:bg-bg-elevated/50 text-text-muted hover:text-text transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label="Close setup dialog"
          >
            <X className="w-4 h-4" />
          </button>

          <h2 className="font-display text-xl text-text-heading mb-1 pr-8">
            {isEdit ? 'Edit Setup' : 'New Setup'}
          </h2>
          <p className="text-sm text-text-muted mb-6">
            {isEdit ? `Editing ${setup?.name}` : 'Define a new setup playbook entry with tactics, conditions, and rules.'}
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-loss-muted border border-loss/20 px-3 py-2 text-sm text-loss">{error}</div>
          )}

          <div className="space-y-5">
            {/* Name + Description */}
            <div>
              <label className={labelCls}>Setup Name *</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Episodic Pivot"
                disabled={isPending}
              />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea
                className={`${inputCls} resize-none`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What defines this setup?"
                rows={2}
                disabled={isPending}
              />
            </div>

            {/* Tactics (accordion) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted">Tactics</label>
                <button className={btnGhost} onClick={addTactic} disabled={isPending} type="button">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {tactics.map((tactic, ti) => (
                  <div key={ti} className="rounded-lg border border-border bg-bg-elevated/30 overflow-hidden">
                    <div className="flex items-stretch">
                      <button
                        onClick={() => setExpandedTactic(expandedTactic === ti ? null : ti)}
                        type="button"
                        aria-expanded={expandedTactic === ti}
                        className="flex-1 flex items-center justify-between px-3 py-2.5 text-sm font-medium text-text-heading hover:bg-bg-elevated/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
                      >
                        <span className="truncate">
                          {tactic.name.trim() || `Tactic ${ti + 1}`}
                        </span>
                        {expandedTactic === ti ? <ChevronUp className="w-4 h-4 text-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />}
                      </button>
                      {tactics.length > 1 && (
                        <button
                          onClick={() => removeTactic(ti)}
                          type="button"
                          className={`${btnDangerIcon} self-stretch rounded-none border-l border-border/60`}
                          aria-label={`Remove tactic ${ti + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {expandedTactic === ti && (
                      <div className="px-3 pb-3 space-y-3 border-t border-border">
                        <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Tactic Name</label>
                            <input
                              className={inputCls}
                              value={tactic.name}
                              onChange={(e) => handleTacticChange(ti, 'name', e.target.value)}
                              placeholder="e.g. Gap & Go"
                              disabled={isPending}
                            />
                          </div>
                          <div>
                <label className={labelCls}>Win Rate (optional)</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={tactic.win_rate ?? ''}
                    onChange={(e) => handleTacticChange(ti, 'win_rate', e.target.value)}
                    placeholder="62"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className={labelCls}>Avg R (optional)</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={tactic.avg_r ?? ''}
                    onChange={(e) => handleTacticChange(ti, 'avg_r', e.target.value)}
                    placeholder="2.1"
                    disabled={isPending}
                  />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1.5">Conditions</label>
                          <div className="space-y-2">
                            {tactic.conditions.map((cond, ci) => (
                              <div key={ci} className="flex items-center gap-2">
                                <input
                                  className={inputCls}
                                  value={cond}
                                  onChange={(e) => {
                                    const next = [...tactic.conditions]
                                    next[ci] = e.target.value
                                    handleTacticChange(ti, 'conditions', next)
                                  }}
                                  placeholder="Condition..."
                                  disabled={isPending}
                                />
                                <button
                                  onClick={() => {
                                    if (tactic.conditions.length <= 1) {
                                      handleTacticChange(ti, 'conditions', [''])
                                      return
                                    }
                                    const next = tactic.conditions.filter((_, i) => i !== ci)
                                    handleTacticChange(ti, 'conditions', next)
                                  }}
                                  className={btnDangerIcon}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <button className={btnGhost} onClick={() => {
                              handleTacticChange(ti, 'conditions', [...tactic.conditions, ''])
                            }} disabled={isPending}>
                              <Plus className="w-3.5 h-3.5" /> Add Condition
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ideal Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted">Ideal Conditions</label>
                <button className={btnGhost} onClick={() => addItem(idealConditions, setIdealConditions)} disabled={isPending}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {idealConditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={c}
                      onChange={(e) => handleConditionChange(idealConditions, setIdealConditions, i, e.target.value)}
                      placeholder="e.g. Strong catalyst (earnings surprise)"
                      disabled={isPending}
                    />
                    <button
                      onClick={() => removeItem(idealConditions, setIdealConditions, i)}
                      className={btnDangerIcon}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Profile */}
            <div>
              <label className="text-xs font-medium text-text-muted mb-2 block">Risk Profile</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Max Risk %</label>
                  <input
                    className={inputCls}
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={maxRiskPct}
                    onChange={(e) => setMaxRiskPct(e.target.value)}
                    placeholder="2.0"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className={labelCls}>Position Sizing Rule</label>
                  <input
                    className={inputCls}
                    value={positionSizing}
                    onChange={(e) => setPositionSizing(e.target.value)}
                    placeholder="1% risk per trade"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className={labelCls}>Stop Style</label>
                  <input
                    className={inputCls}
                    value={stopStyle}
                    onChange={(e) => setStopStyle(e.target.value)}
                    placeholder="structure_below_low"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Rules */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-text-muted">Rules</label>
                <button className={btnGhost} onClick={() => addItem(rules, setRules)} disabled={isPending}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
              <div className="space-y-2">
                {rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={r}
                      onChange={(e) => handleConditionChange(rules, setRules, i, e.target.value)}
                      placeholder="e.g. Never enter without a clear catalyst"
                      disabled={isPending}
                    />
                    <button
                      onClick={() => removeItem(rules, setRules, i)}
                      className={btnDangerIcon}
                      aria-label={`Remove rule ${i + 1}`}
                      type="button"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button className={btnGhost} onClick={onClose} disabled={isPending} type="button">Cancel</button>
            <button className={btnPrimary} onClick={handleSubmit} disabled={isPending} type="button">
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
