import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, Info, MessageSquare, PanelRightClose, Star, Trash2, UserPlus, X, Eye, Pencil, Upload, Share2 } from 'lucide-react'
import { cn, formatBytes, formatDate, hashIndex, minutesAgo, timeAgo } from '@/lib/utils'
import { Avatar, AvatarStack, Tooltip, UnderlineTabs } from '@/components/ui'
import { useCore } from '@/store/core'
import { pathOf, useFiles } from '../store'
import { useDriveUI } from '../uiStore'
import { KIND_META, kindOf } from '../fileTypes'
import { downloadItems, useItemActions } from '../hooks'
import type { FileItem } from '../types'
import { FileIcon } from './FileGlyph'
import { MockPreview } from './MockPreviews'
import { RealPreview } from './RealPreview'

function useActivity(item: FileItem | undefined) {
  const users = useCore((s) => s.users)
  return useMemo(() => {
    if (!item) return []
    // Uploaded files: only what really happened (no invented comments / views)
    if (item.url) {
      const acts = [{ icon: Upload, userId: item.ownerId, text: '파일을 업로드했습니다', at: item.createdAt, tone: 'text-accent' }]
      if (item.sharedWith?.length)
        acts.push({ icon: Share2, userId: item.ownerId, text: `${item.sharedWith.map((id) => users.find((u) => u.id === id)?.name ?? '팀원').join(', ')}님과 공유 중`, at: item.updatedAt, tone: 'text-info' })
      return acts
    }
    const pool = [...(item.sharedWith ?? []), ...users.map((u) => u.id)].filter((id) => id !== item.ownerId)
    const pickU = (i: number) => pool[hashIndex(item.id + i, pool.length)]
    const age = Math.max(60, (Date.now() - +new Date(item.createdAt)) / 60000)
    const acts = [
      { icon: Upload, userId: item.ownerId, text: '파일을 업로드했습니다', at: item.createdAt, tone: 'text-accent' },
      { icon: Share2, userId: item.ownerId, text: `${users.find((u) => u.id === pickU(1))?.name ?? '팀원'}님과 공유했습니다`, at: minutesAgo(age * 0.8), tone: 'text-info' },
      { icon: MessageSquare, userId: pickU(2), text: '“확인했어요! 몇 가지 코멘트 남겼습니다 👍”', at: minutesAgo(age * 0.55), tone: 'text-accent-3' },
      { icon: Pencil, userId: pickU(3), text: '새 버전을 업로드했습니다', at: item.updatedAt, tone: 'text-warning' },
      { icon: Eye, userId: pickU(4), text: '파일을 열람했습니다', at: minutesAgo(Math.min(age * 0.2, 90)), tone: 'text-success' },
    ]
    return acts.sort((a, b) => +new Date(b.at) - +new Date(a.at))
  }, [item, users])
}

