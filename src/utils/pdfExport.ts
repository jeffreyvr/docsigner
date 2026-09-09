import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Placement } from '../types'

export async function exportSignedPdf(
  originalPdfBytes: ArrayBuffer,
  placements: Placement[],
  signatureDataUrl: string | null,
  initialsDataUrl: string | null,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes)
  const pages = pdfDoc.getPages()
  const textFont = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const signatureImage = signatureDataUrl
    ? await pdfDoc.embedPng(await dataUrlToBytes(signatureDataUrl))
    : null
  const initialsImage = initialsDataUrl
    ? await pdfDoc.embedPng(await dataUrlToBytes(initialsDataUrl))
    : null

  for (const placement of placements) {
    const page = pages[placement.pageIndex]
    if (!page) continue

    const { width: pageWidth, height: pageHeight } = page.getSize()
    const stampWidth = placement.width * pageWidth
    const stampHeight = placement.height * pageHeight
    // PDF origin is bottom-left; our coords are top-left normalized
    const x = placement.x * pageWidth
    const y = pageHeight - placement.y * pageHeight - stampHeight

    if (placement.type === 'text') {
      const text = placement.text?.trim()
      if (!text) continue
      const pad = stampHeight * 0.12
      const fontSize = Math.max(7, stampHeight * 0.48)
      page.drawText(text, {
        x: x + pad,
        y: y + stampHeight - pad - fontSize,
        size: fontSize,
        font: textFont,
        color: rgb(0.08, 0.08, 0.08),
        maxWidth: Math.max(1, stampWidth - pad * 2),
        lineHeight: fontSize * 1.25,
      })
      continue
    }

    const image =
      placement.type === 'signature' ? signatureImage : initialsImage
    if (!image) continue

    page.drawImage(image, {
      x,
      y,
      width: stampWidth,
      height: stampHeight,
    })
  }

  return pdfDoc.save()
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl)
  const buf = await res.arrayBuffer()
  return new Uint8Array(buf)
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
