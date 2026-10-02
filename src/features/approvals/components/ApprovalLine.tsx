import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { Check, X, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Tooltip } from '@/components/ui'
import { useCore } from '@/store/core'
import type { ApprovalRequest, ApprovalStep } from '../types'

const STEP_LABEL: Record<ApprovalStep['status'], string> = { waiting: '대기', pending: '진행중', approved: '승인', rejected: '반려' }

function Node({ userId, status, size, label, cancelled }: { userId: string; status: ApprovalStep['status'] | 'draft'; size: 'xs' | 'sm' | 'md'; label: string; cancelled?: boolean }) {
  const user = useCore((s) => s.users.find((u) => u.id === userId))
  const badge = size === 'md' ? 'h-4 w-4 [&>svg]:h-2.5 [&>svg]:w-2.5' : 'h-3.5 w-3.5 [&>svg]:h-2 [&>svg]:w-2'
  return (
    <Tooltip content={<span>{user?.name ?? '나간 멤버'} · <span className="opacity-70">{label}</span></span>}>
      <div className="relative">
        {status === 'pending' && !cancelled && (
          <>
            <span className="absolute -inset-1 rounded-full bg-info/40 animate-pulse-ring" />
            <span className="absolute -inset-[3px] rounded-full ring-2 ring-info" />
          </>
        )}
        <Avatar
          userId={userId}
          size={size}
          className={cn(
            'transition',
            (status === 'waiting' || cancelled) && 'opacity-40 grayscale',
            status === 'approved' && 'ring-2 ring-success rounded-full',
            status === 'rejected' && 'ring-2 ring-danger rounded-full',
            status === 'draft' && 'ring-2 ring-line/20 rounded-full',
          )}
        />
        {status === 'approved' && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }} className={cn('absolute -bottom-0.5 -right-1 flex items-center justify-center rounded-full bg-success text-white ring-2 ring-surface', badge)}>
            <Check strokeWidth={4} />
          </motion.span>
        )}
        {status === 'rejected' && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn('absolute -bottom-0.5 -right-1 flex items-center justify-center rounded-full bg-danger text-white ring-2 ring-surface', badge)}>
            <X strokeWidth={4} />
          </motion.span>
        )}
        {status === 'draft' && (
          <span className={cn('absolute -bottom-0.5 -right-1 flex items-center justify-center rounded-full bg-surface-3 text-muted ring-2 ring-surface', badge)}>
            <PenLine strokeWidth={3} />
          </span>
        )}
      </div>
    </Tooltip>
  )
}

function Connector({ state, size }: { state: 'done' | 'active' | 'idle' | 'rejected'; size: 'xs' | 'sm' | 'md' }) {
  const w = size === 'md' ? 'w-8' : size === 'sm' ? 'w-5' : 'w-3'
  return (
    <div className={cn('relative h-[2px] shrink-0 overflow-hidden rounded-full bg-line/10', w)}>
      {state === 'done' && <motion.div className="absolute inset-0 bg-success" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 0.5 }} />}
      {state === 'rejected' && <div className="absolute inset-0 bg-danger/70" />}
      {state === 'active' && (
        <>
          <div className="absolute inset-0 bg-success/50" />
          <motion.div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-info to-transparent" initial={{ x: '-100%' }} animate={{ x: '200%' }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} />
        </>
      )}
    </div>
  )
}

/** Requester → approvers chain with status. */
export function ApprovalLine({ request, size = 'sm', showRequester = true, className }: { request: Pick<ApprovalRequest, 'requesterId' | 'steps' | 'status'>; size?: 'xs' | 'sm' | 'md'; showRequester?: boolean; className?: string }) {
  const cancelled = request.status === 'cancelled'
  return (
    <div className={cn('flex items-center', className)}>
      {showRequester && (
        <>
          <Node userId={request.requesterId} status="draft" size={size} label="기안" />
          <Connector size={size} state={cancelled ? 'idle' : request.steps[0]?.status === 'approved' ? 'done' : request.steps[0]?.status === 'rejected' ? 'rejected' : request.steps[0]?.status === 'pending' ? 'active' : 'done'} />
        </>
      )}
      {request.steps.map((s, i) => {
        const next = request.steps[i + 1]
        return (
          <Fragment key={i}>
            <Node userId={s.approverId} status={s.status} size={size} label={`${i + 1}차 결재 · ${STEP_LABEL[s.status]}`} cancelled={cancelled} />
            {next && (
              <Connector
                size={size}
                state={cancelled ? 'idle' : next.status === 'approved' ? 'done' : next.status === 'pending' ? 'active' : next.status === 'rejected' ? 'rejected' : 'idle'}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export { STEP_LABEL }
