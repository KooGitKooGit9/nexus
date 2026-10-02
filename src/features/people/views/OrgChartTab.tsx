import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Maximize2, Minus, Plus, ChevronsDownUp, ChevronsUpDown, Move } from 'lucide-react'
import { useCore } from '@/store/core'
import type { User } from '@/store/types'
import { Avatar, Button, Tooltip, Kbd } from '@/components/ui'
import { cn, clamp } from '@/lib/utils'
import { DEPT_META, DEPARTMENTS, deptMeta, managerChain } from '../lib'
import { DEPT_TEXT_CLS, deptVar } from '../components/common'
import { isHuman } from '@/features/people/format'

const NODE_W = 216
const NODE_H = 92
const GAP_X = 28
const GAP_Y = 76
/** Shared tween for node positions and connector paths so they stay glued together while animating. */
const NODE_MOVE = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }

interface LaidOut {
  user: User
  x: number
  y: number
  depth: number
  childCount: number
  parentId: string | null
  /** Rendered in a vertical stack under its manager (compact leaf group). */
  stacked: boolean
}

const STACK_INDENT = 36
const STACK_GAP = 14

/**
 * Compact tidy tree. Managers are centred over their sub-trees; a manager whose visible reports
 * are all leaves gets them stacked vertically (indented under the manager) instead of spread
 * horizontally — keeps the chart readable without zooming far out.
 */
