import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Clock, FilePlus, LayoutTemplate, PanelLeft, Plus, Sparkles, Star, TrendingUp } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { Avatar, Button, EmptyState, FadeIn } from '@/components/ui'
import { useCurrentUser } from '@/store/core'
import { useDocs } from '../store'
import { selectTreeVisible, setTreeVisible, useDocsUI } from '../uiStore'
import { useCreateDoc } from '../hooks'
import { excerpt } from '../markdown'
import { TEMPLATES } from '../templates'
import type { Doc } from '../types'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '늦은 밤이에요'
  if (h < 12) return '좋은 아침이에요'
  if (h < 18) return '좋은 오후예요'
  return '좋은 저녁이에요'
}

function DocCard({ doc, i }: { doc: Doc; i: number }) {
  const navigate = useNavigate()
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => navigate(`/docs/${doc.id}`)}
      className="card-hover glass group relative flex flex-col overflow-hidden rounded-2xl text-left"
    >
      <div className="relative h-[72px] overflow-hidden" style={{ background: doc.cover ?? 'rgb(var(--surface-3))' }}>
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110" style={{ background: doc.cover ?? undefined }} />
        {doc.starred && <Star className="absolute right-2.5 top-2.5 h-3.5 w-3.5 fill-amber-300 text-amber-300 drop-shadow" />}
      </div>
      <div className="relative flex flex-1 flex-col px-4 pb-4">
        <span className="-mt-5 mb-1.5 text-[34px] leading-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]">{doc.emoji || '📄'}</span>
        <span className="truncate text-[14px] font-semibold">{doc.title || '제목 없음'}</span>
        <span className="mt-1 line-clamp-2 min-h-[34px] text-[12px] leading-[17px] text-subtle">{excerpt(doc.content, 80) || '비어 있는 페이지'}</span>
        <span className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
          <Avatar userId={doc.lastEditedBy} size="xs" />
          {timeAgo(doc.updatedAt)}
        </span>
      </div>
    </motion.button>
  )
}

