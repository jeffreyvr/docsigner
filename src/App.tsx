import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { SignaturePad } from './components/SignaturePad'
import { PDFViewer } from './components/PDFViewer'
import { Logo } from './components/Logo'
import { ThanksModal } from './components/ThanksModal'
import { downloadBytes, exportSignedPdf } from './utils/pdfExport'
import type { Placement, StampType } from './types'
import './App.css'

// Vite-friendly worker setup
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString()

function uid() {
  return crypto.randomUUID()
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  return { theme, toggle }
}

function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(`(max-width: ${breakpoint}px)`).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpoint])

  return isMobile
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const isMobile = useIsMobile()
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [initials, setInitials] = useState<string | null>(null)
  const [placements, setPlacements] = useState<Placement[]>([])
  const [activeTool, setActiveTool] = useState<StampType | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [applyToAllPages, setApplyToAllPages] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thanksOpen, setThanksOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Lock body scroll when mobile tools sheet is open
  useEffect(() => {
    if (!isMobile || !toolsOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobile, toolsOpen])

  // Escape closes tools sheet
  useEffect(() => {
    if (!toolsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toolsOpen])

  const loadPdf = useCallback(async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      const bytes = await file.arrayBuffer()
      // Keep a copy — pdf.js may detach the buffer
      const copy = bytes.slice(0)
      const doc = await pdfjs.getDocument({ data: bytes }).promise
      setPdf(doc)
      setPdfBytes(copy)
      setFileName(file.name)
      setPlacements([])
      setSelectedId(null)
      setActiveTool(null)
      // Open tools so user can draw signature first
      setToolsOpen(true)
    } catch {
      setError('Could not open that PDF. Please try another file.')
      setPdf(null)
      setPdfBytes(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void loadPdf(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file?.type === 'application/pdf' || file?.name.endsWith('.pdf')) {
      void loadPdf(file)
    } else {
      setError('Please drop a PDF file.')
    }
  }

  const placeStamp = (pageIndex: number, x: number, y: number) => {
    if (!activeTool || !pdf) return
    const image = activeTool === 'signature' ? signature : initials
    if (!image) return

    const width = activeTool === 'signature' ? 0.28 : 0.12
    const height = activeTool === 'signature' ? 0.08 : 0.06

    const pageIndexes =
      applyToAllPages && pdf.numPages > 1
        ? Array.from({ length: pdf.numPages }, (_, i) => i)
        : [pageIndex]

    const created: Placement[] = pageIndexes.map((i) => ({
      id: uid(),
      type: activeTool,
      pageIndex: i,
      x,
      y,
      width,
      height,
    }))

    setPlacements((prev) => [...prev, ...created])
    const focus = created.find((p) => p.pageIndex === pageIndex) ?? created[0]
    setSelectedId(focus.id)
  }

  const updatePlacement = (id: string, patch: Partial<Placement>) => {
    setPlacements((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  }

  const removePlacement = (id: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const handleDownload = async () => {
    if (!pdfBytes) return
    setExporting(true)
    setError(null)
    try {
      const bytes = await exportSignedPdf(
        pdfBytes,
        placements,
        signature,
        initials,
      )
      const base = fileName.replace(/\.pdf$/i, '') || 'document'
      downloadBytes(bytes, `${base}-signed.pdf`)
      setThanksOpen(true)
    } catch {
      setError('Failed to create signed PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const resetDocument = () => {
    setPdf(null)
    setPdfBytes(null)
    setFileName('')
    setPlacements([])
    setSelectedId(null)
    setActiveTool(null)
    setToolsOpen(false)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectTool = (tool: StampType) => {
    const enabling = activeTool !== tool
    setActiveTool(enabling ? tool : null)
    // On mobile, close sheet when starting to place so the PDF is free
    if (enabling && isMobile) setToolsOpen(false)
  }

  const canPlaceSignature = Boolean(signature)
  const canPlaceInitials = Boolean(initials)
  const canDownload = Boolean(pdf && placements.length > 0)

  const toolsPanel = pdf ? (
    <>
      <section className="sidebar-section">
        <h2>Document</h2>
        <p className="file-name" title={fileName}>
          {fileName}
        </p>
        <p className="muted">
          {pdf.numPages} page{pdf.numPages === 1 ? '' : 's'} ·{' '}
          {placements.length} stamp{placements.length === 1 ? '' : 's'}
        </p>
      </section>

      <section className="sidebar-section">
        <h2>Your marks</h2>
        <SignaturePad
          label="Signature"
          value={signature}
          onChange={setSignature}
          width={280}
          height={100}
        />
        <SignaturePad
          label="Initials"
          value={initials}
          onChange={setInitials}
          width={140}
          height={80}
        />
      </section>

      <section className="sidebar-section">
        <h2>Place on document</h2>
        <p className="muted place-hint">
          Select a tool, then click on a page to place it. Drag to move, use the
          corner handle to resize.
        </p>
        <div className="tool-row">
          <button
            type="button"
            className={`tool-btn ${activeTool === 'signature' ? 'active' : ''}`}
            disabled={!canPlaceSignature}
            onClick={() => selectTool('signature')}
            title={
              canPlaceSignature
                ? 'Click pages to place signature'
                : 'Draw a signature first'
            }
          >
            <span className="tool-preview">
              {signature ? (
                <img src={signature} alt="" />
              ) : (
                <span className="tool-empty">Sig</span>
              )}
            </span>
            Signature
          </button>
          <button
            type="button"
            className={`tool-btn ${activeTool === 'initials' ? 'active' : ''}`}
            disabled={!canPlaceInitials}
            onClick={() => selectTool('initials')}
            title={
              canPlaceInitials
                ? 'Click pages to place initials'
                : 'Draw initials first'
            }
          >
            <span className="tool-preview small">
              {initials ? (
                <img src={initials} alt="" />
              ) : (
                <span className="tool-empty">Init</span>
              )}
            </span>
            Initials
          </button>
        </div>
        {pdf.numPages > 1 && (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={applyToAllPages}
              onChange={(e) => setApplyToAllPages(e.target.checked)}
            />
            <span className="toggle-ui" aria-hidden="true" />
            <span className="toggle-label">
              Apply to all {pdf.numPages} pages
            </span>
          </label>
        )}
        {activeTool && (
          <p className="active-tool-hint">
            Placing <strong>{activeTool}</strong>
            {applyToAllPages && pdf.numPages > 1
              ? ' on all pages'
              : ' — click a page'}
            <button
              type="button"
              className="btn-ghost inline"
              onClick={() => setActiveTool(null)}
            >
              Cancel
            </button>
          </p>
        )}
      </section>

      {placements.length > 0 && (
        <section className="sidebar-section">
          <button
            type="button"
            className="btn-ghost danger full"
            onClick={() => {
              setPlacements([])
              setSelectedId(null)
            }}
          >
            Clear all placements
          </button>
        </section>
      )}
    </>
  ) : null

  return (
    <div className={`app ${pdf ? 'has-doc' : ''}`}>
      <ThanksModal open={thanksOpen} onClose={() => setThanksOpen(false)} />
      <header className="header">
        <div className="brand">
          <a
            className="brand-home"
            href="https://vanrossum.dev"
            target="_blank"
            rel="noopener noreferrer"
            title="vanrossum.dev"
          >
            <Logo className="brand-logo" />
          </a>
          <h1 className="brand-name">DocSigner</h1>
        </div>

        <div className="header-center">
          <button
            type="button"
            className="btn-primary"
            disabled={!canDownload || exporting}
            onClick={() => void handleDownload()}
          >
            <span className="btn-label-full">
              {exporting ? 'Preparing…' : 'Download'}
            </span>
            <span className="btn-label-short" aria-hidden="true">
              {exporting ? '…' : '↓'}
            </span>
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={!pdf}
            onClick={resetDocument}
          >
            New
          </button>
        </div>

        <div className="header-end">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
            }
            title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <a
            className="icon-btn header-github"
            href="https://github.com/jeffreyvr/docsigner"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .32.21.7.82.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </header>

      {error && (
        <div className="banner error" role="alert">
          {error}
          <button
            type="button"
            className="banner-dismiss"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {!pdf ? (
        <main className="empty-canvas">
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            <div className="dropzone-icon" aria-hidden="true">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="M9 15l3-3 3 3" />
              </svg>
            </div>
            <p className="dropzone-title">Drop a PDF here</p>
            <p>or click to browse</p>
            {loading && <p className="loading-text">Opening PDF…</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={onFileChange}
              hidden
            />
          </div>

          <p className="empty-desc">
            Sign PDFs in your browser. Nothing is uploaded — your docs stay on
            your device.
          </p>

          <p className="empty-meta">
            <a
              className="follow-x"
              href="https://x.com/jeffreyrossum"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                className="follow-avatar"
                src="https://vanrossum.dev/images/jeffrey-portrait.webp"
                alt=""
                width={22}
                height={22}
              />
              Follow me on 𝕏
            </a>
            <span className="empty-dot" aria-hidden="true">
              ·
            </span>
            <span>vibe coded with Grok 4.5</span>
          </p>
        </main>
      ) : (
        <div className={`workspace ${toolsOpen ? 'tools-open' : ''}`}>
          {!isMobile && (
            <aside className="sidebar sidebar-desktop">{toolsPanel}</aside>
          )}

          <main className="document-pane">
            {isMobile && activeTool && (
              <div className="place-banner">
                <span>
                  Tap a page to place <strong>{activeTool}</strong>
                  {applyToAllPages && pdf.numPages > 1 ? ' on all pages' : ''}
                </span>
                <button
                  type="button"
                  className="btn-ghost inline"
                  onClick={() => setActiveTool(null)}
                >
                  Cancel
                </button>
              </div>
            )}
            <PDFViewer
              pdf={pdf}
              placements={placements}
              activeTool={activeTool}
              signatureDataUrl={signature}
              initialsDataUrl={initials}
              onPlace={placeStamp}
              onUpdatePlacement={updatePlacement}
              onRemovePlacement={removePlacement}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </main>

          {isMobile && (
            <>
              <div className="mobile-bar">
                <button
                  type="button"
                  className={`mobile-bar-btn ${toolsOpen ? 'active' : ''}`}
                  onClick={() => setToolsOpen((o) => !o)}
                  aria-expanded={toolsOpen}
                  aria-controls="tools-sheet"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Tools
                </button>
                <button
                  type="button"
                  className={`mobile-bar-btn tool ${activeTool === 'signature' ? 'active' : ''}`}
                  disabled={!canPlaceSignature}
                  onClick={() => selectTool('signature')}
                >
                  Signature
                </button>
                <button
                  type="button"
                  className={`mobile-bar-btn tool ${activeTool === 'initials' ? 'active' : ''}`}
                  disabled={!canPlaceInitials}
                  onClick={() => selectTool('initials')}
                >
                  Initials
                </button>
              </div>

              <div
                className={`tools-backdrop ${toolsOpen ? 'open' : ''}`}
                onClick={() => setToolsOpen(false)}
                aria-hidden={!toolsOpen}
              />
              <aside
                id="tools-sheet"
                className={`sidebar sidebar-sheet ${toolsOpen ? 'open' : ''}`}
                aria-hidden={!toolsOpen}
              >
                <div className="sheet-handle" aria-hidden="true" />
                <div className="sheet-header">
                  <h2 className="sheet-title">Tools</h2>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setToolsOpen(false)}
                    aria-label="Close tools"
                  >
                    ×
                  </button>
                </div>
                <div className="sheet-body">{toolsPanel}</div>
                <div className="sheet-footer">
                  <button
                    type="button"
                    className="btn-primary full"
                    onClick={() => setToolsOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </aside>
            </>
          )}
        </div>
      )}
    </div>
  )
}
