import { useEffect, useRef } from 'react'

interface ThanksModalProps {
  open: boolean
  onClose: () => void
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  spin: number
  life: number
}

const COLORS = ['#70f69a', '#070082', '#5c63ff', '#fbbf24', '#f472b6', '#141414', '#ffffff']

function burst(canvas: HTMLCanvasElement, count = 140) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()

  const originX = window.innerWidth / 2
  const originY = window.innerHeight * 0.35
  const particles: Particle[] = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 6 + Math.random() * 12
    return {
      x: originX + (Math.random() - 0.5) * 40,
      y: originY + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35,
      life: 1,
    }
  })

  let raf = 0
  let running = true
  const gravity = 0.28
  const drag = 0.99

  const frame = () => {
    if (!running) return
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    let alive = 0
    for (const p of particles) {
      if (p.life <= 0) continue
      alive++
      p.vx *= drag
      p.vy = p.vy * drag + gravity
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.spin
      p.life -= 0.008

      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.globalAlpha = Math.max(0, p.life)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55)
      ctx.restore()
    }

    if (alive > 0) {
      raf = requestAnimationFrame(frame)
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    }
  }

  raf = requestAnimationFrame(frame)
  window.addEventListener('resize', resize)

  return () => {
    running = false
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
}

export function ThanksModal({ open, onClose }: ThanksModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!open || !canvasRef.current) return
    return burst(canvasRef.current)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="thanks-root" role="dialog" aria-modal="true" aria-labelledby="thanks-title">
      <canvas ref={canvasRef} className="thanks-confetti" aria-hidden="true" />
      <div className="thanks-backdrop" onClick={onClose} />
      <div className="thanks-modal">
        <button
          type="button"
          className="thanks-close icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="thanks-emoji" aria-hidden="true">
          🎉
        </div>
        <h2 id="thanks-title">Your signed PDF is ready</h2>
        <p className="thanks-lead">
          If you like this free tool, consider following me on 𝕏 — it helps a
          lot.
        </p>

        <a
          className="thanks-cta"
          href="https://x.com/jeffreyrossum"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            className="thanks-avatar"
            src="https://vanrossum.dev/images/jeffrey-portrait.webp"
            alt=""
            width={36}
            height={36}
          />
          <span className="thanks-cta-text">
            <strong>Follow @jeffreyrossum</strong>
            <span>on 𝕏 / Twitter</span>
          </span>
          <span className="thanks-cta-arrow" aria-hidden="true">
            →
          </span>
        </a>

        <button type="button" className="btn-ghost thanks-dismiss" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  )
}
