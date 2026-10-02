import type { WbElement } from '../types'
import { arrowHead, autoFontSize, boundsOf, smoothPath } from './geometry'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Greedy character-based wrap (good enough for KR/EN mixed text). */
function wrap(text: string, maxW: number, fs: number): string[] {
  const out: string[] = []
  text.split('\n').forEach((para) => {
    let line = ''
    let w = 0
    for (const ch of para) {
      const cw = /[ㄱ-힝]/.test(ch) ? fs * 0.92 : /[A-Z0-9]/.test(ch) ? fs * 0.62 : fs * 0.52
      if (w + cw > maxW && line) { out.push(line); line = ''; w = 0 }
      line += ch
      w += cw
    }
    out.push(line)
  })
  return out
}

function textBlock(text: string, cx: number, cy: number, maxW: number, fs: number, color: string, anchor: 'middle' | 'start' = 'middle', weight = 600, family = 'Pretendard Variable, sans-serif', top?: number) {
  const lines = wrap(text, maxW, fs)
  const lh = fs * 1.3
  const startY = top !== undefined ? top + fs : cy - ((lines.length - 1) * lh) / 2 + fs * 0.35
  return `<text font-family="${family}" font-size="${fs}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${lines
    .map((l, i) => `<tspan x="${cx}" y="${startY + i * lh}">${esc(l)}</tspan>`)
    .join('')}</text>`
}

export function boardToSvg(elements: WbElement[], dark: boolean) {
  const b = boundsOf(elements) ?? { x: 0, y: 0, w: 400, h: 300 }
  const pad = 80
  const ink = dark ? '#eceef8' : '#0f1222'
  const bg = dark ? '#0b0c16' : '#f6f7fb'
  const col = (c?: string) => (!c || c === 'ink' ? ink : c)
  const parts: string[] = []
  elements.forEach((el) => {
    const cx = el.x + el.w / 2
    const cy = el.y + el.h / 2
    switch (el.type) {
      case 'frame':
        parts.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="28" fill="${el.fill}" fill-opacity="0.07" stroke="${el.fill}" stroke-opacity="0.35" stroke-width="2"/>`)
        parts.push(`<rect x="${el.x + 20}" y="${el.y + 16}" width="${Math.min(el.w - 40, (el.text?.length ?? 4) * 17 + 34)}" height="36" rx="18" fill="${el.fill}" fill-opacity="0.18"/>`)
        parts.push(textBlock(el.text ?? '', el.x + 37, 0, 9999, 17, el.fill ?? ink, 'start', 700, undefined, el.y + 22))
        break
      case 'sticky': {
        const fs = el.fontSize ?? autoFontSize(el.text, el.w, el.h)
        parts.push(`<g transform="rotate(${el.rotation ?? 0} ${cx} ${cy})"><rect x="${el.x}" y="${el.y + 6}" width="${el.w}" height="${el.h}" rx="3" fill="#000" fill-opacity="0.15"/><rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="3" fill="${el.fill}"/>${textBlock(el.text ?? '', cx, cy, el.w - 28, fs, '#1f2937', 'middle', 700, 'Gaegu, cursive')}</g>`)
        break
      }
      case 'rect':
      case 'ellipse': {
        const fill = el.fill && el.fill !== 'none' ? el.fill : 'none'
        parts.push(
          el.type === 'rect'
            ? `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="14" fill="${fill}" fill-opacity="0.2" stroke="${col(el.stroke)}" stroke-width="${el.strokeWidth ?? 2}"/>`
            : `<ellipse cx="${cx}" cy="${cy}" rx="${el.w / 2}" ry="${el.h / 2}" fill="${fill}" fill-opacity="0.2" stroke="${col(el.stroke)}" stroke-width="${el.strokeWidth ?? 2}"/>`,
        )
        if (el.text) parts.push(textBlock(el.text, cx, cy, el.w - 24, el.fontSize ?? 18, ink))
        break
      }
      case 'text':
        parts.push(textBlock(el.text ?? '', el.x, 0, el.w, el.fontSize ?? 20, col(el.stroke), 'start', (el.fontSize ?? 20) >= 28 ? 700 : 500, undefined, el.y))
        break
      case 'line':
      case 'arrow': {
        const c = col(el.stroke)
        parts.push(`<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" stroke="${c}" stroke-width="${el.strokeWidth ?? 2}" stroke-linecap="round"/>`)
        if (el.type === 'arrow') parts.push(`<polygon points="${arrowHead(el.x, el.y, el.x + el.w, el.y + el.h, Math.max(10, (el.strokeWidth ?? 2) * 4))}" fill="${c}"/>`)
        break
      }
      case 'path':
        parts.push(`<path transform="translate(${el.x} ${el.y})" d="${smoothPath(el.points ?? [])}" fill="none" stroke="${col(el.stroke)}" stroke-width="${el.strokeWidth ?? 3}" stroke-linecap="round" stroke-linejoin="round"/>`)
        break
      case 'image':
        parts.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="12" fill="${ink}" fill-opacity="0.08" stroke="${ink}" stroke-opacity="0.2" stroke-dasharray="6 6"/>`)
        parts.push(textBlock('🖼️ 이미지', cx, cy, el.w, 16, ink))
        break
    }
  })
  const W = b.w + pad * 2
  const H = b.h + pad * 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${b.x - pad} ${b.y - pad} ${W} ${H}"><rect x="${b.x - pad}" y="${b.y - pad}" width="${W}" height="${H}" fill="${bg}"/>${parts.join('')}</svg>`
  return { svg, width: W, height: H }
}

export async function exportBoardPng(elements: WbElement[], name: string, dark: boolean) {
  const { svg, width, height } = boardToSvg(elements, dark)
  // cap the bitmap at ~4096px on the long edge (8000² RGBA ≈ 256MB would stall low-memory machines)
  const scale = Math.min(2, 4096 / Math.max(width, height))
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('svg load failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    const a = document.createElement('a')
    a.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
