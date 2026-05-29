import { useState, useCallback, useRef, type ChangeEvent, type KeyboardEvent, type DragEvent as ReactDragEvent } from 'react'
import { Upload, FileText, Download, X, AlertCircle, CheckCircle2, Loader2, Eye } from 'lucide-react'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { useToastStore } from '@/store/toastStore'
import { getBrokerTemplate, importBrokerCsv, previewBrokerImport } from '@/lib/endpoints'
import type { BrokerInfo, BrokerImportResult } from '@/types'

interface BrokerImportModalProps {
  open: boolean
  onClose: () => void
  onImported?: () => void
}

const BROKER_OPTIONS_STATIC: BrokerInfo[] = [
  { id: 'zerodha', name: 'Zerodha (Kite)' },
  { id: 'dhan', name: 'Dhan' },
  { id: 'generic', name: 'Generic CSV' },
]

export function BrokerImportModal({ open, onClose, onImported }: BrokerImportModalProps) {
  const addToast = useToastStore((s) => s.addToast)
  const [broker, setBroker] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'select' | 'upload' | 'preview' | 'result'>('select')
  const [isUploading, setIsUploading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [result, setResult] = useState<BrokerImportResult | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleBrokerChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setBroker(e.target.value)
    setFile(null)
    setResult(null)
    setError('')
    if (e.target.value) {
      setStep('upload')
    }
  }, [])

  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setError('')
      if (broker) {
        setIsPreviewing(true)
        try {
          const res = await previewBrokerImport(broker, f)
          setResult(res)
          setStep('preview')
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Preview failed')
        } finally {
          setIsPreviewing(false)
        }
      }
    }
  }, [broker])

  const handleDrop = useCallback(async (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f && f.name.endsWith('.csv')) {
      setFile(f)
      setError('')
      if (broker) {
        setIsPreviewing(true)
        try {
          const res = await previewBrokerImport(broker, f)
          setResult(res)
          setStep('preview')
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Preview failed')
        } finally {
          setIsPreviewing(false)
        }
      }
    } else if (f) {
      setError('Please select a .csv file')
    }
  }, [broker])

  const handleImport = useCallback(async () => {
    if (!broker || !file) return
    setIsUploading(true)
    setError('')
    try {
      const res = await importBrokerCsv(broker, file, false)
      setResult(res)
      setStep('result')
      if (res.status === 'success') {
        addToast({
          title: 'Import complete',
          message: `Added ${res.added} trades${res.updated ? `, updated ${res.updated}` : ''}, skipped ${res.skipped}`,
          variant: 'success',
        })
        onImported?.()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed'
      setError(msg)
      addToast({ title: 'Import failed', message: msg, variant: 'error' })
    } finally {
      setIsUploading(false)
    }
  }, [broker, file, addToast, onImported])

  const handleDownloadTemplate = useCallback(async () => {
    if (!broker) return
    try {
      addToast({ title: 'Downloading template...', message: `Downloading ${broker} template`, variant: 'info' })
      const blob = await getBrokerTemplate(broker)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${broker}_import_template.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      addToast({ title: 'Error', message: 'Failed to download template', variant: 'error' })
    }
  }, [broker, addToast])

  const handleDropzoneKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }, [])

  const handleClose = useCallback(() => {
    setBroker('')
    setFile(null)
    setResult(null)
    setError('')
    setStep('select')
    setIsUploading(false)
    onClose()
  }, [onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-bg-card rounded-2xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Broker import dialog">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg text-text-heading">Import from Broker</h2>
          <button
            onClick={handleClose}
            className="p-2 min-h-10 min-w-10 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-card-h transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-[length:var(--text-sm)] text-text-muted">
              Import trades from your broker's CSV export. Select your broker to continue.
            </p>
            <GlassSelect
              label="Broker"
              options={BROKER_OPTIONS_STATIC.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Choose your broker..."
              value={broker}
              onChange={handleBrokerChange}
            />
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">
                  Broker:
                </span>
                <span className="text-sm text-accent font-medium">
                  {BROKER_OPTIONS_STATIC.find((b) => b.id === broker)?.name}
                </span>
              </div>
              <GlassButton variant="ghost" size="sm" onClick={() => { setStep('select'); setBroker(''); setFile(null) }}>
                Change
              </GlassButton>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download {broker} template
            </button>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={handleDropzoneKeyDown}
              role="button"
              tabIndex={0}
              aria-label="Choose CSV file"
              className={`
                relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${file ? 'border-accent/40 bg-accent-faint/30' : 'border-border-strong hover:border-accent/40 hover:bg-accent-faint/10'}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-8 h-8 text-accent" />
                  <div className="text-left">
                    <p className="text-[length:var(--text-sm)] text-text-heading font-medium">{file.name}</p>
                    <p className="text-[length:var(--text-xs)] text-text-muted">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-[length:var(--text-sm)] text-text-muted">
                    Drop your CSV file here or <span className="text-accent">browse</span>
                  </p>
                  <p className="text-xs text-text-faint mt-1">.csv files only</p>
                </>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-loss-muted/20 border border-loss/20">
                <AlertCircle className="w-4 h-4 text-loss shrink-0 mt-0.5" />
                <p className="text-xs text-loss">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <GlassButton variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </GlassButton>
              <GlassButton
                variant="accent"
                size="sm"
                disabled={!file || isPreviewing}
                onClick={async () => {
                  if (!broker || !file) return
                  setIsPreviewing(true)
                  setError('')
                  try {
                    const res = await previewBrokerImport(broker, file)
                    setResult(res)
                    setStep('preview')
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Preview failed'
                    setError(msg)
                  } finally {
                    setIsPreviewing(false)
                  }
                }}
              >
                {isPreviewing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Preview &amp; Review
                  </>
                )}
              </GlassButton>
            </div>
          </div>
        )}

        {step === 'preview' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-accent" />
              <h3 className="font-display text-base text-text-heading">Review Import</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-xl font-data font-bold text-profit">{result.total - result.skipped}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Will Add</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-xl font-data font-bold text-yellow-400">{result.skipped}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Will Skip</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-xl font-data font-bold text-text-heading">{result.total}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Total Rows</p>
              </div>
            </div>
            {result.preview && result.preview.length > 0 && (
              <div>
                <p className="text-[length:var(--text-xs)] font-medium text-text-muted mb-2 uppercase tracking-wider">
                  {result.skipped > 0
                    ? 'Greyed rows already exist in your journal (fingerprint/order ID match) and will be skipped'
                    : `First ${result.preview.length} rows`}
                </p>
                <div className="overflow-x-auto rounded-lg border border-border max-h-64 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-bg-card">
                      <tr className="border-b border-border">
                        <th className="px-2 py-2 text-left text-text-muted font-medium">#</th>
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Symbol</th>
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Entry</th>
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Qty</th>
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.preview.map((row, i) => (
                        <tr
                          key={i}
                          className={`transition-colors ${row._skipped ? 'opacity-40 bg-bg-elevated/20' : 'hover:bg-bg-card-h'}`}
                          title={row._skipped ? 'Already exists in your journal (fingerprint/order ID match)' : undefined}
                        >
                          <td className="px-2 py-1.5 text-text-muted text-center">{i + 1}</td>
                          <td className={`px-2 py-1.5 ${row._skipped ? 'text-text-muted' : 'text-text-heading'}`}>{row.symbol}</td>
                          <td className={`px-2 py-1.5 ${row._skipped ? 'text-text-muted' : 'text-text-heading'}`}>{row.entry_price}</td>
                          <td className={`px-2 py-1.5 ${row._skipped ? 'text-text-muted' : 'text-text-heading'}`}>{row.quantity}</td>
                          <td className={`px-2 py-1.5 ${row._skipped ? 'text-text-muted' : 'text-text-heading'}`}>{row.entry_time ? row.entry_time.slice(0, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {isPreviewing && (
              <div className="flex items-center justify-center gap-2 py-4 text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Analyzing...</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <GlassButton variant="ghost" size="sm" onClick={() => { setStep('upload'); setResult(null); setError('') }}>
                Back
              </GlassButton>
              <GlassButton
                variant="accent"
                size="sm"
                disabled={isUploading || result.skipped === result.total}
                onClick={handleImport}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import {result.total - result.skipped} trades
                  </>
                )}
              </GlassButton>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              {result.status === 'success' ? (
                <CheckCircle2 className="w-6 h-6 text-profit" />
              ) : (
                <AlertCircle className="w-6 h-6 text-loss" />
              )}
              <h3 className="font-display text-base text-text-heading">
                {result.status === 'success' ? 'Import Complete' : 'Import Failed'}
              </h3>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-2xl font-data font-bold text-profit">{result.added}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Added</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-2xl font-data font-bold text-accent">{result.updated}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Updated</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-2xl font-data font-bold text-yellow-400">{result.skipped}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Skipped</p>
              </div>
              <div className="rounded-xl border border-border bg-bg-elevated/50 p-3 text-center">
                <p className="text-2xl font-data font-bold text-text-heading">{result.total}</p>
                <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Total</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg border border-loss/20 bg-loss-muted/10 p-3 max-h-32 overflow-y-auto">
                <p className="text-[length:var(--text-xs)] font-medium text-loss mb-1">Issues ({result.errors.length})</p>
                {result.errors.slice(0, 10).map((err, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[length:var(--text-xs)] text-text-muted py-0.5">
                    <span className="text-loss shrink-0 mt-0.5">•</span>
                    <span>{err}</span>
                  </div>
                ))}
                {result.errors.length > 10 && (
                  <p className="text-xs text-text-faint mt-1">...and {result.errors.length - 10} more</p>
                )}
              </div>
            )}

            {result.preview && result.preview.length > 0 && (
              <div>
                <p className="text-[length:var(--text-xs)] font-medium text-text-muted mb-2 uppercase tracking-wider">
                  Imported trades ({result.preview.length})
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-bg-low">
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Symbol</th>
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Entry</th>
                        <th className="px-2 py-2 text-left text-text-muted font-medium">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.preview.map((row, i) => (
                        <tr key={i} className="hover:bg-bg-card-h transition-colors">
                          <td className="px-2 py-1.5 text-text-heading">{row.symbol}</td>
                          <td className="px-2 py-1.5 text-text-heading">{row.entry_price}</td>
                          <td className="px-2 py-1.5 text-text-heading">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {result.status === 'error' ? (
                <GlassButton variant="accent" size="sm" onClick={() => { setStep('upload'); setResult(null); setError('') }}>
                  Retry
                </GlassButton>
              ) : (
                <>
                  <GlassButton variant="ghost" size="sm" onClick={handleClose}>
                    Close
                  </GlassButton>
                  <GlassButton variant="accent" size="sm" onClick={() => { setStep('upload'); setFile(null); setResult(null); setError('') }}>
                    Import More
                  </GlassButton>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
