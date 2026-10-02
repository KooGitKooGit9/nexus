import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { CheckCheck, Megaphone, Pin, Plus, Search } from 'lucide-react'
import { Page } from '@/app/Page'
import { Avatar, Button, Card, EmptyState, FadeIn, Input, PageHeader, Switch } from '@/components/ui'
import { useCore } from '@/store/core'
import { cn, timeAgo } from '@/lib/utils'
import { useGoals } from '@/features/goals/store'
import type { AnnouncementCategory } from '@/features/goals/types'
import { Ring } from '@/features/goals/components/Ring'
import { CATEGORIES, CATEGORY_META } from './meta'
import { AnnouncementCard } from './components/AnnouncementCard'
import { AnnouncementDetail } from './components/AnnouncementDetail'
import { Composer } from './components/Composer'

type Filter = '전체' | AnnouncementCategory

export default function AnnouncementsPage() {
  const [params, setParams] = useSearchParams()
  const announcements = useGoals((s) => s.announcements)
  const markAllRead = useGoals((s) => s.markAllRead)
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const userCount = users.length
  const [filter, setFilter] = useState<Filter>('전체')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [q, setQ] = useState('')
  const openId = params.get('id')
  const composerOpen = params.get('new') === '1'

  const setParam = useCallback(
    (k: string, v: string | null) =>
      setParams((p) => {
        const n = new URLSearchParams(p)
        if (v === null) n.delete(k)
        else n.set(k, v)
        return n
      }, { replace: true }),
    [setParams],
  )

  const sorted = useMemo(
    () => [...announcements].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt)),
    [announcements],
  )
  const list = sorted.filter(
    (a) =>
      (filter === '전체' || a.category === filter) &&
      (!unreadOnly || !a.readBy.includes(me)) &&
      (!q.trim() || [a.title, a.body, a.category, users.find((u) => u.id === a.authorId)?.name ?? ''].join('\n').toLowerCase().includes(q.trim().toLowerCase())),
  )
  const pinned = list.filter((a) => a.pinned)
  const rest = list.filter((a) => !a.pinned)
  const unreadCount = announcements.filter((a) => !a.readBy.includes(me)).length
  const readRate = announcements.length ? Math.round(((announcements.length - unreadCount) / announcements.length) * 100) : 100
  const orgRate = announcements.length
    ? Math.round((announcements.reduce((a, x) => a + x.readBy.length, 0) / (announcements.length * userCount)) * 100)
    : 0

  useEffect(() => {
    if (!openId) return
    // stale/deleted link → drop the param instead of leaving an invisible "open" state
    if (!announcements.some((a) => a.id === openId)) {
      setParam('id', null)
      return
    }
    document.getElementById(`ann-${openId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const counts = (c: Filter) => (c === '전체' ? announcements.length : announcements.filter((a) => a.category === c).length)

  return (
    <Page wide>
      <PageHeader
        icon={<Megaphone />}
        title="공지사항"
        subtitle={`오로라랩스 전사 소식 · 안 읽은 공지 ${unreadCount}개`}
        actions={
          <>
            <Button variant="ghost" size="sm" leftIcon={<CheckCheck className="h-4 w-4" />} onClick={markAllRead} disabled={!unreadCount}>
              모두 읽음
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>
              공지 작성
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {(['전체', ...CATEGORIES] as Filter[]).map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  filter === c ? 'border-transparent bg-accent-gradient text-white shadow-glow-sm' : 'border-line/10 text-muted hover:border-accent/40 hover:text-fg',
                )}
              >
                {c !== '전체' && <span>{CATEGORY_META[c].emoji}</span>}
                {c}
                <span className={cn('text-[10px]', filter === c ? 'text-white/80' : 'text-subtle')}>{counts(c)}</span>
              </button>
            ))}
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                <Switch size="sm" checked={unreadOnly} onChange={setUnreadOnly} /> 안 읽은 공지만
              </label>
              <div className="w-48">
                <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="공지 검색" className="h-8 py-1 text-xs" />
              </div>
            </div>
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title={unreadOnly ? '모든 공지를 확인했어요 🎉' : '공지가 없습니다'}
              description={unreadOnly ? '새 소식이 올라오면 알려드릴게요.' : '첫 공지를 작성해 팀에 소식을 전하세요.'}
              action={!unreadOnly && <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setParam('new', '1')}>공지 작성</Button>}
            />
          ) : (
            <div className="space-y-4">
              {pinned.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
                  <Pin className="h-3.5 w-3.5" /> 고정된 공지
                </div>
              )}
              <AnimatePresence initial={false}>
                {pinned.map((a) => (
                  <AnnouncementCard key={a.id} a={a} highlighted={openId === a.id} onOpen={() => setParam('id', a.id)} />
                ))}
              </AnimatePresence>
              {pinned.length > 0 && rest.length > 0 && <div className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">최근 공지</div>}
              <AnimatePresence initial={false}>
                {rest.map((a) => (
                  <AnnouncementCard key={a.id} a={a} highlighted={openId === a.id} onOpen={() => setParam('id', a.id)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <FadeIn delay={0.05}>
            <Card spotlight>
              <div className="flex items-center gap-4">
                <Ring value={readRate} size={76} stroke={8}>
                  <span className="font-display text-lg font-bold">{readRate}%</span>
                </Ring>
                <div>
                  <div className="text-sm font-semibold text-fg">내 확인율</div>
                  <div className="mt-0.5 text-xs text-muted">{announcements.length - unreadCount}/{announcements.length}개 공지 확인</div>
                  <div className="mt-2 text-[11px] text-subtle">전사 평균 확인율 <span className="font-semibold text-fg">{orgRate}%</span></div>
                </div>
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card>
              <h3 className="mb-3 text-sm font-semibold">안 읽은 공지</h3>
              {unreadCount === 0 ? (
                <p className="py-4 text-center text-xs text-subtle">모두 확인했어요 ✨</p>
              ) : (
                <ul className="space-y-1">
                  {sorted.filter((a) => !a.readBy.includes(me)).slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <button onClick={() => setParam('id', a.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-line/[0.05]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: a.cover }}>{a.emoji ?? CATEGORY_META[a.category].emoji}</span>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] text-fg">{a.title}</div>
                          <div className="text-[11px] text-subtle">{a.category} · {timeAgo(a.createdAt)}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </FadeIn>

          <FadeIn delay={0.15}>
            <Card>
              <h3 className="mb-3 text-sm font-semibold">카테고리</h3>
              <div className="space-y-2.5">
                {CATEGORIES.map((c) => {
                  const n = counts(c)
                  const pct = announcements.length ? (n / announcements.length) * 100 : 0
                  return (
                    <button key={c} onClick={() => setFilter(c)} className="block w-full text-left">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted">{CATEGORY_META[c].emoji} {c}</span>
                        <span className="tabular-nums text-subtle">{n}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-line/10">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: CATEGORY_META[c].color }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
          </FadeIn>

          <FadeIn delay={0.2}>
            <Card>
              <h3 className="mb-3 text-sm font-semibold">최근 작성자</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(sorted.map((a) => a.authorId))).slice(0, 6).map((id) => (
                  <Avatar key={id} userId={id} size="md" showPresence />
                ))}
              </div>
            </Card>
          </FadeIn>
        </aside>
      </div>

      <AnnouncementDetail id={openId} onClose={() => setParam('id', null)} />
      <Composer open={composerOpen} onClose={() => setParam('new', null)} onPublished={(id) => setTimeout(() => setParam('id', id), 80)} />
    </Page>
  )
}
