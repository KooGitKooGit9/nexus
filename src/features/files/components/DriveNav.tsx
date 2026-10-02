import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Cloud, FolderPlus, HardDrive, PanelLeftClose, Plus, Star, Trash2, Upload, Users } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { useWorkspace } from '@/lib/workspace'
import { Menu } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { isFileStarred, useFiles } from '../store'
import { useDriveUI } from '../uiStore'
import { uploadFiles } from '../hooks'
import type { DriveSection } from '../types'
import { SEED_FILES } from '../seed'

const SEED_IDS = new Set(SEED_FILES.map((f) => f.id))

const BASE_USED = 128.4 * 1024 ** 3
const TOTAL = 1024 ** 4
/** workspace storage per plan (keep in sync with LAUNCH.md / the server) */
const PLAN_STORAGE: Record<string, number> = { free: 5 * 1024 ** 3, pro: 100 * 1024 ** 3, business: 1024 ** 4 }

export const SECTIONS: { id: DriveSection; label: string; icon: typeof HardDrive; path: string }[] = [
  { id: 'my', label: '내 드라이브', icon: HardDrive, path: '/files' },
  { id: 'shared', label: '공유 문서함', icon: Users, path: '/files/shared' },
  { id: 'recent', label: '최근 항목', icon: Clock, path: '/files/recent' },
  { id: 'starred', label: '중요 문서함', icon: Star, path: '/files/starred' },
  { id: 'trash', label: '휴지통', icon: Trash2, path: '/files/trash' },
]

