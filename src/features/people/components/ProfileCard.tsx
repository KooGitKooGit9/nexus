import { memo } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Phone, UserRound, MapPin } from 'lucide-react'
import type { User } from '@/store/types'
import { Avatar, Card, PRESENCE_LABEL, Tooltip } from '@/components/ui'
import { cn, gradientFor } from '@/lib/utils'
import { DEPT_META } from '../lib'
import { DeptBadge, LocalTime, useQuickActions } from './common'

const PRESENCE_TEXT: Record<User['presence'], string> = {
  online: 'text-emerald-600 dark:text-emerald-400',
  away: 'text-amber-600 dark:text-amber-400',
  dnd: 'text-rose-600 dark:text-rose-400',
  offline: 'text-subtle',
}

function ActionBtn({ label, onClick, children, primary }: { label: string; onClick: () => void; children: React.ReactNode; primary?: boolean }) {
  return (
    <Tooltip content={label} className="flex-1">
      <button
        onClick={(e) => { e.stopPropagation(); onClick() }}
        className={cn(
          'flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-all',
          primary
            ? 'border-accent/30 bg-accent/15 text-accent hover:bg-accent/25 hover:shadow-glow-sm'
            : 'border-line/10 bg-line/[0.04] text-muted hover:text-fg hover:border-line/20 hover:bg-line/[0.08]',
        )}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export const ProfileCard = memo(function ProfileCard({ user, now, isMe }: { user: User; now: Date; isMe?: boolean }) {
  const qa = useQuickActions()
  const meta = DEPT_META[user.department]
  return (
    <Card hover spotlight padded={false} className="group cursor-pointer" onClick={() => qa.profile(user)}>
      {/* soft department-tinted header */}
      <div className="relative h-20 overflow-hidden">
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-30', gradientFor(user.color ?? user.id))} />
        <div className="absolute -right-6 -top-10 h-28 w-28 rounded-full blur-2xl opacity-60" style={{ background: meta.color }} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface/80" />
        {isMe && <span className="absolute left-3 top-3 rounded-full bg-accent-gradient px-2 py-0.5 text-[10px] font-bold text-white shadow-glow-sm">나</span>}
        <span className={cn('absolute right-3 top-3 flex items-center gap-1 rounded-full bg-surface/75 px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur', PRESENCE_TEXT[user.presence])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {PRESENCE_LABEL[user.presence]}
        </span>
      </div>
      <div className="relative -mt-12 flex flex-col items-center px-5 pb-5 text-center">
        <div className="relative">
          <div className={cn('absolute inset-0 rounded-full bg-gradient-to-br blur-xl opacity-0 transition-opacity duration-500 group-hover:opacity-70', gradientFor(user.color ?? user.id))} />
          <motion.div whileHover={{ scale: 1.04 }} className="relative rounded-full p-1 bg-surface/70 backdrop-blur">
            <Avatar user={user} size="xl" showPresence />
          </motion.div>
        </div>
        <h3 className="mt-3 text-[15px] font-semibold text-fg">{user.name}</h3>
        <p className="text-[11px] text-subtle">{user.nameEn !== user.name ? user.nameEn : user.email}</p>
        <p className="mt-1 text-[13px] text-muted line-clamp-1">{user.title}</p>
        <div className="mt-2.5"><DeptBadge department={user.department} /></div>

        <div className="mt-3 flex h-7 max-w-full items-center gap-1.5 rounded-full bg-line/[0.05] px-3 text-xs text-muted">
          {user.statusEmoji || user.statusText ? (
            <>
              <span>{user.statusEmoji ?? '💬'}</span>
              <span className="truncate">{user.statusText ?? '상태 메시지 없음'}</span>
            </>
          ) : (
            <span className="text-subtle">상태 메시지 없음</span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[11px] text-subtle">
          <LocalTime user={user} now={now} />
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{user.location}</span>
        </div>

        <div className="mt-4 flex w-full gap-1.5">
          <ActionBtn label="메시지 보내기" onClick={() => qa.message(user)} primary>
            <MessageSquare className="h-3.5 w-3.5" />메시지
          </ActionBtn>
          <ActionBtn label="음성 통화" onClick={() => qa.call(user)}>
            <Phone className="h-3.5 w-3.5" />통화
          </ActionBtn>
          <ActionBtn label="프로필 보기" onClick={() => qa.profile(user)}>
            <UserRound className="h-3.5 w-3.5" />프로필
          </ActionBtn>
        </div>
      </div>
    </Card>
  )
})
