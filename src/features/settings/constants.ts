import type { Accent } from '@/store/core'
import type { NotificationType } from '@/store/types'

export const ACCENTS: { id: Accent; label: string; from: string; via: string; to: string }[] = [
  { id: 'aurora', label: '오로라', from: '#8b5cf6', via: '#22d3ee', to: '#f472b6' },
  { id: 'ocean', label: '오션', from: '#3b82f6', via: '#22d3ee', to: '#818cf8' },
  { id: 'emerald', label: '에메랄드', from: '#10b981', via: '#84cc16', to: '#2dd4bf' },
  { id: 'sunset', label: '선셋', from: '#f97316', via: '#ec4899', to: '#facc15' },
  { id: 'rose', label: '로즈', from: '#f43f5e', via: '#a855f7', to: '#fb923c' },
]

export const accentGradient = (a: (typeof ACCENTS)[number]) => `linear-gradient(135deg, ${a.from}, ${a.via} 55%, ${a.to})`

export const NOTIF_TYPE_META: Record<NotificationType, { label: string; description: string }> = {
  mention: { label: '멘션', description: '누군가 나를 @멘션하거나 내 이름을 언급했을 때' },
  message: { label: '다이렉트 메시지', description: 'DM과 내가 참여한 스레드의 새 답글' },
  task: { label: '태스크', description: '태스크 할당, 상태 변경, 마감 임박 알림' },
  approval: { label: '전자결재', description: '결재 요청, 승인·반려 결과' },
  event: { label: '캘린더', description: '회의 초대, 일정 변경, 시작 10분 전 리마인더' },
  workflow: { label: '자동화', description: '워크플로우 실행 결과와 실패 알림' },
  doc: { label: '문서', description: '내 문서의 댓글, 공유, 편집 요청' },
  system: { label: '시스템', description: '보안, 결제, 워크스페이스 공지' },
}
