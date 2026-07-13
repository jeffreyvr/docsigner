import { useCallback, useEffect, useRef, useState } from 'react'

interface SignaturePadProps {
  label: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  width?: number
  height?: number
}

async function fileToPngDataUrl(file: File): Promise<string> {
  // Keep PNG bytes as-is so transparency and quality are preserved
  if (file.type === 'image/png') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(file)
    })
  }

  // Convert other image types to PNG for pdf-lib
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not process image')
  }
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  return canvas.toDataURL('image/png')
}

function drawImageContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  const scale = Math.min(
    canvasWidth / img.naturalWidth,
    canvasHeight / img.naturalHeight,
  )
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  const x = (canvasWidth - w) / 2
  const y = (canvasHeight - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

export function SignaturePad({
  label,
  value,
  onChange,
  width = 320,
  height = 120,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const [isEmpty, setIsEmpty] = useState(!value)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return { canvas, ctx }
  }, [])

  const clearCanvas = useCallback(() => {
    const pair = getCtx()
    if (!pair) return
    const { canvas, ctx } = pair
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    setIsEmpty(true)
    setUploadError(null)
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [getCtx, onChange])

  // Preview existing value on the canvas
  useEffect(() => {
    const pair = getCtx()
    if (!pair) return
    const { canvas, ctx } = pair

    if (value) {
      const img = new Image()
      img.onload = () => {
        drawImageContained(ctx, img, canvas.width, canvas.height)
        hasInk.current = true
        setIsEmpty(false)
      }
      img.src = value
    } else if (!hasInk.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [value, getCtx])

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pair = getCtx()
    if (!pair) return
    const { ctx } = pair
    const { x, y } = pos(e)
    drawing.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const pair = getCtx()
    if (!pair) return
    const { x, y } = pos(e)
    pair.ctx.lineTo(x, y)
    pair.ctx.stroke()
    hasInk.current = true
    setIsEmpty(false)
  }

  const finishStroke = () => {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    if (!canvas || !hasInk.current) return
    onChange(canvas.toDataURL('image/png'))
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError(null)
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file (PNG preferred).')
      e.target.value = ''
      return
    }

    try {
      const dataUrl = await fileToPngDataUrl(file)
      hasInk.current = true
      setIsEmpty(false)
      onChange(dataUrl)
    } catch {
      setUploadError('Could not load that image. Try a PNG instead.')
    }
  }

  return (
    <div className="sig-pad">
      <div className="sig-pad-header">
        <span className="sig-pad-label">{label}</span>
        <div className="sig-pad-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload PNG
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={clearCanvas}
            disabled={isEmpty}
          >
            Clear
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/*"
            onChange={(e) => void onUpload(e)}
            hidden
          />
        </div>
      </div>
      <div className="sig-pad-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="sig-pad-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
        />
        {isEmpty && (
          <span className="sig-pad-hint">Draw or upload a PNG</span>
        )}
      </div>
      {uploadError && <p className="sig-pad-error">{uploadError}</p>}
    </div>
  )
}