export function DriveNav({ section, uploadTarget }: { section: DriveSection; uploadTarget: string | null }) {
  const navigate = useNavigate()
  const files = useFiles((s) => s.files)
  const me = useCore((s) => s.currentUserId)
  const inputRef = useRef<HTMLInputElement>(null)
  const compact = useDriveUI((s) => s.compact)
  const navOpen = useDriveUI((s) => s.navOpen)
  const closeOverlay = () => { if (useDriveUI.getState().navOpen) useDriveUI.getState().setNavOpen(false) }

  const counts = useMemo(() => {
    const live = files.filter((f) => !f.trashed)
    return {
      my: 0,
      shared: live.filter((f) => f.ownerId !== me && f.sharedWith?.includes(me)).length,
      recent: 0,
      starred: live.filter((f) => isFileStarred(f)).length,
      trash: files.filter((f) => f.trashed).length,
    } as Record<DriveSection, number>
  }, [files, me])

  const uploaded = files.filter((f) => f.kind === 'file' && !SEED_IDS.has(f.id)).reduce((s, f) => s + (f.size ?? 0), 0)
  // demo: a lively company drive; real workspaces: what was actually uploaded vs. the plan's quota (LAUNCH.md)
  const ws = useWorkspace()
  const demo = ws.kind === 'demo'
  const total = demo ? TOTAL : PLAN_STORAGE[ws.plan] ?? PLAN_STORAGE.free
  const used = demo ? BASE_USED + uploaded : uploaded
  const pct = (used / total) * 100

  return (
    // Always mounted (the hidden file input must survive the overlay closing while the OS picker is open);
    // in compact mode it slides in over the content.
    <motion.aside
      key={compact ? 'nav-overlay' : 'nav-column'}
      initial={false}
      animate={!compact || navOpen ? { x: 0, visibility: 'visible' as const } : { x: -260, transitionEnd: { visibility: 'hidden' as const } }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden={compact && !navOpen ? true : undefined}
      className={cn(
        'flex h-full w-[232px] shrink-0 flex-col border-r border-line/[0.07] p-3',
        compact ? 'absolute inset-y-0 left-0 z-50 bg-surface/95 shadow-float backdrop-blur-2xl' : 'bg-surface/40 backdrop-blur-xl',
      )}
    >
      {compact && (
        <button onClick={closeOverlay} title="닫기" className="mb-2 flex h-8 w-8 items-center justify-center self-end rounded-lg text-subtle hover:bg-line/10 hover:text-fg">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, uploadTarget); e.target.value = '' }} />
      {/* the Popover anchor is an inline-flex span → stretch it so the button can be full width */}
      <div className="mb-4 [&>span>span]:w-full [&>span]:flex">
      <Menu
        placement="bottom-start"
        className="w-52"
        trigger={
          <button className="group relative flex h-11 w-full items-center gap-2.5 overflow-hidden rounded-2xl px-4 text-sm font-semibold text-white shadow-glow-sm transition hover:shadow-glow">
            <span className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x" />
            <Plus className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
            <span className="relative">새로 만들기</span>
          </button>
        }
        items={[
          { label: '새 폴더', icon: <FolderPlus />, onClick: () => { closeOverlay(); useDriveUI.getState().setNewFolderOpen(true) } },
          { label: '', divider: true },
          { label: '파일 업로드', icon: <Upload />, onClick: () => { inputRef.current?.click(); closeOverlay() } },
        ]}
      />
      </div>

      <nav className="space-y-0.5">
        {SECTIONS.map((s) => {
          const active = section === s.id
          const Icon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => { useDriveUI.getState().clearSelection(); closeOverlay(); navigate(s.path) }}
              className={cn('relative flex h-9 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] transition', active ? 'text-fg' : 'text-muted hover:bg-line/[0.05] hover:text-fg')}
            >
              {active && <motion.span layoutId="drive-nav" className="absolute inset-0 rounded-xl border border-accent/25 bg-accent/[0.12] shadow-glow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              <Icon className={cn('relative h-4 w-4', active && 'text-accent', s.id === 'starred' && active && 'fill-accent/30')} />
              <span className="relative flex-1 text-left">{s.label}</span>
              {counts[s.id] > 0 && <span className="relative text-[11px] tabular-nums text-subtle">{counts[s.id]}</span>}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-line/10 bg-line/[0.03] p-3.5">
        <div className="mb-2.5 flex items-center gap-2 text-[12px] font-medium text-muted">
          <Cloud className="h-4 w-4 text-accent-2" /> 저장 공간
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line/10">
          <motion.div
            className="h-full rounded-full bg-accent-gradient-3 shadow-[0_0_12px_rgb(var(--accent)/0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(2, pct)}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-[12px]"><span className="font-display font-semibold text-fg">{demo ? `${(used / 1024 ** 3).toFixed(1)} GB` : formatBytes(used)}</span> <span className="text-subtle">/ {formatBytes(total)}</span></span>
          <span className="text-[11px] text-subtle">{pct.toFixed(1)}%</span>
        </div>
        {demo && <div className="mt-2.5 flex gap-2.5 text-[10px] text-subtle">
          {[
            { c: '#ef4444', l: '문서' },
            { c: '#06b6d4', l: '미디어' },
            { c: '#a855f7', l: '디자인' },
          ].map((x) => (
            <span key={x.l} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: x.c }} />{x.l}</span>
          ))}
        </div>}
        {demo && uploaded > 0 && <div className="mt-1.5 text-[10px] text-subtle">직접 업로드 {formatBytes(uploaded)}</div>}
        {!demo && pct >= 80 && (
          <button onClick={() => navigate('/settings/billing')} className="mt-2 text-[11px] font-medium text-accent hover:underline">
            {pct >= 100 ? '저장 공간이 가득 찼어요 · 요금제 보기 →' : '저장 공간이 거의 찼어요 · 요금제 보기 →'}
          </button>
        )}
        <button
          onClick={() => toast('저장 공간 업그레이드 요청을 보냈어요', { emoji: '☁️', variant: 'success', description: '워크스페이스 관리자가 검토 후 승인합니다.' })}
          className="mt-3 w-full rounded-lg border border-accent/30 py-1.5 text-[12px] font-medium text-accent transition hover:bg-accent/10">
          저장 공간 업그레이드
        </button>
      </div>
    </motion.aside>
  )
}
