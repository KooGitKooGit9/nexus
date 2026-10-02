import { useEffect, useRef } from 'react'
import { useCore } from '@/store/core'

interface Star { x: number; y: number; r: number; phase: number; speed: number; drift: number }
interface Shooting { x: number; y: number; vx: number; vy: number; life: number }

/**
 * Twinkling star / particle field with the occasional shooting star. Theme-aware (uses --fg).
 * Perf: the rAF loop only runs while the tab is visible and the canvas is on screen;
 * with "reduce motion" a single static frame is drawn (redrawn on resize / theme change).
 */
export function Starfield({ density = 0.00018, className }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useCore((s) => s.reduceMotion)
  const theme = useCore((s) => s.theme)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, raf = 0
    let stars: Star[] = []
    let shooting: Shooting | null = null
    let onScreen = true
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const readRgb = () => getComputedStyle(document.documentElement).getPropertyValue('--fg').trim().split(/\s+/).join(',') || '255,255,255'
    let rgb = readRgb()
    let lastRead = 0

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width; h = r.height
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.min(260, Math.max(40, Math.round(w * h * density)))
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.3,
        phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.6, drift: (Math.random() - 0.5) * 0.06,
      }))
    }

    const paint = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      // the theme class flips in a parent effect (after ours) — re-read the color periodically
      if (reduce || t - lastRead > 600) { rgb = readRgb(); lastRead = t }
      for (const s of stars) {
        const a = reduce ? 0.5 : 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(s.phase + (t / 1000) * s.speed))
        if (!reduce) { s.x += s.drift; if (s.x < 0) s.x = w; if (s.x > w) s.x = 0 }
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb},${a * (theme === 'light' ? 0.45 : 0.85)})`
        ctx.fill()
        if (s.r > 1.2) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${rgb},${a * 0.08})`
          ctx.fill()
        }
      }
      if (reduce) return
      if (!shooting && Math.random() < 0.004) {
        shooting = { x: Math.random() * w * 0.7, y: Math.random() * h * 0.3, vx: 6 + Math.random() * 4, vy: 2 + Math.random() * 2, life: 1 }
      }
      if (shooting) {
        const s = shooting
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12)
        g.addColorStop(0, `rgba(${rgb},${0.9 * s.life})`)
        g.addColorStop(1, `rgba(${rgb},0)`)
        ctx.strokeStyle = g
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12)
        ctx.stroke()
        s.x += s.vx; s.y += s.vy; s.life -= 0.018
        if (s.life <= 0 || s.x > w + 50 || s.y > h + 50) shooting = null
      }
    }

    const loop = (t: number) => {
      raf = 0
      paint(t)
      schedule()
    }
    /** (Re)starts the loop only when it should be running. */
    function schedule() {
      if (raf || reduce || !onScreen || document.visibilityState !== 'visible') return
      raf = requestAnimationFrame(loop)
    }
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }

    resize()
    paint(performance.now())
    // theme flips after this effect runs → repaint the static frame once the new --fg is applied
    const repaint = reduce ? window.setTimeout(() => paint(performance.now()), 60) : 0
    schedule()

    const ro = new ResizeObserver(() => { resize(); paint(performance.now()) })
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true
      if (onScreen) schedule()
      else stop()
    })
    io.observe(canvas)
    const onVis = () => (document.visibilityState === 'visible' ? schedule() : stop())
    document.addEventListener('visibilitychange', onVis)

    return () => {
      stop()
      window.clearTimeout(repaint)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [density, reduce, theme])

  return <canvas ref={ref} aria-hidden className={className} style={{ width: '100%', height: '100%' }} />
}
