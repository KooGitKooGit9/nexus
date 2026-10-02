import { format } from 'date-fns'
import { uid } from '@/lib/utils'
import { LEAVE_LABEL, leaveDays } from '../meta'
import type { ApprovalKind, ApprovalRequest, LeaveType, LineItem } from '../types'
import type { NewRequestInput } from '../store'

export interface Draft {
  kind: ApprovalKind | null
  title: string
  titleTouched: boolean
  details: string
  leaveType: LeaveType
  startDate: string // yyyy-MM-dd
  endDate: string
  items: LineItem[]
  vendor: string
  destination: string
  purpose: string
  system: string
  accessLevel: string
  attachments: string[]
  urgent: boolean
  amount: string
  approverIds: string[]
  ccIds: string[]
}

const ymd = (d: Date) => format(d, 'yyyy-MM-dd')
const addDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}
/** n days from today, pushed forward to the next weekday (so a default leave range is never 0 days) */
const addBusinessDays = (n: number) => {
  const d = addDays(n)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

export function emptyDraft(): Draft {
  return {
    kind: null,
    title: '',
    titleTouched: false,
    details: '',
    leaveType: 'annual',
    startDate: ymd(addBusinessDays(7)),
    endDate: ymd(addBusinessDays(7)),
    items: [{ id: uid('i'), name: '', category: '', qty: 1, amount: 0 }],
    vendor: '',
    destination: '',
    purpose: '',
    system: '',
    accessLevel: '읽기 전용 (Read-only)',
    attachments: [],
    urgent: false,
    amount: '',
    approverIds: [],
    ccIds: [],
  }
}

export const itemsTotal = (items: LineItem[], withQty: boolean) => items.reduce((n, it) => n + (it.amount || 0) * (withQty ? it.qty ?? 1 : 1), 0)

const md = (s: string) => (s ? format(new Date(s + 'T00:00:00'), 'M/d') : '')

export function autoTitle(d: Draft): string {
  switch (d.kind) {
    case 'leave': {
      const range = d.leaveType === 'half_am' || d.leaveType === 'half_pm' || d.startDate === d.endDate ? md(d.startDate) : `${md(d.startDate)} ~ ${md(d.endDate)}`
      return `${LEAVE_LABEL[d.leaveType]} 신청 (${range})`
    }
    case 'expense':
      return d.items[0]?.name ? `${d.items[0].name}${d.items.length > 1 ? ` 외 ${d.items.length - 1}건` : ''} 경비 정산` : '경비 정산 요청'
    case 'purchase':
      return d.items[0]?.name ? `${d.items[0].name}${d.items.length > 1 ? ` 외 ${d.items.length - 1}건` : ''} 구매 요청` : '구매 요청'
    case 'travel':
      return d.destination ? `${d.destination} 출장 신청` : '출장 신청'
    case 'access':
      return d.system ? `${d.system} 권한 요청` : '권한 요청'
    case 'general':
      return '기안서'
    default:
      return ''
  }
}

export function effectiveTitle(d: Draft) {
  return d.titleTouched ? d.title : autoTitle(d)
}

/** Returns an error message for the content step, or null when valid. */
export function validateForm(d: Draft): string | null {
  if (!effectiveTitle(d).trim()) return '제목을 입력하세요'
  switch (d.kind) {
    case 'leave':
      if (!d.startDate) return '시작일을 선택하세요'
      if (d.endDate < d.startDate) return '종료일이 시작일보다 빨라요'
      if (leaveDays(d.leaveType, toIso(d.startDate), toIso(d.endDate)) <= 0) return '선택한 기간에 근무일이 없어요'
      return null
    case 'expense':
    case 'purchase':
      if (d.kind === 'expense' && !d.startDate) return '지출일을 선택하세요'
      if (!d.items.some((i) => i.name.trim() && i.amount > 0)) return '항목과 금액을 1개 이상 입력하세요'
      if (d.kind === 'purchase' && !d.vendor.trim()) return '거래처를 입력하세요'
      return null
    case 'travel':
      if (!d.destination.trim()) return '출장지를 입력하세요'
      if (!d.startDate || !d.endDate) return '출장 기간을 선택하세요'
      if (d.endDate < d.startDate) return '종료일이 시작일보다 빨라요'
      return null
    case 'access':
      if (!d.system.trim()) return '대상 시스템을 선택하세요'
      if (!d.startDate || !d.endDate) return '사용 기간을 선택하세요'
      if (d.endDate < d.startDate) return '종료일이 시작일보다 빨라요'
      if (!d.details.trim()) return '권한이 필요한 사유를 입력하세요'
      return null
    case 'general':
      if (!d.details.trim()) return '내용을 입력하세요'
      return null
    default:
      return '문서 종류를 선택하세요'
  }
}

function toIso(ymdStr: string, hour = 9) {
  const [y, m, dd] = ymdStr.split('-').map(Number)
  return new Date(y, m - 1, dd, hour).toISOString()
}

export function toInput(d: Draft): NewRequestInput {
  const kind = d.kind ?? 'general'
  const base: NewRequestInput = { kind, title: effectiveTitle(d).trim(), details: d.details.trim() || undefined, attachments: d.attachments.length ? d.attachments : undefined, urgent: d.urgent || undefined, ccIds: d.ccIds.length ? d.ccIds : undefined, approverIds: d.approverIds }
  const cleanItems = d.items.filter((i) => i.name.trim() && i.amount > 0)
  switch (kind) {
    case 'leave': {
      const half = d.leaveType === 'half_am' || d.leaveType === 'half_pm'
      const end = half ? d.startDate : d.endDate
      return { ...base, leaveType: d.leaveType, startDate: toIso(d.startDate, d.leaveType === 'half_pm' ? 14 : 9), endDate: toIso(end, d.leaveType === 'half_am' ? 13 : 18), days: leaveDays(d.leaveType, toIso(d.startDate), toIso(end)) }
    }
    case 'expense':
      return { ...base, items: cleanItems.map((i) => ({ ...i, qty: undefined })), amount: itemsTotal(cleanItems, false), startDate: toIso(d.startDate) }
    case 'purchase':
      return { ...base, vendor: d.vendor.trim(), items: cleanItems, amount: itemsTotal(cleanItems, true) }
    case 'travel':
      return { ...base, destination: d.destination.trim(), purpose: d.purpose.trim() || undefined, startDate: toIso(d.startDate, 8), endDate: toIso(d.endDate, 20), items: cleanItems.length ? cleanItems.map((i) => ({ ...i, qty: undefined })) : undefined, amount: cleanItems.length ? itemsTotal(cleanItems, false) : undefined }
    case 'access':
      return { ...base, system: d.system, accessLevel: d.accessLevel, startDate: toIso(d.startDate), endDate: toIso(d.endDate) }
    default:
      return { ...base, amount: Number(d.amount.replace(/[^\d]/g, '')) || undefined }
  }
}

/** Build a preview ApprovalRequest for the review step. */
export function toPreview(d: Draft, requesterId: string): ApprovalRequest {
  const { approverIds, ...rest } = toInput(d)
  return {
    ...rest,
    id: 'preview',
    requesterId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    steps: approverIds.map((a, i) => ({ approverId: a, status: i === 0 ? 'pending' : 'waiting' })),
  }
}
