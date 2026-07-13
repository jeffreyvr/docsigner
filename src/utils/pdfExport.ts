import { PDFDocument } from 'pdf-lib'
import type { Placement } from '../types'

export async function exportSignedPdf(
  originalPdfBytes: ArrayBuffer,
  placements: Placement[],
  signatureDataUrl: string | null,
  initialsDataUrl: string | null,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes)
  const pages = pdfDoc.getPages()

  const signatureImage = signatureDataUrl
    ? await pdfDoc.embedPng(await dataUrlToBytes(signatureDataUrl))
    : null
  const initialsImage = initialsDataUrl
    ? await pdfDoc.embedPng(await dataUrlToBytes(initialsDataUrl))
    : null

  for (const placement of placements) {
    const page = pages[placement.pageIndex]
    if (!page) continue

    const image =
      placement.type === 'signature' ? signatureImage : initialsImage
    if (!image) continue

    const { width: pageWidth, height: pageHeight } = page.getSize()
    const stampWidth = placement.width * pageWidth
    const stampHeight = placement.height * pageHeight
    // PDF origin is bottom-left; our coords are top-left normalized
    const x = placement.x * pageWidth
    const y = pageHeight - placement.y * pageHeight - stampHeight

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
