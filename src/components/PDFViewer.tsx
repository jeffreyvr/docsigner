import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { STAMP_SIZE, type Placement, type StampType } from '../types'

interface PDFViewerProps {
  pdf: PDFDocumentProxy
  placements: Placement[]
  activeTool: StampType | null
  signatureDataUrl: string | null
  initialsDataUrl: string | null
  onPlace: (pageIndex: number, x: number, y: number) => void
  onUpdatePlacement: (id: string, patch: Partial<Placement>) => void
  onRemovePlacement: (id: string) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const RENDER_SCALE = 1.5

export function PDFViewer({
  pdf,
  placements,
  activeTool,
  signatureDataUrl,
  initialsDataUrl,
  onPlace,
  onUpdatePlacement,
  onRemovePlacement,
  selectedId,
  onSelect,
}: PDFViewerProps) {
  const [pageCount, setPageCount] = useState(0)
  const [pageSizes, setPageSizes] = useState<
    { width: number; height: number }[]
  >([])

  useEffect(() => {
    setPageCount(pdf.numPages)
    let cancelled = false
    ;(async () => {
      const sizes: { width: number; height: number }[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: RENDER_SCALE })
        sizes.push({ width: viewport.width, height: viewport.height })
      }
      if (!cancelled) setPageSizes(sizes)
    })()
    return () => {
      cancelled = true
    }
  }, [pdf])

  const handlePageClick = (
    e: React.MouseEvent<HTMLDivElement>,
    pageIndex: number,
  ) => {
    if (!activeTool) return
    // Ignore if clicking a stamp
    if ((e.target as HTMLElement).closest('.stamp')) return

    // Text: first click places, next click on the page finishes typing
    if (activeTool === 'text' && selectedId) {
      onSelect(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / rect.width
    const clickY = (e.clientY - rect.top) / rect.height

    const { width: defaultW, height: defaultH } = STAMP_SIZE[activeTool]

    // Text starts at the click; marks are centered on it
    const x =
      activeTool === 'text'
        ? Math.max(0, Math.min(1 - defaultW, clickX))
        : Math.max(0, Math.min(1 - defaultW, clickX - defaultW / 2))
    const y = Math.max(0, Math.min(1 - defaultH, clickY - defaultH / 2))

    onPlace(pageIndex, x, y)
  }

  return (
    <div className="pdf-viewer" onClick={() => onSelect(null)}>
      {Array.from({ length: pageCount }, (_, i) => (
        <PageCanvas
          key={i}
          pdf={pdf}
          pageIndex={i}
          size={pageSizes[i]}
          placements={placements.filter((p) => p.pageIndex === i)}
          activeTool={activeTool}
          signatureDataUrl={signatureDataUrl}
          initialsDataUrl={initialsDataUrl}
          onPageClick={(e) => handlePageClick(e, i)}
          onUpdatePlacement={onUpdatePlacement}
          onRemovePlacement={onRemovePlacement}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

interface PageCanvasProps {
  pdf: PDFDocumentProxy
  pageIndex: number
  size?: { width: number; height: number }
  placements: Placement[]
  activeTool: StampType | null
  signatureDataUrl: string | null
  initialsDataUrl: string | null
  onPageClick: (e: React.MouseEvent<HTMLDivElement>) => void
  onUpdatePlacement: (id: string, patch: Partial<Placement>) => void
  onRemovePlacement: (id: string) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function PageCanvas({
  pdf,
  pageIndex,
  size,
  placements,
  activeTool,
  signatureDataUrl,
  initialsDataUrl,
  onPageClick,
  onUpdatePlacement,
  onRemovePlacement,
  selectedId,
  onSelect,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: RENDER_SCALE })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      if (!cancelled) setRendered(true)
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, pageIndex])

  const imageFor = (type: StampType) =>
    type === 'signature' ? signatureDataUrl : initialsDataUrl

  return (
    <div className="pdf-page-block">
      <div className="pdf-page-label">Page {pageIndex + 1}</div>
      <div
        ref={containerRef}
        className={`pdf-page ${activeTool ? 'placeable' : ''}`}
        style={
          size
            ? {
                // Let CSS cap width on small screens; aspect-ratio keeps proportions
                maxWidth: '100%',
                width: 'min(100%, ' + size.width + 'px)',
                aspectRatio: `${size.width} / ${size.height}`,
              }
            : { maxWidth: '100%', width: '100%' }
        }
        onClick={(e) => {
          e.stopPropagation()
          onPageClick(e)
        }}
      >
        <canvas ref={canvasRef} className="pdf-page-canvas" />
        {rendered &&
          placements.map((p) => {
            const src = p.type === 'text' ? undefined : (imageFor(p.type) ?? undefined)
            if (p.type !== 'text' && !src) return null
            return (
              <Stamp
                key={p.id}
                placement={p}
                src={src}
                selected={selectedId === p.id}
                onSelect={() => onSelect(p.id)}
                onUpdate={(patch) => onUpdatePlacement(p.id, patch)}
                onRemove={() => onRemovePlacement(p.id)}
                containerRef={containerRef}
              />
            )
          })}
      </div>
    </div>
  )
}

interface StampProps {
  placement: Placement
  src?: string
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<Placement>) => void
  onRemove: () => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

function Stamp({
  placement,
  src,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  containerRef,
}: StampProps) {
  const isText = placement.type === 'text'
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const focusedOnce = useRef(false)
  const dragRef = useRef<{
    mode: 'pending' | 'move' | 'resize'
    startX: number
    startY: number
    orig: Placement
  } | null>(null)

  useEffect(() => {
    if (!isText || !selected || focusedOnce.current) return
    focusedOnce.current = true
    const node = textareaRef.current
    if (!node) return
    node.focus()
    const end = node.value.length
    node.setSelectionRange(end, end)
  }, [isText, selected])

  const beginDrag = (
    e: React.PointerEvent,
    mode: 'pending' | 'move' | 'resize',
  ) => {
    e.stopPropagation()
    if (mode !== 'pending') e.preventDefault()
    onSelect()
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...placement },
    }
    if (mode !== 'pending') {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }

  const onPointerDownMove = (e: React.PointerEvent) => beginDrag(e, 'move')
  const onPointerDownResize = (e: React.PointerEvent) => beginDrag(e, 'resize')

  const onPointerDownText = (e: React.PointerEvent) => {
    if (selected) {
      e.stopPropagation()
      return
    }
    beginDrag(e, 'pending')
  }

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || !containerRef.current) return

      if (dragRef.current.mode === 'pending') {
        const dist = Math.hypot(
          e.clientX - dragRef.current.startX,
          e.clientY - dragRef.current.startY,
        )
        if (dist < 6) return
        dragRef.current.mode = 'move'
        textareaRef.current?.blur()
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }

      const rect = containerRef.current.getBoundingClientRect()
      const dx = (e.clientX - dragRef.current.startX) / rect.width
      const dy = (e.clientY - dragRef.current.startY) / rect.height
      const o = dragRef.current.orig

      if (dragRef.current.mode === 'move') {
        const x = Math.max(0, Math.min(1 - o.width, o.x + dx))
        const y = Math.max(0, Math.min(1 - o.height, o.y + dy))
        onUpdate({ x, y })
      } else if (dragRef.current.mode === 'resize') {
        const width = Math.max(0.04, Math.min(1 - o.x, o.width + dx))
        const height = Math.max(0.02, Math.min(1 - o.y, o.height + dy))
        onUpdate({ width, height })
      }
    },
    [containerRef, onUpdate],
  )

  const onPointerUp = (e: React.PointerEvent) => {
    const pending = dragRef.current?.mode === 'pending'
    dragRef.current = null
    if (pending) {
      textareaRef.current?.focus()
    }
    if ((e.target as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div
      className={`stamp ${selected ? 'selected' : ''} ${isText ? 'stamp-text' : ''}`}
      style={{
        left: `${placement.x * 100}%`,
        top: `${placement.y * 100}%`,
        width: `${placement.width * 100}%`,
        height: `${placement.height * 100}%`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onPointerDown={isText ? undefined : onPointerDownMove}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {isText ? (
        <>
          {selected && (
            <div
              className="stamp-drag"
              onPointerDown={onPointerDownMove}
              title="Drag to move"
            />
          )}
          <textarea
            ref={textareaRef}
            className="stamp-textarea"
            value={placement.text ?? ''}
            placeholder="Type here"
            rows={1}
            spellCheck={false}
            onChange={(e) => onUpdate({ text: e.target.value })}
            onPointerDown={onPointerDownText}
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
          />
        </>
      ) : (
        <img src={src} alt={placement.type} draggable={false} />
      )}
      {selected && (
        <>
          <button
            type="button"
            className="stamp-delete"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            title="Remove"
          >
            ×
          </button>
          <div className="stamp-resize" onPointerDown={onPointerDownResize} />
        </>
      )}
    </div>
  )
}
