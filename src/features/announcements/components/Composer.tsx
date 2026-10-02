import { useEffect, useRef, useState } from 'react'
import { Bold, Code, Eye, Heading2, Italic, List, Pencil, Quote, Send } from 'lucide-react'
import { Button, Field, Input, Modal, Switch, Tabs } from '@/components/ui'
import { toast, getCurrentUserId, getUser, useCore } from '@/store/core'
import { notifyMembers } from '@/app/notifyMembers'
import { cn } from '@/lib/utils'
import { useGoals } from '@/features/goals/store'
import { COVER_PRESETS } from '@/features/goals/seed'
import type { AnnouncementCategory } from '@/features/goals/types'
import { CATEGORIES, CATEGORY_META } from '../meta'
import { Markdown } from './Markdown'
import { Cover } from './AnnouncementCard'

const EMOJIS = ['📢', '🎉', '🚀', '🎤', '👋', '🎁', '🏢', '🔐', '🥂', '🌕', '💡', '🛠️', '📅', '❤️']

const TEMPLATE = `안녕하세요, 여러분!

## 주요 내용
- 첫 번째 안내 사항
- 두 번째 안내 사항

> 궁금한 점은 언제든 문의해주세요.`

export function Composer({ open, onClose, onPublished }: { open: boolean; onClose: () => void; onPublished?: (id: string) => void }) {
  const add = useGoals((s) => s.addAnnouncement)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<AnnouncementCategory>('전사공지')
  const [cover, setCover] = useState<string>(COVER_PRESETS[0])
  const [emoji, setEmoji] = useState('📢')
  const [body, setBody] = useState('')
  const [pinned, setPinned] = useState(false)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const ta = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(''); setCategory('전사공지'); setCover(COVER_PRESETS[0]); setEmoji('📢'); setBody(TEMPLATE); setPinned(false); setTab('write')
    }
  }, [open])

  const wrap = (before: string, after = before, placeholder = '텍스트') => {
    const el = ta.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const sel = body.slice(s, e) || placeholder
    const next = body.slice(0, s) + before + sel + after + body.slice(e)
    setBody(next)
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length) })
  }
  const prefix = (p: string) => {
    const el = ta.current
    if (!el) return
    const s = el.selectionStart
    const lineStart = body.lastIndexOf('\n', s - 1) + 1
    setBody(body.slice(0, lineStart) + p + body.slice(lineStart))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + p.length, s + p.length) })
  }

  const canPublish = title.trim().length > 1 && body.trim().length > 0

  const publish = () => {
    if (!canPublish) return
    const id = add({ title: title.trim(), category, cover, emoji, body: body.trim(), pinned, authorId: getCurrentUserId() })
    const others = useCore.getState().users.map((u) => u.id)
    notifyMembers(others, {
      type: 'system',
      title: `새 공지: ${title.trim()}`,
      body: `${CATEGORY_META[category].emoji} ${category} · ${getUser(getCurrentUserId())?.name ?? ''}`,
      link: `/announcements?id=${id}`,
    })
    toast('공지를 게시했어요', { emoji: '📣', variant: 'success', description: `구성원 ${Math.max(0, others.length - 1)}명에게 알림을 보냈어요` })
    onPublished?.(id)
    onClose()
  }

  const preview = { id: 'preview', title, body, category, cover, emoji, authorId: getCurrentUserId(), createdAt: new Date().toISOString(), reactions: {}, readBy: [] }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="새 공지 작성"
      description="전 구성원에게 알림이 전송됩니다."
      footer={
        <div className="flex w-full items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted">
            <Switch checked={pinned} onChange={setPinned} size="sm" /> 상단 고정
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button variant="primary" leftIcon={<Send className="h-4 w-4" />} onClick={publish} disabled={!canPublish}>게시하기</Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-4">
          <Field label="제목">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: Q4 타운홀 미팅 안내" className="text-base font-medium" />
          </Field>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">카테고리</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); setEmoji(CATEGORY_META[c].emoji) }}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', category === c ? 'border-transparent bg-accent-gradient text-white shadow-glow-sm' : 'border-line/10 text-muted hover:text-fg')}
                >
                  {CATEGORY_META[c].emoji} {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Tabs size="sm" value={tab} onChange={setTab} items={[{ value: 'write', label: '작성', icon: <Pencil /> }, { value: 'preview', label: '미리보기', icon: <Eye /> }]} />
              {tab === 'write' && (
                <div className="flex items-center gap-0.5">
                  {[
                    { icon: <Bold />, fn: () => wrap('**'), t: '굵게' },
                    { icon: <Italic />, fn: () => wrap('*'), t: '기울임' },
                    { icon: <Code />, fn: () => wrap('`', '`', 'code'), t: '코드' },
                    { icon: <Heading2 />, fn: () => prefix('## '), t: '제목' },
                    { icon: <List />, fn: () => prefix('- '), t: '목록' },
                    { icon: <Quote />, fn: () => prefix('> '), t: '인용' },
                  ].map((b) => (
                    <button key={b.t} type="button" title={b.t} onClick={b.fn} className="rounded-md p-1.5 text-subtle transition hover:bg-line/10 hover:text-fg [&>svg]:h-3.5 [&>svg]:w-3.5">
                      {b.icon}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {tab === 'write' ? (
              <textarea
                ref={ta}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="input-base min-h-[280px] resize-y font-mono text-[13px] leading-relaxed"
                placeholder="마크다운으로 작성하세요…"
              />
            ) : (
              <div className="min-h-[280px] rounded-xl border border-line/10 bg-line/[0.02] px-5 py-3">
                {body.trim() ? <Markdown source={body} /> : <p className="py-10 text-center text-sm text-subtle">내용이 없습니다</p>}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-subtle">**굵게**, *기울임*, `코드`, ## 제목, - 목록, &gt; 인용, | 표 | 를 지원합니다.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">커버 미리보기</div>
            <div className="overflow-hidden rounded-2xl border border-line/10">
              <Cover a={preview} className="h-28" />
              <div className="p-3">
                <div className="line-clamp-2 text-sm font-semibold">{title || '제목을 입력하세요'}</div>
                <div className="mt-1 text-[11px] text-subtle">{category} · 방금 전</div>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">커버 그라디언트</div>
            <div className="grid grid-cols-4 gap-2">
              {COVER_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCover(c)}
                  className={cn('h-10 rounded-xl transition hover:scale-105', cover === c && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted">아이콘</div>
            <div className="grid grid-cols-7 gap-1">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-base transition', emoji === e ? 'bg-accent/20 ring-1 ring-accent/50' : 'hover:bg-line/10')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
