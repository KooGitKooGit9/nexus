import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileSignature } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { useCore } from '@/store/core'
import { timeAgo } from '@/lib/utils'
import { useApprovals } from '@/features/approvals/store'
import type { ApprovalKind } from '@/features/approvals/types'
import { pendingOnMe } from '../lib'
import { MiniEmpty, Widget, WidgetLink } from '../components/Widget'

const KIND: Record<ApprovalKind, { emoji: string; label: string }> = {
  leave: { emoji: '🏖️', label: '휴가' },
  expense: { emoji: '💳', label: '경비' },
  purchase: { emoji: '🛒', label: '구매' },
  travel: { emoji: '✈️', label: '출장' },
  access: { emoji: '🔑', label: '권한' },
  general: { emoji: '📄', label: '일반' },
}

export function PendingApprovals({ className, delay }: { className?: string; delay?: number }) {
  const navigate = useNavigate()
  const requests = useApprovals((s) => s.requests)
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const list = useMemo(() => pendingOnMe(requests ?? [], me).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [requests, me])

  return (
    <Widget
      className={className}
      delay={delay}
      title="결재 대기"
      subtitle={list.length ? `내 결재가 필요한 문서 ${list.length}건` : '대기 중인 결재 없음'}
      icon={<FileSignature />}
      gradient="from-pink-500 to-rose-600"
      action={<WidgetLink onClick={() => navigate('/approvals')}>전체 →</WidgetLink>}
    >
      {list.length === 0 ? (
        <MiniEmpty emoji="✅" title="처리할 결재가 없어요" />
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tabular-nums gradient-text">{list.length}</span>
            <span className="text-xs text-muted">건 대기 중</span>
          </div>
          <ul className="space-y-1">
            {list.slice(0, 4).map((r, i) => (
              <motion.li key={r.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (delay ?? 0) + 0.2 + i * 0.05 }}>
                <button onClick={() => navigate(`/approvals?id=${r.id}`)} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-line/[0.05]">
                  <div className="relative">
                    <Avatar userId={r.requesterId} size="sm" />
                    <span className="absolute -bottom-1 -right-1 text-[11px]">{KIND[r.kind]?.emoji ?? '📄'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-fg">{r.title}</div>
                    <div className="truncate text-[11px] text-subtle">
                      {users.find((u) => u.id === r.requesterId)?.name} · {KIND[r.kind]?.label ?? '기타'}
                      {r.amount ? ` · ₩${r.amount.toLocaleString('ko-KR')}` : ''} · {timeAgo(r.createdAt)}
                    </div>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </Widget>
  )
}
