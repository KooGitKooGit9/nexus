import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, MoreHorizontal, PenTool, Pencil, Plus, Search, Star, Trash2, LayoutTemplate, Shapes } from 'lucide-react'
import { Page } from '@/app/Page'
import { AvatarStack, Button, EmptyState, Input, Menu, Modal, PageHeader, Tabs } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { cn, timeAgo } from '@/lib/utils'
import type { Board, TemplateId } from '../types'
import { useWhiteboard } from '../store'
import { buildTemplate, TEMPLATES } from '../templates'
import { BoardThumbnail } from '../components/BoardThumbnail'
import { CreateBoardModal } from '../components/CreateBoardModal'

type Filter = 'all' | 'starred' | 'mine'

export function BoardList() {
  const boards = useWhiteboard((s) => s.boards)
  const createBoard = useWhiteboard((s) => s.createBoard)
  const meId = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [initialTemplate, setInitialTemplate] = useState<TemplateId>('blank')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const previews = useMemo(() => Object.fromEntries(TEMPLATES.map((t) => [t.id, buildTemplate(t.id)])), [])

  useEffect(() => {
    if (params.get('new') === '1') {
      setInitialTemplate('blank')
      setCreateOpen(true)
      const p = new URLSearchParams(params)
      p.delete('new')
      setParams(p, { replace: true })
    }
  }, [params, setParams])

  const shown = useMemo(
    () =>
      boards
        .filter((b) => (filter === 'starred' ? b.starred : filter === 'mine' ? b.ownerId === meId : true))
        .filter((b) => {
          const s = q.trim().toLowerCase()
          if (!s) return true
          return b.name.toLowerCase().includes(s) || !!b.description?.toLowerCase().includes(s) || b.elements.some((e) => !!e.text && e.text.toLowerCase().includes(s))
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [boards, filter, q, meId],
  )

  const create = (v: { name: string; emoji: string; template: TemplateId }) => {
    const id = createBoard(v)
    setCreateOpen(false)
    toast('새 보드를 만들었어요', { emoji: v.emoji, variant: 'success', description: v.name })
    navigate(`/whiteboard/${id}`)
  }

  return (
    <Page wide>
      <PageHeader
        icon={<PenTool />}
        title="화이트보드"
        subtitle="팀과 함께 아이디어를 펼치는 무한 캔버스"
        actions={<Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setInitialTemplate('blank'); setCreateOpen(true) }}>새 보드</Button>}
      />

      {/* templates */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><LayoutTemplate className="h-4 w-4 text-accent" /> 템플릿으로 시작하기</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {TEMPLATES.map((t, i) => (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => { setInitialTemplate(t.id); setCreateOpen(true) }}
              className="group glass relative overflow-hidden rounded-2xl text-left transition-shadow hover:shadow-glow-sm"
            >
              <div className={cn('absolute inset-x-0 top-0 h-24 bg-gradient-to-br opacity-20 transition-opacity group-hover:opacity-35', t.gradient)} />
              <div className="relative h-24">
                {t.id === 'blank' ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-dashed border-line/30 text-muted transition group-hover:scale-110 group-hover:border-accent/60 group-hover:text-accent"><Plus className="h-5 w-5" /></div>
                  </div>
                ) : (
                  <BoardThumbnail elements={previews[t.id]} className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] transition-transform duration-500 group-hover:scale-105" pad={40} />
                )}
              </div>
              <div className="relative border-t border-line/[0.06] p-3">
                <div className="text-[13px] font-semibold text-fg">{t.emoji} {t.name}</div>
                <div className="truncate text-[11px] text-subtle">{t.description}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* boards */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-fg"><Shapes className="h-4 w-4 text-accent" /> 보드 <span className="text-xs font-normal text-subtle">{shown.length}</span></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56 max-w-full"><Input icon={<Search />} placeholder="보드 검색" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 py-1.5" /></div>
            <Tabs<Filter> size="sm" value={filter} onChange={setFilter} items={[{ value: 'all', label: '전체' }, { value: 'starred', label: '즐겨찾기' }, { value: 'mine', label: '내 보드' }]} />
          </div>
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={<PenTool />} title={q ? '검색 결과가 없어요' : filter === 'starred' ? '즐겨찾기한 보드가 없어요' : filter === 'mine' ? '내가 만든 보드가 없어요' : '아직 보드가 없어요'} description="새 보드를 만들어 팀과 아이디어를 펼쳐보세요." action={q || filter !== 'all'
              ? <Button size="sm" onClick={() => { setQ(''); setFilter('all') }}>필터 초기화</Button>
              : <Button variant="primary" size="sm" onClick={() => { setInitialTemplate('blank'); setCreateOpen(true) }}>새 보드</Button>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {shown.map((b, i) => <BoardCard key={b.id} board={b} index={i} />)}
            </AnimatePresence>
          </div>
        )}
      </section>

      <CreateBoardModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={create} initialTemplate={initialTemplate} />
    </Page>
  )
}