export function DocsHome() {
  const navigate = useNavigate()
  const me = useCurrentUser()
  const docs = useDocs((s) => s.docs)
  const recentIds = useDocs((s) => s.recentIds)
  const openTemplates = useDocsUI((s) => s.openTemplates)
  const treeVisible = useDocsUI(selectTreeVisible)
  const createDoc = useCreateDoc()

  const recent = useMemo(() => recentIds.map((id) => docs.find((d) => d.id === id)).filter((d): d is Doc => !!d).slice(0, 8), [recentIds, docs])
  const starred = useMemo(() => docs.filter((d) => d.starred), [docs])
  const updated = useMemo(() => [...docs].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 6), [docs])
  const weekCount = docs.filter((d) => Date.now() - +new Date(d.updatedAt) < 7 * 864e5).length

  return (
    <div className="h-full overflow-y-auto">
      {!treeVisible && (
        <button onClick={() => setTreeVisible(true)} title="페이지 목록 열기" className="absolute left-3 top-3 z-10 rounded-lg p-1.5 text-subtle hover:bg-line/10 hover:text-fg">
          <PanelLeft className="h-4 w-4" />
        </button>
      )}
      <div className="mx-auto max-w-[1200px] px-6 py-7 lg:px-10">
        {/* hero */}
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl border border-line/10 bg-[#0d0b1f] p-8 shadow-float md:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgb(var(--accent)/0.55),transparent_45%),radial-gradient(circle_at_85%_10%,rgb(var(--accent-3)/0.45),transparent_40%),radial-gradient(circle_at_60%_100%,rgb(var(--accent-2)/0.45),transparent_50%)]" />
            <div className="noise absolute inset-0" />
            <div className="absolute -right-10 -top-16 text-[220px] leading-none opacity-[0.12] blur-[1px] select-none">📚</div>
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
                <Sparkles className="h-3 w-3" /> 오로라랩스 지식 베이스
              </div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-white md:text-[40px] md:leading-[1.1]">
                {greeting()}, {me?.name.slice(1)}님 👋
              </h1>
              <p className="mt-2 max-w-lg text-[15px] text-white/75">팀의 지식과 결정을 한곳에 모으세요. 블록 에디터, 템플릿, AI 도우미가 함께합니다.</p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={() => openTemplates(null)} className="bg-none bg-white text-zinc-900 shadow-lg hover:bg-white/90">
                  새 페이지
                </Button>
                <Button size="md" leftIcon={<FilePlus className="h-4 w-4" />} onClick={() => createDoc()} className="border border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/20">
                  빈 페이지
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-6 text-white">
                {[
                  { label: '전체 페이지', value: docs.length },
                  { label: '이번 주 업데이트', value: weekCount },
                  { label: '즐겨찾기', value: starred.length },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="font-display text-2xl font-bold">{s.value}</div>
                    <div className="text-[11px] text-white/65">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* recent */}
        <section className="mt-9">
          <h2 className="mb-3.5 flex items-center gap-2 text-[13px] font-semibold text-muted"><Clock className="h-4 w-4" /> 최근 방문한 페이지</h2>
          {recent.length ? (
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
              {recent.map((d, i) => <DocCard key={d.id} doc={d} i={i} />)}
            </div>
          ) : (
            <EmptyState icon={<Clock />} title="최근 방문한 페이지가 없어요" description="페이지를 열면 이곳에 표시됩니다." />
          )}
        </section>

        {/* templates */}
        <section className="mt-10">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-muted"><LayoutTemplate className="h-4 w-4" /> 템플릿으로 시작하기</h2>
            <button onClick={() => openTemplates(null)} className="flex items-center gap-1 text-xs text-subtle hover:text-accent">갤러리 보기 <ArrowRight className="h-3 w-3" /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {TEMPLATES.map((t, i) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                whileHover={{ y: -3 }}
                onClick={() => createDoc({ template: t })}
                className="group relative w-[200px] shrink-0 overflow-hidden rounded-2xl border border-line/10 bg-surface/60 p-4 text-left transition hover:border-accent/40 hover:shadow-glow-sm"
              >
                <div className={cn('absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-25 blur-2xl transition group-hover:opacity-60', t.tint)} />
                <span className={cn('relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-card', t.tint)}>{t.emoji}</span>
                <div className="relative mt-3 text-[13.5px] font-semibold">{t.title}</div>
                <div className="relative mt-0.5 line-clamp-2 text-[11.5px] leading-4 text-subtle">{t.description}</div>
              </motion.button>
            ))}
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* favorites */}
          <section>
            <h2 className="mb-3.5 flex items-center gap-2 text-[13px] font-semibold text-muted"><Star className="h-4 w-4" /> 즐겨찾기</h2>
            <div className="glass rounded-2xl p-2">
              {starred.length === 0 && <div className="px-3 py-8 text-center text-sm text-subtle">별표한 페이지가 여기에 표시돼요 ⭐</div>}
              {starred.map((d) => (
                <button key={d.id} onClick={() => navigate(`/docs/${d.id}`)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-line/[0.05]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg text-lg" style={{ background: d.cover }}>{d.emoji || '📄'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{d.title || '제목 없음'}</span>
                    <span className="block truncate text-[11.5px] text-subtle">{timeAgo(d.updatedAt)} 업데이트</span>
                  </span>
                  <ArrowRight className="h-4 w-4 -translate-x-1 text-subtle opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </section>

          {/* recently updated */}
          <section>
            <h2 className="mb-3.5 flex items-center gap-2 text-[13px] font-semibold text-muted"><TrendingUp className="h-4 w-4" /> 최근 업데이트</h2>
            <div className="glass rounded-2xl p-2">
              {updated.map((d) => (
                <button key={d.id} onClick={() => navigate(`/docs/${d.id}`)} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-line/[0.05]">
                  <Avatar userId={d.lastEditedBy} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px]"><span className="mr-1">{d.emoji}</span><span className="font-medium">{d.title || '제목 없음'}</span></span>
                    <span className="block truncate text-[11.5px] text-subtle">{excerpt(d.content, 70) || '비어 있는 페이지'}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-subtle">{timeAgo(d.updatedAt)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