export function PreviewModal({ siblings }: { siblings: FileItem[] }) {
  const previewId = useDriveUI((s) => s.previewId)
  const setPreviewId = useDriveUI((s) => s.setPreviewId)
  const files = useFiles((s) => s.files)
  const toggleStar = useFiles((s) => s.toggleStar)
  const users = useCore((s) => s.users)
  const { trash } = useItemActions()
  const item = files.find((f) => f.id === previewId)
  const [panel, setPanel] = useState(true)
  const [tab, setTab] = useState<'info' | 'activity'>('info')
  const activity = useActivity(item)

  const list = siblings.filter((f) => f.kind === 'file')
  const idx = item ? list.findIndex((f) => f.id === item.id) : -1
  const go = (d: number) => {
    if (idx < 0 || !list.length) return
    const next = list[(idx + d + list.length) % list.length]
    useFiles.getState().markOpened(next.id)
    setPreviewId(next.id)
    useDriveUI.getState().setSelected([next.id], next.id)
  }

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      // a dialog opened on top (e.g. share) handles its own keys
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'Escape') setPreviewId(null)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const kind = item ? kindOf(item) : 'other'
  const meta = KIND_META[kind]
  const location = item ? pathOf(files, item.parentId) : []
  const owner = users.find((u) => u.id === item?.ownerId)

  return createPortal(
    <AnimatePresence>
      {item && (
        <motion.div className="fixed inset-0 z-[80] flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="absolute inset-0 bg-[#05060c]/85 backdrop-blur-xl" onClick={() => setPreviewId(null)} />

          {/* top bar */}
          <div className="relative z-10 flex h-14 shrink-0 items-center gap-3 px-4 text-white">
            <button onClick={() => setPreviewId(null)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            <FileIcon item={item} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{item.name}</span>
                {!item.url && (
                  <Tooltip content="데모용 시드 파일이라 실제 내용이 없어요. 미리보기는 예시이며, 다운로드하면 안내 파일을 받아요." side="bottom">
                    <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/80">샘플 파일</span>
                  </Tooltip>
                )}
              </div>
              <div className="text-[11px] text-white/50">{meta.label}{item.size ? ` · ${formatBytes(item.size)}` : ''}{list.length > 1 && idx >= 0 ? ` · ${idx + 1} / ${list.length}` : ''}</div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content={item.starred ? '중요 표시 해제' : '중요 표시'} side="bottom">
                <button onClick={() => toggleStar([item.id])} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white">
                  <Star className={cn('h-[18px] w-[18px]', item.starred && 'fill-amber-400 text-amber-400')} />
                </button>
              </Tooltip>
              <Tooltip content="공유" side="bottom">
                <button onClick={() => useDriveUI.getState().setShareId(item.id)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><UserPlus className="h-[18px] w-[18px]" /></button>
              </Tooltip>
              <Tooltip content="다운로드" side="bottom">
                <button onClick={() => downloadItems([item])} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><Download className="h-[18px] w-[18px]" /></button>
              </Tooltip>
              {!item.trashed && (
                <Tooltip content="휴지통으로 이동" side="bottom">
                  <button onClick={() => { trash([item]); setPreviewId(null) }} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-danger"><Trash2 className="h-[18px] w-[18px]" /></button>
                </Tooltip>
              )}
              <div className="mx-1 h-6 w-px bg-white/15" />
              <Tooltip content={panel ? '세부정보 숨기기' : '세부정보'} side="bottom">
                <button onClick={() => setPanel(!panel)} className={cn('rounded-lg p-2 hover:bg-white/10', panel ? 'text-white' : 'text-white/70')}>
                  {panel ? <PanelRightClose className="h-[18px] w-[18px]" /> : <Info className="h-[18px] w-[18px]" />}
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1">
            {/* stage */}
            <div className="relative min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={item.id}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  {item.url ? <RealPreview item={item} /> : <MockPreview item={item} />}
                </motion.div>
              </AnimatePresence>
              {list.length > 1 && idx >= 0 && (
                <>
                  <button onClick={() => go(-1)} className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:scale-105 hover:bg-white/20">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button onClick={() => go(1)} className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition hover:scale-105 hover:bg-white/20">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {/* side panel */}
            <AnimatePresence initial={false}>
              {panel && (
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 340, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                  className="m-3 ml-0 hidden shrink-0 overflow-hidden rounded-2xl glass-strong md:block"
                >
                  <div className="w-[340px] p-5">
                    <div className="mb-4 flex h-28 items-center justify-center rounded-xl" style={{ background: `radial-gradient(circle at 50% 30%, ${meta.color}40, transparent 70%)` }}>
                      <FileIcon item={item} className="h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" />
                    </div>
                    <UnderlineTabs value={tab} onChange={setTab} items={[{ value: 'info', label: '세부정보' }, { value: 'activity', label: '활동', count: activity.length }]} />
                    {tab === 'info' ? (
                      <div className="mt-4 space-y-3.5 text-[13px]">
                        {[
                          ['유형', item.url ? meta.label : `${meta.label} · 샘플 파일 (데모 데이터)`],
                          ['크기', item.size ? `${formatBytes(item.size)} (${item.size.toLocaleString()} 바이트)` : '—'],
                          ['위치', ['내 드라이브', ...location.map((f) => f.name)].join(' › ')],
                          ['수정한 날짜', `${formatDate(item.updatedAt, 'yyyy년 M월 d일 HH:mm')}`],
                          ['생성한 날짜', formatDate(item.createdAt, 'yyyy년 M월 d일')],
                          ...(item.lastOpenedAt ? [['마지막으로 연 날짜', timeAgo(item.lastOpenedAt)]] : []),
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div className="text-[11px] font-medium text-subtle">{k}</div>
                            <div className="mt-0.5 text-fg/90">{v}</div>
                          </div>
                        ))}
                        <div>
                          <div className="text-[11px] font-medium text-subtle">소유자</div>
                          <div className="mt-1 flex items-center gap-2"><Avatar userId={item.ownerId} size="sm" /> <span>{owner?.name}</span> <span className="text-xs text-subtle">{owner?.title}</span></div>
                        </div>
                        <div>
                          <div className="text-[11px] font-medium text-subtle">액세스 권한</div>
                          <div className="mt-1.5 flex items-center gap-2">
                            {item.sharedWith?.length ? <AvatarStack userIds={item.sharedWith} size="sm" max={5} /> : <span className="text-muted">비공개 · 나만 볼 수 있음</span>}
                            <button onClick={() => useDriveUI.getState().setShareId(item.id)} className="ml-auto rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10">관리</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line/10">
                        {activity.map((a, i) => {
                          const u = users.find((x) => x.id === a.userId)
                          return (
                            <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="relative flex gap-3">
                              <span className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 ring-4 ring-surface', a.tone)}>
                                <a.icon className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1 text-[12.5px]">
                                <div className="flex items-center gap-1.5"><Avatar userId={a.userId} size="xs" /><span className="font-medium">{u?.name}</span></div>
                                <div className="mt-0.5 text-muted">{a.text}</div>
                                <div className="mt-0.5 text-[11px] text-subtle">{timeAgo(a.at)}</div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
