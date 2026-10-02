import type { User } from '@/store/types'
import { cn } from '@/lib/utils'
import { hourIn, localTimeLabel, tzDiffHours, tzShortName } from '../lib'

const START = 9
const END = 18

/** Returns [start,end] segments (viewer-local hours, 0–24) for a user's 9–18 working day. */
function segments(diff: number): [number, number][] {
  const s = (((START - diff) % 24) + 24) % 24
  const e = s + (END - START)
  return e <= 24 ? [[s, e]] : [[s, 24], [0, e - 24]]
}

function overlapHours(a: [number, number][], b: [number, number][]) {
  let t = 0
  a.forEach(([s1, e1]) => b.forEach(([s2, e2]) => (t += Math.max(0, Math.min(e1, e2) - Math.max(s1, s2)))))
  return t
}

export function WorkHoursTimeline({ user, me, now }: { user: User; me: User; now: Date }) {
  // Everything is laid out on *my* (the current user's) clock.
  const diff = tzDiffHours(user.timezone, now, me.timezone)
  const theirs = segments(diff)
  const mine = segments(0)
  const isMe = user.id === me.id
  const overlap = overlapHours(theirs, mine)
  const nowH = hourIn(me.timezone, now)
  const rows: { label: string; sub: string; segs: [number, number][]; color: string }[] = [
    { label: user.name, sub: `${tzShortName(user.timezone, now)} · 현지 ${localTimeLabel(user.timezone, now)}`, segs: theirs, color: 'from-violet-500 to-cyan-400' },
  ]
  if (!isMe) rows.push({ label: '나', sub: `${tzShortName(me.timezone, now)} · ${localTimeLabel(me.timezone, now)}`, segs: mine, color: 'from-pink-500 to-amber-400' })

  return (
    <div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[110px_1fr] items-center gap-3">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-fg">{r.label}</div>
              <div className="truncate text-[10px] text-subtle">{r.sub}</div>
            </div>
            <div className="relative h-7 rounded-lg bg-line/[0.06]">
              {[6, 12, 18].map((h) => (
                <div key={h} className="absolute inset-y-0 w-px bg-line/10" style={{ left: `${(h / 24) * 100}%` }} />
              ))}
              {r.segs.map(([s, e], i) => (
                <div
                  key={i}
                  className={cn('absolute inset-y-1 rounded-md bg-gradient-to-r opacity-90 shadow-glow-sm', r.color)}
                  style={{ left: `${(s / 24) * 100}%`, width: `${((e - s) / 24) * 100}%` }}
                />
              ))}
              <div className="absolute -inset-y-1 w-0.5 rounded bg-fg shadow-[0_0_8px_rgb(var(--fg)/0.6)]" style={{ left: `${(nowH / 24) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-[110px_1fr] gap-3">
        <div />
        <div className="flex justify-between text-[10px] tabular-nums text-subtle">
          <span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        {isMe
          ? `기본 근무 시간 09:00 – 18:00 (${tzShortName(me.timezone, now)} 기준)`
          : diff === 0
            ? '같은 시간대에서 근무해요. 근무 시간이 완전히 겹칩니다 ✨'
            : `시차 ${diff > 0 ? '+' : ''}${diff}시간 · 겹치는 근무 시간 ${overlap}시간${overlap === 0 ? ' — 비동기 커뮤니케이션을 추천해요 🌙' : ''}`}
      </p>
    </div>
  )
}
