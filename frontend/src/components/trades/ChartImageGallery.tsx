import { useState, useRef, type ChangeEvent } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useUploadChartImageMutation, useDeleteChartImageMutation } from '@/hooks/useChartImagesMutation'
import { useToastStore } from '@/store/toastStore'
import { Upload, Trash2, ChevronLeft, ChevronRight, Loader2, BarChart3, Expand } from 'lucide-react'
import { Lightbox } from '@/components/ui/Lightbox'

interface ChartImageGalleryProps {
  tradeId: number
  images: string[]
}

export function ChartImageGallery({ tradeId, images }: ChartImageGalleryProps) {
  const addToast = useToastStore((s) => s.addToast)
  const uploadMutation = useUploadChartImageMutation()
  const deleteMutation = useDeleteChartImageMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const slides = images.length > 0 ? images : ['']
  const current = activeIndex >= slides.length ? 0 : activeIndex

  const goPrev = () => setActiveIndex((i) => (i > 0 ? i - 1 : slides.length - 1))
  const goNext = () => setActiveIndex((i) => (i < slides.length - 1 ? i + 1 : 0))

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      addToast({ title: 'Error', message: 'File must be an image.', variant: 'error' })
      return
    }
    try {
      await uploadMutation.mutateAsync({ tradeId, file })
      addToast({ title: 'Uploaded', message: 'Chart image saved.', variant: 'success' })
      setActiveIndex(slides.length - 1)
    } catch {
      addToast({ title: 'Error', message: 'Failed to upload image.', variant: 'error' })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async () => {
    const url = slides[current]
    if (!url) return
    try {
      await deleteMutation.mutateAsync({ tradeId, url })
      addToast({ title: 'Deleted', message: 'Chart image removed.', variant: 'info' })
    } catch {
      addToast({ title: 'Error', message: 'Failed to delete image.', variant: 'error' })
    }
  }

  return (
    <div className="pt-[var(--page-gap)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wide">Charts</h3>
        <div className="flex items-center gap-1">
          {images.length > 0 && (
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="p-1.5 rounded-lg text-text-muted hover:text-loss hover:bg-loss-muted/20 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[length:var(--text-xs)] font-medium text-accent hover:bg-accent-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            {uploadMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </div>
      </div>

      <div className="relative aspect-video rounded-lg overflow-hidden bg-bg-elevated/50 border border-border">
        {slides[current] ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 cursor-zoom-in group"
            aria-label="View full screen"
          >
            <img
              src={slides[current]}
              alt="Trade chart"
              className="w-full h-full object-contain"
              loading="lazy"
              draggable={false}
            />
            <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Expand className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-text-muted">
            <div className="w-10 h-10 rounded-full bg-accent-muted flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-accent" />
            </div>
            <p className="text-xs text-center">No chart images uploaded</p>
          </div>
        )}

        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-bg-card/80 backdrop-blur-sm border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-text" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-bg-card/80 backdrop-blur-sm border border-border hover:bg-bg-elevated transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 text-text" />
            </button>
          </>
        )}

        {slides.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-hover cursor-pointer ${
                  idx === current ? 'bg-accent w-3' : 'bg-text-muted/40'
                }`}
                onClick={() => setActiveIndex(idx)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            open={lightboxOpen}
            images={images}
            activeIndex={current}
            onClose={() => setLightboxOpen(false)}
            onPrev={goPrev}
            onNext={goNext}
            onSelect={setActiveIndex}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
