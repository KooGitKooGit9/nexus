import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Trophy, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCore } from '@/store/core'
import { Avatar, Button, Card, CardHeader, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { KudosBadge } from '../types'
import { isRecentKudos, KUDOS_BADGES, KUDOS_BADGE_KEYS } from '../lib'
import { usePeople } from '../store'
import { KudosCard } from '../components/KudosCard'
import { Chip } from '../components/common'

export function KudosTab({ onGive }: { onGive: () => void }) {
  const kudos = usePeople((s) => s.kudos)
  const [badge, setBadge] = useState<KudosBadge | 'all'>('all')
  const shown = useMemo(() => kudos.filter((k) => badge === 'all' || k.badge === badge), [kudos, badge])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    kudos.forEach((k) => (c[k.badge] = (c[k.badge] ?? 0) + 1))
    return c
  }, [kudos])

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        {/* hero CTA */}
        <div className="relative overflow-hidden rounded-3xl border border-line/10 p-5">
          <div className="absolute inset-0 bg-accent-gradient-3 opacity-[0.16]" />
          <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-accent-3/30 blur-3xl animate-aurora-1" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-display text-lg font-bold text-fg"><Sparkles className="h-5 w-5 text-accent" /> 오늘 고마웠던 동료가 있나요?</div>
              <p className="mt-1 text-sm text-muted">작은 칭찬 한마디가 팀 문화를 만듭니다. 최근 30일 동안 {kudos.filter((k) => isRecentKudos(k.createdAt)).length}개의 칭찬이 오갔어요.</p>
            </div>
            <Button variant="primary" size="lg" leftIcon={<Heart className="h-4 w-4" />} onClick={onGive}>칭찬 보내기</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip active={badge === 'all'} onClick={() => setBadge('all')} count={kudos.length}>전체</Chip>
          {KUDOS_BADGE_KEYS.map((k) => (
            <Chip key={k} active={badge === k} onClick={() => setBadge(badge === k ? 'all' : k)} color={KUDOS_BADGES[k].from} count={counts[k] ?? 0}>
              {KUDOS_BADGES[k].emoji} #{KUDOS_BADGES[k].label}
            </Chip>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={<Heart />} title="아직 이 배지의 칭찬이 없어요" description="첫 번째 칭찬의 주인공을 만들어 보세요!" action={<Button variant="primary" size="sm" onClick={onGive}>칭찬 보내기</Button>} />
        ) : (
          <div className="columns-1 gap-4 md:columns-2 2xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            <AnimatePresence initial={false}>
              {shown.map((k) => <KudosCard key={k.id} kudos={k} />)}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <Leaderboard />
        <MyKudosStats />
      </div>
    </div>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

function Leaderboard() {
  const kudos = usePeople((s) => s.kudos)
  const users = useCore((s) => s.users)
  const navigate = useNavigate()
  const rows = useMemo(() => {
    const now = new Date()
    const c = new Map<string, { n: number; badges: Record<string, number> }>()
    kudos
      .filter((k) => isRecentKudos(k.createdAt, now))
      .forEach((k) => {
        const e = c.get(k.toId) ?? { n: 0, badges: {} }
        e.n++
        e.badges[k.badge] = (e.badges[k.badge] ?? 0) + 1
        c.set(k.toId, e)
      })
    return [...c.entries()]
      .map(([id, v]) => ({ user: users.find((u) => u.id === id), ...v, top: Object.entries(v.badges).sort((a, b) => b[1] - a[1])[0]?.[0] as KudosBadge | undefined }))
      .filter((r) => r.user)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
  }, [kudos, users])
  const max = rows[0]?.n ?? 1

  return (
    <Card>
      <CardHeader icon={<Trophy className="h-4 w-4" />} title="칭찬 리더보드" subtitle="최근 30일 가장 많은 칭찬을 받은 동료" />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-subtle">최근 30일 동안 받은 칭찬이 없어요</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <motion.button
              key={r.user!.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => navigate(`/people/${r.user!.id}`)}
              className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-line/[0.05]', i === 0 && 'bg-gradient-to-r from-amber-400/10 to-transparent ring-1 ring-amber-400/20')}
            >
              <span className="w-6 text-center text-lg">{MEDALS[i] ?? <span className="text-xs font-bold text-subtle">{i + 1}</span>}</span>
              <Avatar user={r.user!} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-fg">{r.user!.name}</span>
                  <span className="text-xs font-semibold tabular-nums text-fg">{r.n}<span className="ml-0.5 text-subtle">개</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: r.top ? `linear-gradient(90deg, ${KUDOS_BADGES[r.top].from}, ${KUDOS_BADGES[r.top].to})` : undefined }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.n / max) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + i * 0.06 }}
                  />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </Card>
  )
}

function MyKudosStats() {
  const kudos = usePeople((s) => s.kudos)
  const meId = useCore((s) => s.currentUserId)
  const received = kudos.filter((k) => k.toId === meId)
  const sent = kudos.filter((k) => k.fromId === meId)
  const badgeCounts = KUDOS_BADGE_KEYS.map((b) => ({ b, n: received.filter((k) => k.badge === b).length })).filter((x) => x.n > 0)
  return (
    <Card>
      <CardHeader icon={<Heart className="h-4 w-4" />} title="나의 칭찬" />
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
          <div className="text-[11px] text-subtle">받은 칭찬</div>
          <div className="font-display text-2xl font-bold text-fg tabular-nums">{received.length}</div>
        </div>
        <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
          <div className="text-[11px] text-subtle">보낸 칭찬</div>
          <div className="font-display text-2xl font-bold text-fg tabular-nums">{sent.length}</div>
        </div>
      </div>
      {badgeCounts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {badgeCounts.map(({ b, n }) => (
            <span key={b} className="rounded-full border border-line/10 bg-line/[0.04] px-2 py-0.5 text-[11px] text-muted">
              {KUDOS_BADGES[b].emoji} {KUDOS_BADGES[b].label} ×{n}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
