import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { FileText, FileImage, FileSpreadsheet, Paperclip } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui'
import { useCore } from '@/store/core'
import { KIND_META, LEAVE_LABEL, won } from '../meta'
import type { ApprovalRequest } from '../types'
import { Seal } from './bits'

function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-[96px_1fr] border-b border-line/10 last:border-b-0', className)}>
      <div className="flex items-center bg-line/[0.035] px-3 py-2 text-[12px] font-medium text-muted">{label}</div>
      <div className="min-w-0 px-3 py-2 text-[13px] text-fg">{children}</div>
    </div>
  )
}

function shortTitle(t: string) {
  return t.length > 7 ? t.slice(0, 7) + '…' : t
}

/** 결재란 — stamp boxes for requester + each approver. */
export function StampTable({ r, animate = true }: { r: ApprovalRequest; animate?: boolean }) {
  const users = useCore((s) => s.users)
  const u = (id: string) => users.find((x) => x.id === id)
  const requester = u(r.requesterId)
  let decidedIdx = 0
  const cols = [
    { id: r.requesterId, role: '기안', title: requester?.title ?? '', status: 'draft' as const, date: r.createdAt },
    ...r.steps.map((s, i) => ({ id: s.approverId, role: i === r.steps.length - 1 ? '최종' : `${i + 1}차`, title: u(s.approverId)?.title ?? '', status: s.status, date: s.decidedAt })),
  ]
  return (
    <div className="flex max-w-full overflow-x-auto rounded-lg border border-line/15 bg-surface/60 scrollbar-none">
      <div className="flex w-7 shrink-0 items-center justify-center border-r border-line/15 bg-line/[0.04] text-[11px] font-semibold text-muted [writing-mode:vertical-rl] tracking-[0.5em]">결재</div>
      {cols.map((c, i) => {
        const delay = c.status === 'approved' || c.status === 'rejected' ? 0.35 + decidedIdx++ * 0.28 : 0.15
        const user = u(c.id)
        return (
          <div key={i} className="flex w-[78px] shrink-0 flex-col border-r border-line/15 last:border-r-0">
            <div className="truncate border-b border-line/15 bg-line/[0.04] px-1 py-1 text-center text-[10px] font-medium text-muted" title={c.title}>
              {c.role} · {shortTitle(c.title)}
            </div>
            <div className="relative flex h-[74px] items-center justify-center">
              {c.status === 'draft' && <Seal text={user?.name ?? ''} variant="draft" size={52} animate={animate} delay={delay} />}
              {c.status === 'approved' && <Seal text="승인" sub={c.date ? formatDate(c.date, 'MM.dd') : undefined} size={60} animate={animate} delay={delay} />}
              {c.status === 'rejected' && <Seal text="반려" sub={c.date ? formatDate(c.date, 'MM.dd') : undefined} variant="reject" size={58} animate={animate} delay={delay} />}
              {c.status === 'pending' && r.status === 'pending' && (
                <span className="flex flex-col items-center gap-1 text-[10.5px] font-medium text-info">
                  <span className="relative flex h-2 w-2"><span className="absolute inset-0 rounded-full bg-info animate-pulse-ring" /><span className="relative h-2 w-2 rounded-full bg-info" /></span>
                  결재 대기
                </span>
              )}
              {(c.status === 'waiting' || (c.status === 'pending' && r.status !== 'pending')) && <span className="text-[11px] text-subtle/60">—</span>}
            </div>
            <div className="border-t border-line/15 px-1 py-1 text-center">
              <div className="truncate text-[11.5px] font-semibold text-fg">{user?.name}</div>
              <div className="text-[9.5px] text-subtle">{c.date && c.status !== 'pending' && c.status !== 'waiting' ? formatDate(c.date, 'yy.MM.dd') : ' '}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ItemsTable({ r, purchase }: { r: ApprovalRequest; purchase?: boolean }) {
  const items = r.items ?? []
  const total = items.reduce((n, it) => n + it.amount * (it.qty ?? 1), 0)
  return (
    <div className="overflow-hidden rounded-lg border border-line/10">
      <table className="w-full text-[12.5px]">
        <thead className="bg-line/[0.035] text-[11px] text-muted">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">{purchase ? '품목' : '항목'}</th>
            {!purchase && <th className="px-2 py-1.5 text-left font-medium">분류</th>}
            {purchase && <th className="px-2 py-1.5 text-right font-medium">수량</th>}
            {purchase && <th className="px-2 py-1.5 text-right font-medium">단가</th>}
            <th className="px-3 py-1.5 text-right font-medium">금액</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-line/[0.07]">
              <td className="px-3 py-1.5 text-fg">{it.name}</td>
              {!purchase && <td className="px-2 py-1.5 text-muted">{it.category ?? '-'}</td>}
              {purchase && <td className="px-2 py-1.5 text-right tabular-nums text-muted">{it.qty ?? 1}</td>}
              {purchase && <td className="px-2 py-1.5 text-right tabular-nums text-muted">{won(it.amount)}</td>}
              <td className="px-3 py-1.5 text-right tabular-nums text-fg">{won(it.amount * (it.qty ?? 1))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-line/15 bg-accent/[0.06]">
            <td colSpan={purchase ? 3 : 2} className="px-3 py-2 text-right text-[12px] font-semibold text-muted">합계</td>
            <td className="px-3 py-2 text-right font-display text-[14px] font-bold tabular-nums text-fg">{won(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function fileIcon(name: string) {
  if (/\.(png|jpe?g|gif|webp|heic)$/i.test(name)) return <FileImage className="h-3.5 w-3.5 text-sky-500" />
  if (/\.(xlsx?|csv)$/i.test(name)) return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
  return <FileText className="h-3.5 w-3.5 text-rose-500" />
}

function period(r: ApprovalRequest, withTime = false) {
  if (!r.startDate) return '-'
  const p = withTime ? 'yyyy.MM.dd (EEE) a h:mm' : 'yyyy.MM.dd (EEE)'
  return r.endDate && formatDate(r.endDate) !== formatDate(r.startDate) ? `${formatDate(r.startDate, p)} ~ ${formatDate(r.endDate, p)}` : formatDate(r.startDate, p)
}

/** Formal 결재 문서 view. */
export function ApprovalDocument({ r, animateStamps = true, className }: { r: ApprovalRequest; animateStamps?: boolean; className?: string }) {
  const users = useCore((s) => s.users)
  const requester = users.find((u) => u.id === r.requesterId)
  const m = KIND_META[r.kind]
  const Icon = m.icon

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-line/10 bg-surface/80 shadow-card', className)}>
      {/* watermark */}
      <Icon className="pointer-events-none absolute -bottom-10 -right-10 h-56 w-56 text-line/[0.03]" strokeWidth={1} />
      <div className={cn('h-1 w-full bg-gradient-to-r', m.gradient)} />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 pt-1">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-subtle">
              <span className="h-2 w-2 rounded-sm bg-accent-gradient" /> Aurora Labs · 전자결재
            </div>
            <h2 className="mt-2 font-display text-[26px] font-bold tracking-[0.25em] text-fg">{m.docTitle}</h2>
            <div className="mt-1 h-[3px] w-24 border-y border-fg/40" />
          </div>
          <div className="min-w-0 max-w-full"><StampTable r={r} animate={animateStamps} /></div>
        </div>

        <div className="mt-5 grid overflow-hidden rounded-lg border border-line/10 sm:grid-cols-2">
          <div className="sm:border-r sm:border-line/10">
            <Row label="문서번호"><span className="font-mono text-[12px]">{r.docNo ?? '(상신 시 자동 부여)'}</span></Row>
            <Row label="기안자"><span className="flex items-center gap-1.5"><Avatar userId={r.requesterId} size="xs" />{requester?.name} <span className="text-muted">{requester?.title}</span></span></Row>
          </div>
          <div className="border-t border-line/10 sm:border-t-0">
            <Row label="기안일">{formatDate(r.createdAt, 'yyyy.MM.dd (EEE) HH:mm')}</Row>
            <Row label="소속">{requester?.department ?? '-'} · 오로라랩스</Row>
          </div>
          {!!r.ccIds?.length && (
            <Row label="참조" className="border-t border-line/10 sm:col-span-2">
              <span className="flex flex-wrap items-center gap-2">
                {r.ccIds.map((id) => {
                  const u = users.find((x) => x.id === id)
                  return <span key={id} className="flex items-center gap-1 rounded-full bg-line/[0.05] py-0.5 pl-0.5 pr-2 text-[12px]"><Avatar userId={id} size="xs" />{u?.name}</span>
                })}
              </span>
            </Row>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-line/10">
          <Row label="제목"><span className="font-semibold">{r.title}</span></Row>
          {r.kind === 'leave' && (
            <>
              <Row label="휴가 종류">{r.leaveType ? LEAVE_LABEL[r.leaveType] : '-'}</Row>
              <Row label="기간">{period(r)}</Row>
              <Row label="사용 일수"><span className="font-semibold">{r.days ?? '-'}일</span></Row>
            </>
          )}
          {r.kind === 'expense' && <Row label="지출일">{r.startDate ? formatDate(r.startDate, 'yyyy.MM.dd (EEE)') : '-'}</Row>}
          {r.kind === 'purchase' && <Row label="거래처">{r.vendor ?? '-'}</Row>}
          {r.kind === 'travel' && (
            <>
              <Row label="출장지">{r.destination ?? '-'}</Row>
              <Row label="기간">{period(r)}</Row>
              <Row label="목적">{r.purpose ?? '-'}</Row>
            </>
          )}
          {r.kind === 'access' && (
            <>
              <Row label="대상 시스템">{r.system ?? '-'}</Row>
              <Row label="권한 수준">{r.accessLevel ?? '-'}</Row>
              <Row label="사용 기간">{period(r)}</Row>
            </>
          )}
          {r.amount !== undefined && <Row label="금액"><span className="font-display text-[15px] font-bold tabular-nums">{won(r.amount)}</span></Row>}
          {r.urgent && <Row label="긴급도"><span className="font-semibold text-danger">🔥 긴급</span></Row>}
        </div>

        {(r.kind === 'expense' || r.kind === 'purchase' || r.kind === 'travel') && !!r.items?.length && (
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] font-semibold text-muted">{r.kind === 'purchase' ? '구매 품목' : r.kind === 'travel' ? '예상 경비' : '지출 내역'}</div>
            <ItemsTable r={r} purchase={r.kind === 'purchase'} />
          </div>
        )}

        {r.details && (
          <div className="mt-4">
            <div className="mb-1.5 text-[12px] font-semibold text-muted">{r.kind === 'leave' ? '사유' : '상세 내용'}</div>
            <div className="whitespace-pre-wrap rounded-lg border border-line/10 bg-line/[0.02] px-3.5 py-3 text-[13px] leading-relaxed text-fg/90">{r.details}</div>
          </div>
        )}

        {!!r.attachments?.length && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1 text-[12px] font-semibold text-muted"><Paperclip className="h-3 w-3" />첨부파일 {r.attachments.length}</div>
            <div className="flex flex-wrap gap-2">
              {r.attachments.map((a) => (
                <span key={a} className="flex items-center gap-1.5 rounded-lg border border-line/10 bg-line/[0.03] px-2.5 py-1.5 text-[12px] text-fg transition hover:border-accent/40 hover:bg-accent/5">
                  {fileIcon(a)}
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-[12px] text-muted">
          위와 같이 {r.kind === 'leave' ? '휴가를 신청' : r.kind === 'expense' ? '지출을 결의' : r.kind === 'purchase' ? '구매를 요청' : r.kind === 'travel' ? '출장을 신청' : r.kind === 'access' ? '권한을 신청' : '기안'}하오니 재가하여 주시기 바랍니다.
          <div className="mt-1 font-medium text-fg">{formatDate(r.createdAt, 'yyyy년 M월 d일')} · 기안자 {requester?.name}</div>
        </div>

        {/* Final overlay seal */}
        {(r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled') && (
          <motion.div
            className="pointer-events-none absolute bottom-8 right-8 select-none"
            initial={animateStamps ? { opacity: 0, scale: 1.8, rotate: -30 } : false}
            animate={{ opacity: 1, scale: 1, rotate: -16 }}
            transition={{ delay: animateStamps ? 0.4 + r.steps.length * 0.28 : 0, type: 'spring', stiffness: 260, damping: 16 }}
          >
            <div
              className={cn(
                'rounded-xl border-[3px] px-3 py-1 font-display text-xl font-black tracking-[0.3em] opacity-70',
                r.status === 'approved' && 'border-red-600 text-red-600',
                r.status === 'rejected' && 'border-red-700 text-red-700',
                r.status === 'cancelled' && 'border-subtle text-subtle',
              )}
            >
              {r.status === 'approved' ? '결재완료' : r.status === 'rejected' ? '반려' : '회수됨'}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
