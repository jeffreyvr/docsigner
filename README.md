# DocSigner

**A free tool from [vanrossum.dev](https://vanrossum.dev)** — sign multi-page PDFs entirely in your browser.

Draw your signature, stamp any page, download. Nothing is uploaded — docs stay on your device.

## Features

- Upload a multi-page PDF (drag & drop or file picker)
- Draw your **signature** and **initials**
- Place them on any page by clicking
- Drag to move, corner handle to resize, × to remove
- Download the signed PDF

All processing is client-side — documents never leave your device.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Stack

- React + TypeScript + Vite
- [pdf.js](https://mozilla.github.io/pdf.js/) — render pages
- [pdf-lib](https://pdf-lib.js.org/) — embed stamps into the PDF
