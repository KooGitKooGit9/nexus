import { useMemo, useState } from 'react'
import { Cake, PartyPopper } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import { burstConfetti } from '@/features/goals/lib'
import { Widget, MiniEmpty } from '../components/Widget'

interface Item { userId: string; kind: 'birthday' | 'anniversary'; day: number; years?: number }

export function Celebrations({ className, delay }: { className?: string; delay?: number }) {
  const users = useCore((s) => s.users)
  const [sent, setSent] = useState<string[]>([])
  const now = new Date()
  const month = now.getMonth() + 1
  const today = now.getDate()

  const items = useMemo(() => {
    const out: Item[] = []
    for (const u of users) {
      const [bm, bd] = u.birthday.split('-').map(Number)
      if (bm === month) out.push({ userId: u.id, kind: 'birthday', day: bd })
      const j = new Date(u.joinedAt)
      if (j.getMonth() + 1 === month && j.getFullYear() < now.getFullYear()) out.push({ userId: u.id, kind: 'anniversary', day: j.getDate(), years: now.getFullYear() - j.getFullYear() })
    }
    return out.sort((a, b) => (a.day >= today ? 0 : 1) - (b.day >= today ? 0 : 1) || a.day - b.day)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, month, today])

  const celebrate = (it: Item, name: string) => {
    burstConfetti()
    setSent((s) => [...s, `${it.userId}-${it.kind}`])
    toast(it.kind === 'birthday' ? `${name}님께 생일 축하를 보냈어요 🎂` : `${name}님께 입사 ${it.years}주년 축하를 보냈어요 🎉`, { variant: 'success', actorId: it.userId })
  }

  return (
    <Widget className={className} delay={delay} title="생일 · 입사 기념일" subtitle={`${month}월 · ${items.length}명`} icon={<Cake />} gradient="from-pink-500 to-rose-600">
      {items.length === 0 ? (
        <MiniEmpty emoji="🎈" title={`${month}월에는 기념일이 없어요`} />
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 5).map((it) => {
            const u = users.find((x) => x.id === it.userId)!
            const isToday = it.day === today
            const past = it.day < today
            const key = `${it.userId}-${it.kind}`
            return (
              <li
                key={key}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-2 py-1.5',
                  isToday && 'bg-gradient-to-r from-pink-500/15 via-amber-400/10 to-transparent ring-1 ring-pink-400/30',
                  past && 'opacity-50',
                )}
              >
                <div className="relative">
                  <Avatar userId={u.id} size="sm" />
                  <span className="absolute -bottom-1 -right-1 text-[12px]">{it.kind === 'birthday' ? '🎂' : '🏅'}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-fg">{u.name}</div>
                  <div className="truncate text-[11px] text-subtle">
                    {isToday ? '오늘! ' : `${month}/${it.day} · `}
                    {it.kind === 'birthday' ? '생일' : `입사 ${it.years}주년`}
                  </div>
                </div>
                {isToday && (
                  sent.includes(key) ? (
                    <span className="text-[11px] text-success">보냄 ✓</span>
                  ) : (
                    <Button size="xs" variant="primary" leftIcon={<PartyPopper className="h-3 w-3" />} onClick={() => celebrate(it, u.name)}>
                      축하
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Widget>
  )
}
