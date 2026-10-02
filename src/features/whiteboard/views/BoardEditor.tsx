import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Download, Maximize, Minus, MoreHorizontal, MousePointer2, Plus, Copy, Keyboard, Star } from 'lucide-react'
import { Avatar, Button, Kbd, Menu, Modal, Tooltip } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { cn, timeAgo, uid } from '@/lib/utils'
import type { Board, WbElement } from '../types'
import { isBoardStarred, useWhiteboard } from '../store'
import { useBoardEditor } from '../canvas/useBoardEditor'
import { Canvas, type CanvasApi } from '../canvas/Canvas'
import { Toolbar } from '../canvas/Toolbar'
import { StylePanel } from '../canvas/StylePanel'
import { Collaborators, COLLAB_COLORS, type Collaborator } from '../canvas/Collaborators'
import { RealCursors, useRemoteCursors } from '../canvas/RealCursors'
import { isSyncLeader, useSyncStatus } from '@/lib/sync'
import { isDemoWorkspace } from '@/lib/workspace'
import { STICKY_COLORS } from '../canvas/geometry'
import { exportBoardPng } from '../canvas/exportPng'
import { ImageDialog } from '../components/ImageDialog'
import { SharePopover } from '../components/SharePopover'

const EDITOR_CSS = `
@keyframes wb-pop { 0% { transform: scale(.4); opacity: 0 } 65% { transform: scale(1.06); opacity: 1 } 100% { transform: scale(1) } }
.wb-pop { animation: wb-pop .42s cubic-bezier(.2,.9,.3,1.3) both; }
.wb-select .wb-box:hover { outline: 2px solid rgb(var(--accent) / .45); outline-offset: 3px; border-radius: 4px; }
.wb-select .wb-frame-title:hover { box-shadow: 0 0 0 2px rgb(var(--accent) / .5); }
`