function BoardCard({ board, index }: { board: Board; index: number }) {
  const navigate = useNavigate()
  const { toggleStar, duplicateBoard, deleteBoard, updateBoard } = useWhiteboard.getState()
  const starred = useWhiteboard((s) => s.boards.find((b) => b.id === board.id)?.starred)
  const owner = useCore((s) => s.users.find((u) => u.id === board.ownerId))
  const [renaming, setRenaming] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [name, setName] = useState(board.name)
  const cancelRename = useRef(false)
  const startRename = () => { cancelRename.current = false; setName(board.name); setRenaming(true) }
  const finishRename = () => {
    const n = name.trim()
    if (!cancelRename.current && n && n !== board.name) {
      updateBoard(board.id, { name: n })
      toast('보드 이름을 변경했어요', { emoji: '✏️', variant: 'success' })
    }
    cancelRename.current = false
    setRenaming(false)
  }
  const stickies = board.elements.filter((e) => e.type === 'sticky').length

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.04 } }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group glass card-hover relative cursor-pointer overflow-hidden rounded-2xl"
      onClick={() => !renaming && navigate(`/whiteboard/${board.id}`)}
    >
      <div className="dot-bg relative h-44 overflow-hidden border-b border-line/[0.06] bg-surface-2/40">
        <div className="absolute inset-0 bg-gradient-to-t from-surface/60 to-transparent" />
        <BoardThumbnail elements={board.elements} className="absolute inset-3 h-[calc(100%-24px)] w-[calc(100%-24px)] transition-transform duration-500 group-hover:scale-[1.04]" />
        <button
          onClick={(e) => { e.stopPropagation(); toggleStar(board.id) }}
          aria-label={starred ? '즐겨찾기 해제' : '즐겨찾기'}
          className={cn('absolute left-3 top-3 rounded-lg p-1.5 backdrop-blur transition', starred ? 'bg-amber-400/20 text-amber-500 dark:text-amber-400' : 'bg-black/25 text-white/80 opacity-0 hover:text-amber-300 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100')}
        >
          <Star className={cn('h-4 w-4', starred && 'fill-amber-400')} />
        </button>
        <div className="absolute right-3 top-3 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100" onClick={(e) => e.stopPropagation()}>
          <Menu
            trigger={<button className="rounded-lg bg-black/25 p-1.5 text-white/80 backdrop-blur hover:text-white"><MoreHorizontal className="h-4 w-4" /></button>}
            items={[
              { label: '이름 변경', icon: <Pencil />, onClick: startRename },
              { label: '복제', icon: <Copy />, onClick: () => { duplicateBoard(board.id); toast('보드를 복제했어요', { emoji: '📋', variant: 'success' }) } },
              { divider: true, label: '' },
              { label: '삭제', icon: <Trash2 />, danger: true, onClick: () => setConfirmDel(true) },
            ]}
          />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{board.emoji}</span>
          {renaming ? (
            <input
              autoFocus
              value={name}
              aria-label="보드 이름"
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setName(e.target.value)}
              onBlur={finishRename}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') { e.stopPropagation(); cancelRename.current = true; (e.target as HTMLInputElement).blur() }
              }}
              className="input-base h-8 min-w-0 flex-1 py-1 text-sm"
            />
          ) : (
            <h3 className="truncate text-[15px] font-semibold text-fg">{board.name}</h3>
          )}
        </div>
        {board.description && <p className="mt-1 truncate text-xs text-muted">{board.description}</p>}
        <div className="mt-3 flex items-center justify-between">
          <AvatarStack userIds={board.memberIds} max={4} size="xs" />
          <span className="text-[11px] text-subtle">{owner?.name} · {timeAgo(board.updatedAt)} · 스티키 {stickies}</span>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
      <Modal
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        size="sm"
        title="보드를 삭제할까요?"
        description={`"${board.name}" 보드와 모든 요소가 삭제됩니다.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDel(false)}>취소</Button>
            <Button variant="danger" onClick={() => { deleteBoard(board.id); setConfirmDel(false); toast('보드를 삭제했어요', { emoji: '🗑️' }) }}>삭제</Button>
          </>
        }
      />
      </div>
    </motion.div>
  )
}