function layoutTree(users: User[], collapsed: Set<string>) {
  const byManager = new Map<string | null, User[]>()
  const ids = new Set(users.map((u) => u.id))
  users.forEach((u) => {
    const key = u.managerId && ids.has(u.managerId) ? u.managerId : null
    if (!byManager.has(key)) byManager.set(key, [])
    byManager.get(key)!.push(u)
  })
  const kidsOf = (id: string) => (collapsed.has(id) ? [] : (byManager.get(id) ?? []))
  const isLeaf = (id: string) => kidsOf(id).length === 0
  const nodes: LaidOut[] = []
  let cursor = 0
  const place = (u: User, depth: number, y: number, parentId: string | null): number => {
    const kids = kidsOf(u.id)
    const childCount = (byManager.get(u.id) ?? []).length
    let x: number
    if (kids.length === 0) {
      x = cursor
      cursor += NODE_W + GAP_X
    } else if (kids.length >= 2 && kids.every((k) => isLeaf(k.id))) {
      x = cursor
      kids.forEach((k, i) => {
        nodes.push({
          user: k, x: x + STACK_INDENT, y: y + NODE_H + GAP_Y / 2 + i * (NODE_H + STACK_GAP), depth: depth + 1,
          childCount: (byManager.get(k.id) ?? []).length, parentId: u.id, stacked: true,
        })
      })
      cursor += NODE_W + STACK_INDENT + GAP_X
    } else {
      const xs = kids.map((k) => place(k, depth + 1, y + NODE_H + GAP_Y, u.id))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    nodes.push({ user: u, x, y, depth, childCount, parentId, stacked: false })
    return x
  }
  ;(byManager.get(null) ?? []).forEach((r) => place(r, 0, 0, null))
  const width = Math.max(NODE_W, ...nodes.map((n) => n.x + NODE_W))
  const height = Math.max(NODE_H, ...nodes.map((n) => n.y + NODE_H))
  return { nodes, width, height }
}

/** Connector path. Always the same command structure (M L Q L Q L) so `d` can tween between layouts. */
function connectorPath(p: LaidOut, n: LaidOut) {
  if (n.stacked) {
    const xr = p.x + STACK_INDENT / 2
    const y1 = p.y + NODE_H
    const cy = n.y + NODE_H / 2
    const r = 12
    return `M ${xr} ${y1} L ${xr} ${cy - r} Q ${xr} ${cy} ${xr + r} ${cy} L ${n.x} ${cy} Q ${n.x} ${cy} ${n.x} ${cy} L ${n.x} ${cy}`
  }
  const x1 = p.x + NODE_W / 2
  const y1 = p.y + NODE_H
  const x2 = n.x + NODE_W / 2
  const y2 = n.y
  const my = y1 + GAP_Y / 2
  const r = Math.min(14, Math.abs(x2 - x1) / 2)
  const dir = x2 > x1 ? 1 : -1
  return `M ${x1} ${y1} L ${x1} ${my - r} Q ${x1} ${my} ${x1 + dir * r} ${my} L ${x2 - dir * r} ${my} Q ${x2} ${my} ${x2} ${my + r} L ${x2} ${y2}`
}

export function OrgChartTab() {
  const allUsers = useCore((s) => s.users)
  const users = useMemo(() => allUsers.filter(isHuman), [allUsers])
  const usedDepts = useMemo(() => DEPARTMENTS.filter((d) => users.some((u) => u.department === d)), [users])
  const flat = users.length > 1 && !users.some((u) => u.managerId && users.some((x) => x.id === u.managerId))
  const meId = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 40, k: 0.9 })
  const viewRef = useRef(view)
  viewRef.current = view
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null)
  const [grabbing, setGrabbing] = useState(false)

  const { nodes, width, height } = useMemo(() => layoutTree(users, collapsed), [users, collapsed])
  const byId = useMemo(() => new Map(nodes.map((n) => [n.user.id, n])), [nodes])
  const highlight = useMemo(() => new Set(hover ? managerChain(users, hover) : []), [hover, users])

  const fit = useCallback(() => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    // leave room for the bottom control/hint bars (~56px)
    const k = clamp(Math.min((r.width - 80) / Math.max(width, 1), (r.height - 130) / Math.max(height, 1)), 0.35, 1.1)
    setView({ k, x: (r.width - width * k) / 2, y: Math.max(28, (r.height - 56 - height * k) / 2) })
  }, [width, height])

  // fit on mount, and again after "모두 펼치기 / 모두 접기" changes the chart size
  const fitted = useRef(false)
  const refit = useRef(false)
  useEffect(() => {
    if (nodes.length === 0) return
    if (fitted.current && !refit.current) return
    fitted.current = true
    refit.current = false
    fit()
  }, [fit, nodes.length])

  // wheel zoom (non-passive so we can preventDefault)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
        const k = clamp(v.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), 0.3, 2)
        const px = e.clientX - r.left
        const py = e.clientY - r.top
        setView({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = (f: number) => {
    const el = box.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const v = viewRef.current
    const k = clamp(v.k * f, 0.3, 2)
    const px = r.width / 2
    const py = r.height / 2
    setView({ k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k })
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (e.buttons === 0) { drag.current = null; return }
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) > 3) {
      d.moved = true
      setGrabbing(true)
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* pointer already released */ }
    }
    if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }))
  }
  const onPointerUp = () => {
    setGrabbing(false)
    setTimeout(() => (drag.current = null), 0)
  }

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const managers = useMemo(() => users.filter((u) => users.some((x) => x.managerId === u.id)).map((u) => u.id), [users])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {flat && <span className="text-subtle">구성원 프로필에 매니저를 지정하면 조직도가 계층으로 그려져요.</span>}
          {usedDepts.map((d) => (
            <span key={d} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: DEPT_META[d].color, boxShadow: `0 0 8px ${DEPT_META[d].color}` }} />
              {d}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="xs" variant="ghost" leftIcon={<ChevronsUpDown className="h-3.5 w-3.5" />} onClick={() => { refit.current = collapsed.size > 0; setCollapsed(new Set()) }}>모두 펼치기</Button>
          <Button size="xs" variant="ghost" leftIcon={<ChevronsDownUp className="h-3.5 w-3.5" />} onClick={() => {
            const next = new Set(managers.filter((m) => m !== users.find((u) => !u.managerId)?.id))
            refit.current = next.size !== collapsed.size || [...next].some((id) => !collapsed.has(id))
            setCollapsed(next)
          }}>모두 접기</Button>
        </div>
      </div>

      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn('glass relative h-[calc(100vh-360px)] min-h-[440px] overflow-hidden rounded-3xl select-none touch-none', grabbing ? 'cursor-grabbing' : 'cursor-grab')}
      >
        <div
          className="dot-bg pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundSize: `${22 * view.k}px ${22 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
        />
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width, height }}>
          {/* connectors */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={width} height={height}>
            <defs>
              <linearGradient id="org-hl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--accent))" />
                <stop offset="100%" stopColor="rgb(var(--accent-2))" />
              </linearGradient>
            </defs>
            {nodes.map((n) => {
              if (!n.parentId) return null
              const p = byId.get(n.parentId)
              if (!p) return null
              const d = connectorPath(p, n)
              const hl = highlight.has(n.user.id) && highlight.has(p.user.id)
              return (
                <g key={n.user.id}>
                  <motion.path
                    fill="none"
                    initial={{ d, pathLength: 0, opacity: 0 }}
                    animate={{ d, pathLength: 1, opacity: 1 }}
                    transition={{ d: NODE_MOVE, pathLength: { duration: 0.6, delay: n.depth * 0.08 }, opacity: { duration: 0.3, delay: n.depth * 0.08 } }}
                    stroke={hl ? 'url(#org-hl)' : 'rgb(var(--line) / 0.16)'}
                    strokeWidth={hl ? 2.5 : 1.5}
                    style={hl ? { filter: 'drop-shadow(0 0 6px rgb(var(--accent) / 0.8))' } : undefined}
                  />
                </g>
              )
            })}
          </svg>

          {nodes.map((n) => (
            <OrgNode
              key={n.user.id}
              node={n}
              isMe={n.user.id === meId}
              highlighted={highlight.has(n.user.id)}
              dimmed={!!hover && !highlight.has(n.user.id)}
              collapsed={collapsed.has(n.user.id)}
              onHover={setHover}
              onToggle={() => toggle(n.user.id)}
              onOpen={() => { if (!drag.current?.moved) navigate(`/people/${n.user.id}`) }}
            />
          ))}
        </div>

        {/* controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-2xl glass-strong p-1 shadow-float" onPointerDown={(e) => e.stopPropagation()}>
          <Tooltip content="축소"><Button size="icon-sm" variant="ghost" onClick={() => zoomBy(1 / 1.2)}><Minus className="h-4 w-4" /></Button></Tooltip>
          <button className="w-12 text-center text-xs font-medium tabular-nums text-muted hover:text-fg" onClick={() => setView((v) => ({ ...v, k: 1 }))}>{Math.round(view.k * 100)}%</button>
          <Tooltip content="확대"><Button size="icon-sm" variant="ghost" onClick={() => zoomBy(1.2)}><Plus className="h-4 w-4" /></Button></Tooltip>
          <div className="mx-0.5 h-5 w-px bg-line/10" />
          <Tooltip content="화면에 맞추기"><Button size="icon-sm" variant="ghost" onClick={fit}><Maximize2 className="h-4 w-4" /></Button></Tooltip>
        </div>
        <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-[calc(100%-240px)] items-center gap-2 truncate rounded-xl glass px-3 py-1.5 text-[11px] text-subtle md:flex">
          <Move className="h-3.5 w-3.5" /> 드래그로 이동 · <Kbd>휠</Kbd> 확대/축소 · 노드 클릭 시 프로필
        </div>
      </div>
    </div>
  )
}

function OrgNode({
  node, isMe, highlighted, dimmed, collapsed, onHover, onToggle, onOpen,
}: {
  node: LaidOut; isMe: boolean; highlighted: boolean; dimmed: boolean; collapsed: boolean
  onHover: (id: string | null) => void; onToggle: () => void; onOpen: () => void
}) {
  const { user: u } = node
  const color = deptMeta(u.department).color
  return (
    <motion.div
      className="absolute"
      initial={{ opacity: 0, scale: 0.9, x: node.x, y: node.y }}
      animate={{ opacity: dimmed ? 0.45 : 1, scale: 1, x: node.x, y: node.y }}
      transition={{ x: NODE_MOVE, y: NODE_MOVE, scale: NODE_MOVE, opacity: { duration: 0.2 } }}
      style={{ width: NODE_W, height: NODE_H }}
      onMouseEnter={() => onHover(u.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        onClick={onOpen}
        className={cn(
          'relative flex h-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border bg-surface/90 px-3.5 backdrop-blur-xl transition-all duration-200',
          highlighted ? 'border-accent/60 shadow-glow' : 'border-line/10 shadow-card hover:border-line/25',
        )}
      >
        <div className="absolute inset-y-0 left-0 w-1" style={{ background: color, boxShadow: `0 0 12px ${color}` }} />
        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-25 blur-2xl" style={{ background: color }} />
        <Avatar user={u} size="lg" showPresence />
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg">{u.name}</span>
            {isMe && <span className="rounded bg-accent/20 px-1 text-[9px] font-bold text-accent">나</span>}
          </div>
          <div className="truncate text-xs text-muted">{u.title}</div>
          <div className={cn('mt-1 flex items-center gap-1 text-[10px] font-medium', DEPT_TEXT_CLS)} style={deptVar(color)}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
            {u.department}
          </div>
        </div>
      </div>
      {node.childCount > 0 && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          className={cn(
            'absolute -bottom-3 left-1/2 z-10 flex h-6 -translate-x-1/2 items-center gap-0.5 rounded-full border px-2 text-[10px] font-semibold transition-all',
            collapsed ? 'border-transparent bg-accent-gradient text-white shadow-glow-sm' : 'border-line/15 bg-surface-2 text-muted hover:text-fg hover:border-accent/40',
          )}
        >
          {node.childCount}
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
      )}
    </motion.div>
  )
}