export function BoardEditor({ board }: { board: Board }) {
  const ed = useBoardEditor(board)
  const live = useWhiteboard((s) => s.boards.find((b) => b.id === board.id)) ?? board
  const updateBoard = useWhiteboard((s) => s.updateBoard)
  const toggleStar = useWhiteboard((s) => s.toggleStar)
  const duplicateBoard = useWhiteboard((s) => s.duplicateBoard)
  const meId = useCore((s) => s.currentUserId)
  const theme = useCore((s) => s.theme)
  const navigate = useNavigate()
  const api = useRef<CanvasApi>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)
  const [imageOpen, setImageOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [cursorsOn, setCursorsOn] = useState(true)
  const [name, setName] = useState(board.name)

  useEffect(() => setName(live.name), [live.name])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Real members on this board (live cursors over the sync server)
  const remoteCursors = useRemoteCursors(board.id)
  const online = useSyncStatus((s) => s.online)
  const serverMode = useSyncStatus((s) => s.mode === 'server')
  // Simulated teammates only liven up an otherwise empty board: never alongside real collaborators,
  // never as a member who is really online, and only on one client (the sync leader).
  const simulate = isDemoWorkspace() && remoteCursors.length === 0 && (!serverMode || isSyncLeader())
  const collaborators = useMemo<Collaborator[]>(() => {
    if (!simulate) return []
    const notLive = (id: string) => id !== meId && !online.includes(id)
    const pool = board.memberIds.filter(notLive)
    const ids = (pool.length >= 2 ? pool : ['u_fe', 'u_design', 'u_pm', 'u_design2', 'u_mkt'].filter(notLive)).slice(0, 3)
    return ids.map((userId, i) => ({ userId, color: COLLAB_COLORS[i % COLLAB_COLORS.length], stickyFill: STICKY_COLORS[(i * 2 + 1) % STICKY_COLORS.length].fill }))
  }, [board.memberIds, meId, simulate, online])

  const openImage = useCallback(() => setImageOpen(true), [])

  const addImage = (url: string) => {
    const c = api.current?.center() ?? { x: 0, y: 0 }
    const place = (w: number, h: number) => {
      const el: WbElement = { id: uid('el'), type: 'image', x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h, src: url, bornAt: Date.now() }
      ed.add([el])
      ed.setTool('select')
    }
    const img = new Image()
    img.onload = () => {
      const w = 360
      place(w, Math.round((w * img.naturalHeight) / Math.max(1, img.naturalWidth)))
    }
    img.onerror = () => place(360, 240)
    img.src = url
  }

  const commitName = () => {
    const n = name.trim()
    if (n && n !== live.name) updateBoard(board.id, { name: n })
    else setName(live.name)
  }

  const doExport = async () => {
    try {
      await exportBoardPng(ed.elsRef.current, live.name, theme === 'dark')
      toast('PNG로 내보냈어요', { emoji: '🖼️', variant: 'success' })
    } catch {
      toast('내보내기에 실패했어요', { variant: 'error' })
    }
  }

  const zoomPct = Math.round(ed.view.zoom * 100)
  // Layout is driven by the editor's own width (the app sidebar may be expanded or collapsed).
  const compact = width < 980
  const showSaved = width >= 1000
  const showOnline = width >= 1100
  const showHint = width >= 1320

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <style>{EDITOR_CSS}</style>
      <Canvas
        ed={ed}
        apiRef={api}
        onImageTool={openImage}
        worldChildren={
          <>
            <Collaborators ed={ed} collaborators={collaborators} enabled={cursorsOn && collaborators.length > 0} />
            <RealCursors ed={ed} boardId={board.id} cursors={remoteCursors} visible={cursorsOn} />
          </>
        }
      />

      {/* ───── top-left: board identity ───── */}
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong absolute left-4 top-4 z-20 flex items-center gap-1 rounded-2xl p-1.5 pr-3 shadow-float"
      >
        <Tooltip content="보드 목록" side="bottom">
          <Button size="icon-sm" variant="ghost" onClick={() => navigate('/whiteboard')}><ArrowLeft className="h-4 w-4" /></Button>
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-line/10" />
        <span className="text-lg">{live.emoji}</span>
        {/* auto-width title: an invisible mirror span sizes the grid cell, the input fills it */}
        <span className={cn('relative inline-grid min-w-[72px]', compact ? 'max-w-[200px]' : 'max-w-[300px]')}>
          <span aria-hidden className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre px-1.5 py-1 text-sm font-semibold">{name || ' '}</span>
          <input
            size={1}
            value={name}
            aria-label="보드 이름"
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') { e.stopPropagation(); setName(live.name); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()) }
            }}
            className="col-start-1 row-start-1 w-full min-w-0 truncate rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-fg outline-none transition hover:bg-line/[0.06] focus:bg-line/[0.08]"
          />
        </span>
        <Tooltip content={isBoardStarred(live) ? '즐겨찾기 해제' : '즐겨찾기'} side="bottom">
          <button onClick={() => toggleStar(board.id)} className="rounded-md p-1 text-subtle transition hover:text-amber-500 dark:hover:text-amber-400">
            <Star className={cn('h-4 w-4', isBoardStarred(live) && 'fill-amber-400 text-amber-500 dark:text-amber-400')} />
          </button>
        </Tooltip>
        {showSaved && (
          <span className="ml-1 flex items-center gap-1 whitespace-nowrap text-[11px] text-subtle">
            <Check className="h-3 w-3 text-success" /> 저장됨 · {timeAgo(ed.savedAt)}
          </span>
        )}
      </motion.div>

      {/* ───── top-right: presence + actions ───── */}
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="glass-strong absolute right-4 top-4 z-20 flex items-center gap-2 rounded-2xl p-1.5 pl-3 shadow-float"
      >
        <div className="flex items-center -space-x-1.5">
          <Tooltip content="나" side="bottom">
            <div className="rounded-full ring-2 ring-accent"><Avatar userId={meId} size="sm" /></div>
          </Tooltip>
          {remoteCursors.map((c) => (
            <Tooltip key={c.userId} content="지금 이 보드를 함께 보고 있어요" side="bottom">
              <div className="rounded-full" style={{ boxShadow: `0 0 0 2px ${c.color}` }}><Avatar userId={c.userId} size="sm" /></div>
            </Tooltip>
          ))}
          {cursorsOn && collaborators.map((c) => (
            <Tooltip key={c.userId} content="보드를 보는 중 (시뮬레이션)" side="bottom">
              <div className="rounded-full" style={{ boxShadow: `0 0 0 2px ${c.color}` }}><Avatar userId={c.userId} size="sm" /></div>
            </Tooltip>
          ))}
        </div>
        {showOnline && (
          <span className="whitespace-nowrap text-[11px] text-muted">
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {remoteCursors.length + (cursorsOn ? collaborators.length : 0) + 1}명 접속 중
          </span>
        )}
        <div className="h-5 w-px bg-line/10" />
        <Tooltip content="PNG로 내보내기" side="bottom">
          <Button size="icon-sm" variant="ghost" onClick={doExport}><Download className="h-4 w-4" /></Button>
        </Tooltip>
        <Menu
          trigger={<Button size="icon-sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>}
          items={[
            { label: cursorsOn ? '팀원 커서 숨기기' : '팀원 커서 표시', icon: <MousePointer2 />, onClick: () => setCursorsOn((v) => !v) },
            { label: '화면에 맞추기', icon: <Maximize />, shortcut: '⇧1', onClick: () => api.current?.fit() },
            { label: '보드 복제', icon: <Copy />, onClick: () => { const id = duplicateBoard(board.id); if (id) { toast('보드를 복제했어요', { emoji: '📋', variant: 'success' }); navigate(`/whiteboard/${id}`) } } },
            { divider: true, label: '' },
            { label: '단축키 보기', icon: <Keyboard />, onClick: () => setHelpOpen(true) },
          ]}
        />
        <SharePopover board={live} />
      </motion.div>

      <StylePanel ed={ed} width={width} />
      <Toolbar ed={ed} onImage={openImage} compact={compact} />

      {/* ───── zoom controls (vertical stack on narrow editors so it never collides with the centred toolbar) ───── */}
      <div className={cn('glass-strong absolute bottom-5 right-4 z-20 flex items-center gap-0.5 rounded-2xl p-1 shadow-float', compact && 'flex-col')}>
        <Tooltip content="확대 (+)" side={compact ? 'left' : 'top'}><Button size="icon-sm" variant="ghost" onClick={() => api.current?.zoomBy(1.25)}><Plus className="h-4 w-4" /></Button></Tooltip>
        <Tooltip content="100%로 (⇧0)" side={compact ? 'left' : 'top'}>
          <button onClick={() => api.current?.zoomTo(1)} className={cn('text-center font-semibold tabular-nums text-muted transition hover:text-fg', compact ? 'w-8 py-0.5 text-[10px]' : 'w-14 text-xs')}>{zoomPct}%</button>
        </Tooltip>
        <Tooltip content="축소 (-)" side={compact ? 'left' : 'top'}><Button size="icon-sm" variant="ghost" onClick={() => api.current?.zoomBy(1 / 1.25)}><Minus className="h-4 w-4" /></Button></Tooltip>
        <div className={cn('bg-line/10', compact ? 'my-0.5 h-px w-5' : 'mx-0.5 h-5 w-px')} />
        <Tooltip content="화면에 맞추기 (⇧1)" side={compact ? 'left' : 'top'}><Button size="icon-sm" variant="ghost" onClick={() => api.current?.fit()}><Maximize className="h-4 w-4" /></Button></Tooltip>
      </div>

      {/* ───── hint ───── */}
      {showHint && (
        <div className="pointer-events-none absolute bottom-6 left-4 z-10 flex items-center gap-2 rounded-xl glass px-3 py-1.5 text-[11px] text-subtle">
          <span>{ed.elements.length}개 요소</span>·<span>더블클릭으로 스티키</span>·<span><Kbd>Space</Kbd> + 드래그로 이동</span>
        </div>
      )}

      <ImageDialog open={imageOpen} onClose={() => setImageOpen(false)} onAdd={addImage} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}

const SHORTCUTS: [string, string[]][] = [
  ['선택 / 손 / 스티키', ['V', 'H', 'N']],
  ['사각형 / 원 / 화살표 / 선', ['R', 'O', 'A', 'L']],
  ['텍스트 / 펜 / 지우개 / 이미지', ['T', 'P', 'E', 'I']],
  ['캔버스 이동', ['Space', '드래그']],
  ['확대 / 축소', ['⌘', '휠']],
  ['실행 취소 / 다시 실행', ['⌘Z', '⇧⌘Z']],
  ['복제 / 복사 / 붙여넣기', ['⌘D', '⌘C', '⌘V']],
  ['앞으로 / 뒤로 (맨 앞·뒤 ⇧)', ['⌘]', '⌘[']],
  ['편집 / 삭제', ['Enter', 'Del']],
  ['화면 맞춤 / 100%', ['⇧1', '⇧0']],
]

function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="화이트보드 단축키" size="md">
      <div className="divide-y divide-line/[0.06]">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted">{label}</span>
            <span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}
