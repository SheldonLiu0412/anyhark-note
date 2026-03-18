import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

// ─── Image Preview (Lightbox) ────────────────────────────────

interface ImagePreviewProps {
  images: string[]
  initialIndex: number
  onClose: () => void
}

function ImagePreview({ images, initialIndex, onClose }: ImagePreviewProps): React.JSX.Element {
  const [index, setIndex] = useState(initialIndex)
  const total = images.length

  const goPrev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), [])
  const goNext = useCallback(() => setIndex((i) => (i < total - 1 ? i + 1 : i)), [total])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, goPrev, goNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={onClose}
      >
        <X size={20} />
      </button>

      {/* Prev */}
      {total > 1 && index > 0 && (
        <button
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); goPrev() }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image */}
      <img
        src={images[index]}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Next */}
      {total > 1 && index < total - 1 && (
        <button
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); goNext() }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Indicator */}
      {total > 1 && (
        <div className="absolute bottom-6 text-white/70 text-sm tabular-nums">
          {index + 1} / {total}
        </div>
      )}
    </div>
  )
}

// ─── Read-only Gallery ───────────────────────────────────────

interface ImageGalleryProps {
  images: string[]
}

export function ImageGallery({ images }: ImageGalleryProps): React.JSX.Element | null {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <div className="flex items-center gap-2 mt-2 overflow-x-auto pb-1 scrollbar-thin">
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => setPreviewIndex(i)}
            className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border/40 hover:border-border transition-colors"
          >
            <img
              src={src}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </button>
        ))}
      </div>
      {previewIndex !== null && (
        <ImagePreview
          images={images}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  )
}

// ─── Editable Gallery (for editor) ──────────────────────────

export interface ImageItem {
  filename: string
  src: string
}

interface EditableImageGalleryProps {
  images: ImageItem[]
  onDelete: (filename: string) => void
}

export function EditableImageGallery({ images, onDelete }: EditableImageGalleryProps): React.JSX.Element | null {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  const srcs = images.map((img) => img.src)

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {images.map((img, i) => (
          <div
            key={img.filename}
            className="group/img relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border/40"
          >
            <button
              onClick={() => setPreviewIndex(i)}
              className="w-full h-full"
            >
              <img
                src={img.src}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(img.filename)
              }}
              className={cn(
                'absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full',
                'bg-destructive text-destructive-foreground',
                'flex items-center justify-center',
                'opacity-0 group-hover/img:opacity-100 transition-opacity',
                'shadow-sm'
              )}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      {previewIndex !== null && (
        <ImagePreview
          images={srcs}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  )
}
