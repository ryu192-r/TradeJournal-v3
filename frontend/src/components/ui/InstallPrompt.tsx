import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] flex items-center gap-3 bg-bg-card border border-border rounded-2xl p-4 shadow-lg animate-card-in max-w-sm mx-auto">
      <div className="w-10 h-10 rounded-xl bg-accent-faint flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-heading">Install Trading Journal</p>
        <p className="text-xs text-text-muted">Add to home screen for quick access</p>
      </div>
      <button
        onClick={handleInstall}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer"
      >
        Install
      </button>
      <button
        onClick={() => setShow(false)}
        className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-heading transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
