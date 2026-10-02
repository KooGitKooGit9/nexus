import { Check, Copy, Link2, Mail } from 'lucide-react'
import type { Invite } from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { absoluteUrl, useCopy } from './lib'

/** Generated invite links with copy buttons (shared by onboarding and the members settings). */
export function InviteLinkList({ invites, className }: { invites: Invite[]; className?: string }) {
  const { copied, copy } = useCopy()
  return (
    <ul className={cn('space-y-2', className)}>
      {invites.map((inv) => {
        const url = absoluteUrl(inv.url)
        const on = copied === inv.token
        return (
          <li key={inv.token} className="rounded-2xl border border-line/10 bg-line/[0.03] p-3">
            <div className="flex items-center gap-2 text-[12.5px]">
              {inv.email ? <Mail className="h-3.5 w-3.5 shrink-0 text-accent" /> : <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" />}
              <span className="min-w-0 flex-1 truncate font-medium">{inv.email ?? '링크로 누구나 참여'}</span>
              <span className="shrink-0 text-[11px] text-subtle">{formatDate(inv.expiresAt, 'M월 d일')}까지</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="초대 링크" className="input-base h-9 min-w-0 flex-1 font-mono text-[11.5px]" />
              <button
                type="button"
                onClick={() => void copy(url, inv.token)}
                className={cn('focus-ring flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-medium transition', on ? 'border-success/40 bg-success/10 text-success' : 'border-line/15 hover:border-accent/50 hover:bg-accent/5')}
              >
                {on ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {on ? '복사됨' : '복사'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
