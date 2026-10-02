import { minutesAgo } from '@/lib/utils'
import type { FileItem } from './types'

const DAY = 60 * 24
const KB = 1024
const MB = 1024 * KB
const GB = 1024 * MB

type Seed = Omit<FileItem, 'createdAt' | 'updatedAt' | 'kind'> & { created: number; updated: number; kind?: FileItem['kind'] }

const f = ({ created, updated, kind = 'file', ...rest }: Seed): FileItem => ({
  kind,
  ...rest,
  createdAt: minutesAgo(created),
  updatedAt: minutesAgo(updated),
})

const folder = (id: string, name: string, parentId: string | null, ownerId: string, color: string, updated: number, extra: Partial<Seed> = {}) =>
  f({ id, name, parentId, ownerId, color, kind: 'folder', created: updated + 120 * DAY, updated, ...extra })

export const SEED_FILES: FileItem[] = [
  /* ── folders ── */
  folder('fd_marketing', '마케팅 자료', null, 'u_mkt', '#f472b6', 2 * 60, { starred: true, sharedWith: ['u_me', 'u_ceo', 'u_design'] }),
  folder('fd_campaign', '2026 Q4 런칭 캠페인', 'fd_marketing', 'u_mkt', '#fbbf24', 5 * 60, { sharedWith: ['u_me', 'u_design'] }),
  folder('fd_design', '디자인 에셋', null, 'u_design', '#8b5cf6', 40, { starred: true, sharedWith: ['u_me', 'u_fe', 'u_design2'] }),
  folder('fd_brand', '브랜드 가이드', 'fd_design', 'u_design', '#a3e635', 12 * DAY),
  folder('fd_contracts', '계약서', null, 'u_sales', '#60a5fa', 3 * DAY, { sharedWith: ['u_me', 'u_ceo'] }),
  folder('fd_finance', '재무', null, 'u_ceo', '#34d399', 1 * DAY),
  folder('fd_eng', '엔지니어링', null, 'u_cto', '#22d3ee', 3 * 60),
  folder('fd_recordings', '회의 녹화', null, 'u_pm', '#fb7185', 22 * 60),
  folder('fd_hr', '인사 & 채용', null, 'u_hr', '#fbbf24', 4 * DAY),

  /* ── root ── */
  f({ id: 'fl_launch', name: 'Nexus 2.0 런칭 계획.pptx', parentId: null, ownerId: 'u_me', size: 18.4 * MB, created: 20 * DAY, updated: 25, starred: true, sharedWith: ['u_pm', 'u_mkt', 'u_ceo'] }),
  f({ id: 'fl_bizplan', name: '2026 사업계획서.pdf', parentId: null, ownerId: 'u_ceo', size: 6.2 * MB, created: 200 * DAY, updated: 30 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_okr', name: 'Q3 OKR 결과 정리.xlsx', parentId: null, ownerId: 'u_me', size: 412 * KB, created: 6 * DAY, updated: 2 * DAY }),
  f({ id: 'fl_intro', name: '오로라랩스 회사소개서 2026.pdf', parentId: null, ownerId: 'u_mkt', size: 12.8 * MB, created: 90 * DAY, updated: 9 * DAY, starred: true, sharedWith: ['u_me', 'u_sales'] }),
  f({ id: 'fl_workshop', name: '팀 워크숍 사진.zip', parentId: null, ownerId: 'u_hr', size: 1.4 * GB, created: 14 * DAY, updated: 14 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_floor', name: '성수 오피스 배치도.png', parentId: null, ownerId: 'u_hr', mime: 'image/png', size: 2.3 * MB, created: 40 * DAY, updated: 40 * DAY }),
  f({ id: 'fl_memo', name: '회의 메모.txt', parentId: null, ownerId: 'u_me', size: 4 * KB, created: 1 * DAY, updated: 3 * 60 }),

  /* ── 마케팅 ── */
  f({ id: 'fl_kv', name: '런칭 캠페인 키비주얼.png', parentId: 'fd_marketing', ownerId: 'u_design', mime: 'image/png', size: 8.7 * MB, created: 5 * DAY, updated: 3 * 60, starred: true, sharedWith: ['u_me', 'u_mkt'] }),
  f({ id: 'fl_mktplan', name: '2026 Q4 마케팅 플랜.pptx', parentId: 'fd_marketing', ownerId: 'u_mkt', size: 24.1 * MB, created: 30 * DAY, updated: 1 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_sns', name: 'SNS 콘텐츠 캘린더.xlsx', parentId: 'fd_marketing', ownerId: 'u_mkt', size: 286 * KB, created: 25 * DAY, updated: 4 * 60 }),
  f({ id: 'fl_press', name: '보도자료_Nexus 2.0 출시.docx', parentId: 'fd_marketing', ownerId: 'u_mkt', size: 96 * KB, created: 4 * DAY, updated: 50, sharedWith: ['u_me', 'u_ceo'] }),
  f({ id: 'fl_teaser', name: '런칭 티저 영상_30s.mp4', parentId: 'fd_marketing', ownerId: 'u_design', mime: 'video/mp4', size: 214 * MB, created: 3 * DAY, updated: 1 * DAY }),
  f({ id: 'fl_copy', name: '랜딩페이지 카피 초안.docx', parentId: 'fd_marketing', ownerId: 'u_me', size: 58 * KB, created: 7 * DAY, updated: 2 * DAY }),

  f({ id: 'fl_banner', name: '배너_1200x628.png', parentId: 'fd_campaign', ownerId: 'u_design', mime: 'image/png', size: 1.1 * MB, created: 2 * DAY, updated: 5 * 60 }),
  f({ id: 'fl_influencer', name: '인플루언서 리스트.xlsx', parentId: 'fd_campaign', ownerId: 'u_mkt', size: 74 * KB, created: 10 * DAY, updated: 6 * DAY }),
  f({ id: 'fl_report', name: '9월 캠페인 성과 리포트.pdf', parentId: 'fd_campaign', ownerId: 'u_mkt', size: 3.6 * MB, created: 2 * DAY, updated: 2 * DAY, sharedWith: ['u_me'] }),

  /* ── 디자인 ── */
  f({ id: 'fl_uikit', name: 'Nexus 2.0 UI 키트.fig', parentId: 'fd_design', ownerId: 'u_design', size: 46.2 * MB, created: 60 * DAY, updated: 40, starred: true, sharedWith: ['u_me', 'u_fe'] }),
  f({ id: 'fl_icons', name: '앱 아이콘 세트.zip', parentId: 'fd_design', ownerId: 'u_design', size: 32.5 * MB, created: 20 * DAY, updated: 20 * DAY }),
  f({ id: 'fl_illust', name: '온보딩 일러스트.png', parentId: 'fd_design', ownerId: 'u_design2', mime: 'image/png', size: 4.4 * MB, created: 8 * DAY, updated: 3 * DAY }),
  f({ id: 'fl_motion', name: '모션 가이드라인.mp4', parentId: 'fd_design', ownerId: 'u_design', mime: 'video/mp4', size: 88 * MB, created: 15 * DAY, updated: 15 * DAY }),
  f({ id: 'fl_dash', name: '대시보드 시안 v3.png', parentId: 'fd_design', ownerId: 'u_design', mime: 'image/png', size: 6.1 * MB, created: 2 * DAY, updated: 2 * 60, sharedWith: ['u_me', 'u_pm'] }),
  f({ id: 'fl_tokens', name: 'design-tokens.json', parentId: 'fd_design', ownerId: 'u_fe', size: 18 * KB, created: 30 * DAY, updated: 1 * DAY }),

  f({ id: 'fl_logo', name: '오로라랩스 로고 패키지.zip', parentId: 'fd_brand', ownerId: 'u_design', size: 12.4 * MB, created: 120 * DAY, updated: 60 * DAY }),
  f({ id: 'fl_brandguide', name: '브랜드 가이드라인 v2.pdf', parentId: 'fd_brand', ownerId: 'u_design', size: 22.8 * MB, created: 100 * DAY, updated: 12 * DAY, starred: true }),
  f({ id: 'fl_palette', name: '컬러 팔레트.png', parentId: 'fd_brand', ownerId: 'u_design', mime: 'image/png', size: 860 * KB, created: 100 * DAY, updated: 12 * DAY }),

  /* ── 계약서 ── */
  f({ id: 'fl_msa', name: '고객사 MSA_한빛소프트.pdf', parentId: 'fd_contracts', ownerId: 'u_sales', size: 1.8 * MB, created: 12 * DAY, updated: 3 * DAY, sharedWith: ['u_me', 'u_ceo'] }),
  f({ id: 'fl_nda', name: 'NDA_스텔라테크.pdf', parentId: 'fd_contracts', ownerId: 'u_sales', size: 640 * KB, created: 20 * DAY, updated: 20 * DAY }),
  f({ id: 'fl_partner', name: '파트너십 계약서_Globex.pdf', parentId: 'fd_contracts', ownerId: 'u_global', size: 2.2 * MB, created: 9 * DAY, updated: 5 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_lease', name: '성수 오피스 임대차 계약서.pdf', parentId: 'fd_contracts', ownerId: 'u_ceo', size: 3.1 * MB, created: 300 * DAY, updated: 300 * DAY }),

  /* ── 재무 ── */
  f({ id: 'fl_pl', name: '2026 Q3 손익계산서.xlsx', parentId: 'fd_finance', ownerId: 'u_ceo', size: 920 * KB, created: 2 * DAY, updated: 1 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_budget', name: '2027 예산 계획.xlsx', parentId: 'fd_finance', ownerId: 'u_ceo', size: 1.3 * MB, created: 6 * DAY, updated: 4 * 60 }),
  f({ id: 'fl_ir', name: '시리즈 C IR 자료.pptx', parentId: 'fd_finance', ownerId: 'u_ceo', size: 38.6 * MB, created: 18 * DAY, updated: 3 * DAY, starred: true, sharedWith: ['u_me', 'u_cto'] }),
  f({ id: 'fl_card', name: '법인카드 사용 내역_9월.xlsx', parentId: 'fd_finance', ownerId: 'u_hr', size: 210 * KB, created: 1 * DAY, updated: 1 * DAY }),

  /* ── 엔지니어링 ── */
  f({ id: 'fl_archdiag', name: '시스템 아키텍처 다이어그램.png', parentId: 'fd_eng', ownerId: 'u_cto', mime: 'image/png', size: 3.4 * MB, created: 30 * DAY, updated: 5 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_api', name: 'API 명세서 v2.pdf', parentId: 'fd_eng', ownerId: 'u_be', size: 2.7 * MB, created: 14 * DAY, updated: 2 * DAY }),
  f({ id: 'fl_compose', name: 'docker-compose.yml', parentId: 'fd_eng', ownerId: 'u_devops', size: 3 * KB, created: 50 * DAY, updated: 7 * DAY }),
  f({ id: 'fl_sql', name: 'migration_20260928.sql', parentId: 'fd_eng', ownerId: 'u_be', size: 12 * KB, created: 4 * DAY, updated: 4 * DAY }),
  f({ id: 'fl_load', name: '부하 테스트 결과_v1.18.xlsx', parentId: 'fd_eng', ownerId: 'u_devops', size: 540 * KB, created: 3 * DAY, updated: 3 * DAY }),
  f({ id: 'fl_release', name: 'release-v1.18.0.zip', parentId: 'fd_eng', ownerId: 'u_devops', size: 148 * MB, created: 2 * DAY, updated: 2 * DAY }),

  /* ── 회의 녹화 ── */
  f({ id: 'fl_rec1', name: '주간 제품 싱크 10-01.mp4', parentId: 'fd_recordings', ownerId: 'u_pm', mime: 'video/mp4', size: 612 * MB, created: 1 * DAY, updated: 22 * 60, sharedWith: ['u_me', 'u_design', 'u_fe'] }),
  f({ id: 'fl_rec2', name: '디자인 리뷰 09-26.mp4', parentId: 'fd_recordings', ownerId: 'u_design', mime: 'video/mp4', size: 488 * MB, created: 6 * DAY, updated: 6 * DAY }),
  f({ id: 'fl_rec3', name: '9월 전사 타운홀.mp4', parentId: 'fd_recordings', ownerId: 'u_ceo', mime: 'video/mp4', size: 1.2 * GB, created: 8 * DAY, updated: 8 * DAY, starred: true }),
  f({ id: 'fl_interview', name: '고객 인터뷰 #42_한빛소프트.m4a', parentId: 'fd_recordings', ownerId: 'u_design2', mime: 'audio/mp4', size: 38 * MB, created: 3 * DAY, updated: 3 * DAY, sharedWith: ['u_me'] }),

  /* ── 인사 ── */
  f({ id: 'fl_hiring', name: '2026 하반기 채용 계획.xlsx', parentId: 'fd_hr', ownerId: 'u_hr', size: 180 * KB, created: 20 * DAY, updated: 4 * DAY, sharedWith: ['u_me'] }),
  f({ id: 'fl_onboard', name: '신규 입사자 온보딩 체크리스트.docx', parentId: 'fd_hr', ownerId: 'u_hr', size: 64 * KB, created: 60 * DAY, updated: 10 * DAY }),
  f({ id: 'fl_welfare', name: '복지 제도 안내 2026.pdf', parentId: 'fd_hr', ownerId: 'u_hr', size: 1.9 * MB, created: 90 * DAY, updated: 2 * DAY }),

  /* ── trash ── */
  f({ id: 'fl_old', name: '구버전_회사소개서_2025.pdf', parentId: null, ownerId: 'u_me', size: 9.4 * MB, created: 400 * DAY, updated: 200 * DAY, trashed: true, trashedAt: minutesAgo(3 * DAY) }),
  f({ id: 'fl_tmp', name: '임시_스크린샷 2026-09-30.png', parentId: null, ownerId: 'u_me', mime: 'image/png', size: 1.6 * MB, created: 2 * DAY, updated: 2 * DAY, trashed: true, trashedAt: minutesAgo(26 * 60) }),
  f({ id: 'fl_draft', name: '보도자료 초안 (폐기).docx', parentId: 'fd_marketing', ownerId: 'u_mkt', size: 44 * KB, created: 9 * DAY, updated: 8 * DAY, trashed: true, trashedAt: minutesAgo(5 * DAY) }),
].map((x) => ({ ...x, size: x.size ? Math.round(x.size) : x.size }))
