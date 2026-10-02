import { minutesAgo } from '@/lib/utils'
import type { AuditEntry, Session } from './types'

export const SEED_SESSIONS: Session[] = [
  { id: 'ses_1', kind: 'desktop', device: 'MacBook Pro 16"', os: 'macOS 26', browser: 'Chrome 141', location: '서울, 대한민국', ip: '211.234.10.42', lastActive: minutesAgo(0), current: true },
  { id: 'ses_2', kind: 'mobile', device: 'iPhone 17 Pro', os: 'iOS 26', browser: 'Nexus iOS 4.2', location: '서울, 대한민국', ip: '223.38.21.7', lastActive: minutesAgo(48) },
  { id: 'ses_3', kind: 'tablet', device: 'iPad Air', os: 'iPadOS 26', browser: 'Safari', location: '성남시 분당구', ip: '121.130.88.19', lastActive: minutesAgo(60 * 26) },
  { id: 'ses_4', kind: 'desktop', device: 'Windows 데스크톱', os: 'Windows 11', browser: 'Edge 140', location: '판교 오피스', ip: '175.45.201.3', lastActive: minutesAgo(60 * 24 * 4) },
]

export const SEED_AUDIT: AuditEntry[] = [
  { id: 'aud_1', actorId: 'u_me', category: 'auth', action: '로그인', target: 'Chrome · macOS', ip: '211.234.10.42', at: minutesAgo(12) },
  { id: 'aud_2', actorId: 'u_hr', category: 'member', action: '멤버 초대', target: 'minji@aurora.io', ip: '211.234.10.77', at: minutesAgo(140) },
  { id: 'aud_3', actorId: 'u_cto', category: 'security', action: 'SSO 정책 변경', target: 'Google Workspace SAML', ip: '211.234.10.31', at: minutesAgo(60 * 5) },
  { id: 'aud_4', actorId: 'u_devops', category: 'integration', action: '연동 추가', target: 'GitHub · aurora-labs', ip: '175.45.201.3', at: minutesAgo(60 * 20) },
  { id: 'aud_5', actorId: 'u_me', category: 'data', action: '문서 내보내기', target: 'Q4 로드맵 (PDF)', ip: '211.234.10.42', at: minutesAgo(60 * 28) },
  { id: 'aud_6', actorId: 'u_ceo', category: 'member', action: '권한 변경', target: '이도윤 → 관리자', ip: '211.234.10.12', at: minutesAgo(60 * 50) },
  { id: 'aud_7', actorId: 'u_be', category: 'security', action: 'API 토큰 발급', target: 'ci-deploy-bot', ip: '58.229.14.90', at: minutesAgo(60 * 72) },
  { id: 'aud_8', actorId: 'u_me', category: 'auth', action: '2단계 인증 코드 재발급', target: '백업 코드 10개', ip: '211.234.10.42', at: minutesAgo(60 * 24 * 6) },
]

export const SEED_INTEGRATIONS: Record<string, { connected: boolean; connectedAt?: string; account?: string }> = {
  github: { connected: true, connectedAt: minutesAgo(60 * 24 * 40), account: 'aurora-labs' },
  gcal: { connected: true, connectedAt: minutesAgo(60 * 24 * 120), account: 'haneul@aurora.io' },
  figma: { connected: true, connectedAt: minutesAgo(60 * 24 * 12), account: 'Aurora Design' },
  jira: { connected: false },
  notion: { connected: false },
  zoom: { connected: false },
  salesforce: { connected: false },
}
