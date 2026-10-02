import { useEffect, useRef, useState } from 'react'

/** Tweens from the previous value to `value` with an ease-out curve. */
export function AnimatedNumber({ value, duration = 900, decimals = 0, suffix = '', className }: { value: number; duration?: number; decimals?: number; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      const v = a + (value - a) * e
      setDisplay(v)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])
  const text = decimals ? display.toFixed(decimals) : Math.round(display).toLocaleString('ko-KR')
  return (
    <span className={className}>
      {text}
      {suffix}
    </span>
  )
}
