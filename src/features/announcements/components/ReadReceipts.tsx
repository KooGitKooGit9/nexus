import { Eye } from 'lucide-react'
import { Avatar, AvatarStack, Popover } from '@/components/ui'
import { useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import { isHuman } from '@/features/people/format'

/** "읽음 9/14" with avatar stack; popover lists who has / hasn't read. */
export function ReadReceipts({ readBy, className }: { readBy: string[]; className?: string }) {
  const users = useCore((s) => s.users).filter(isHuman)
  const read = users.filter((u) => readBy.includes(u.id))
  const unread = users.filter((u) => !readBy.includes(u.id))
  const pct = users.length ? Math.round((read.length / users.length) * 100) : 0

  return (
    <Popover
      placement="top-start"
      className="w-72 p-0"
      trigger={({ toggle }) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggle() }}
          className={cn('flex items-center gap-2 rounded-full border border-line/10 py-1 pl-1 pr-2.5 text-xs text-muted transition hover:border-accent/40 hover:text-fg', className)}
        >
          <AvatarStack userIds={read.map((u) => u.id)} max={4} size="xs" />
          <Eye className="h-3.5 w-3.5" />
          <span className="tabular-nums">읽음 {read.length}/{users.length}</span>
        </button>
      )}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line/10 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-fg">읽음 확인</span>
            <span className="text-muted">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/10">
            <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          <Section title={`읽음 ${read.length}`} ids={read.map((u) => u.id)} names={read.map((u) => [u.name, u.title])} />
          {unread.length > 0 && <Section title={`안 읽음 ${unread.length}`} ids={unread.map((u) => u.id)} names={unread.map((u) => [u.name, u.title])} dim />}
        </div>
      </div>
    </Popover>
  )
}

function Section({ title, ids, names, dim }: { title: string; ids: string[]; names: [string, string][]; dim?: boolean }) {
  return (
    <div className="mb-1">
      <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">{title}</div>
      {ids.map((id, i) => (
        <div key={id} className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-line/[0.05]', dim && 'opacity-60')}>
          <Avatar userId={id} size="sm" showPresence />
          <div className="min-w-0">
            <div className="truncate text-[13px] text-fg">{names[i][0]}</div>
            <div className="truncate text-[11px] text-subtle">{names[i][1]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
