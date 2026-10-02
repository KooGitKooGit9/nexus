/**
 * Brand, company & plan catalogue — the ONE place to rename the product or fill in business info before launch.
 * Everything public (landing, pricing, legal pages, footer, billing settings) reads from here.
 *
 * Plan numbers MUST match LAUNCH.md and the server's enforcement (server/env). Prices are KRW per member / month, VAT 별도.
 */
import type { Plan } from '@/lib/api'

export const BRAND = {
  name: 'Nexus',
  nameKo: '넥서스',
  tagline: '메신저·프로젝트·문서·캘린더·전자결재·AI 비서를 하나로',
  description:
    '흩어진 업무 도구를 하나로. 메신저와 허들, 칸반 프로젝트, 문서, 캘린더, 전자결재, OKR, 그리고 직접 일을 처리하는 AI 비서까지 — 한국 팀을 위한 올인원 워크스페이스.',
  /** Placeholder until a domain is bought. */
  domain: 'nexus.example.com',
  supportEmail: 'support@nexus.example.com',
  company: {
    legalName: '[상호]',
    ceo: '[대표자명]',
    bizNo: '[사업자등록번호]',
    mailOrderNo: '[통신판매업 신고번호]',
    address: '[사업장 주소]',
    privacyOfficer: '[개인정보 보호책임자]',
  },
  /** Effective date printed on the legal drafts. */
  legalEffectiveDate: '2026년 10월 1일',
} as const

/** True while the business info above still holds `[placeholder]` values → legal pages show a "draft" banner. */
export const isLegalDraft = () => BRAND.company.legalName.startsWith('[')

export interface PlanFeature {
  label: string
  /** Not built yet → rendered with a "곧 제공" badge, never claimed as available. */
  soon?: boolean
}

export interface PlanInfo {
  id: Plan
  name: string
  /** one-line positioning */
  blurb: string
  /** KRW per member / month, billed monthly */
  monthly: number
  /** KRW per member / month, billed yearly (prepaid for 12 months) */
  yearly: number
  limits: {
    members: number | null // null = 무제한
    storageGB: number
    aiPerDay: number
    workflows: number | null // null = 무제한
  }
  highlight?: boolean
  /** paid upgrades start with a 14-day trial */
  trialDays?: number
  features: PlanFeature[]
}

export const PLANS: PlanInfo[] = [
  {
    id: 'free',
    name: 'Free',
    blurb: '작은 팀이 Nexus를 시작하기에 충분해요',
    monthly: 0,
    yearly: 0,
    limits: { members: 10, storageGB: 5, aiPerDay: 30, workflows: 5 },
    features: [
      { label: '멤버 최대 10명' },
      { label: '메신저 · 허들 · 음성/영상 통화' },
      { label: '프로젝트(칸반 · 리스트 · 타임라인)' },
      { label: '문서 · 캘린더 · 화이트보드' },
      { label: '전자결재 · OKR · 공지' },
      { label: '워크스페이스 저장공간 5GB' },
      { label: 'Nexus AI 하루 30회' },
      { label: '자동화 워크플로우 5개' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: '성장하는 팀을 위한 무제한 협업',
    monthly: 8900,
    yearly: 7900,
    highlight: true,
    trialDays: 14,
    limits: { members: null, storageGB: 100, aiPerDay: 500, workflows: null },
    features: [
      { label: 'Free의 모든 기능' },
      { label: '멤버 수 무제한' },
      { label: '워크스페이스 저장공간 100GB' },
      { label: 'Nexus AI 하루 500회' },
      { label: '자동화 워크플로우 무제한' },
      { label: '14일 무료 체험' },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    blurb: '규모 있는 조직을 위한 넉넉한 용량',
    monthly: 15900,
    yearly: 13900,
    trialDays: 14,
    limits: { members: null, storageGB: 1024, aiPerDay: 3000, workflows: null },
    features: [
      { label: 'Pro의 모든 기능' },
      { label: '워크스페이스 저장공간 1TB' },
      { label: 'Nexus AI 하루 3,000회' },
      { label: '14일 무료 체험' },
      { label: 'SSO (SAML)', soon: true },
      { label: '감사 로그 내보내기', soon: true },
      { label: '전담 지원', soon: true },
    ],
  },
]

export const planById = (id: Plan): PlanInfo => PLANS.find((p) => p.id === id) ?? PLANS[0]

export const formatKRW = (n: number) => `₩${n.toLocaleString('ko-KR')}`

/** Yearly discount vs monthly, rounded down to a whole percent (honest: never rounds up). */
export const yearlySavingPct = (p: PlanInfo) => (p.monthly ? Math.floor(((p.monthly - p.yearly) / p.monthly) * 100) : 0)

/** KRW saved per member per year when paying yearly. */
export const yearlySavingPerMember = (p: PlanInfo) => (p.monthly - p.yearly) * 12

export const formatStorageGB = (gb: number) => (gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`)
