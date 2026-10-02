import type { User } from './types'

export const COMPANY = { name: 'Aurora Labs', nameKo: '오로라랩스', workspace: 'Nexus' }

export const CURRENT_USER_ID = 'u_me'

export const SEED_USERS: User[] = [
  { id: 'u_me', name: '김하늘', nameEn: 'Haneul Kim', title: '프로덕트 리드', department: '제품', email: 'haneul@aurora.io', phone: '010-2100-0001', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_ceo', presence: 'online', statusEmoji: '🚀', statusText: 'Q4 로드맵 집중 중', bio: '사용자가 사랑하는 제품을 만듭니다.', skills: ['Product Strategy', 'UX Research', 'SQL'], joinedAt: '2022-03-02', birthday: '04-17' },
  { id: 'u_ceo', name: '박서준', nameEn: 'Seojun Park', title: 'CEO / 공동창업자', department: '경영', email: 'seojun@aurora.io', phone: '010-2100-0002', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: null, presence: 'online', statusEmoji: '🎯', statusText: '투자사 미팅', skills: ['Leadership', 'Fundraising'], joinedAt: '2020-01-06', birthday: '09-30' },
  { id: 'u_cto', name: '이도윤', nameEn: 'Doyun Lee', title: 'CTO', department: '엔지니어링', email: 'doyun@aurora.io', phone: '010-2100-0003', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_ceo', presence: 'dnd', statusEmoji: '🔕', statusText: '아키텍처 리뷰 (방해금지)', skills: ['Distributed Systems', 'Go', 'Kubernetes'], joinedAt: '2020-01-06', birthday: '11-12' },
  { id: 'u_fe', name: '최지우', nameEn: 'Jiwoo Choi', title: '시니어 프론트엔드 엔지니어', department: '엔지니어링', email: 'jiwoo@aurora.io', phone: '010-2100-0004', location: '판교 오피스', timezone: 'Asia/Seoul', managerId: 'u_cto', presence: 'online', statusEmoji: '⚛️', statusText: '디자인 시스템 v3', skills: ['React', 'TypeScript', 'WebGL'], joinedAt: '2021-05-17', birthday: '02-08' },
  { id: 'u_be', name: '정민호', nameEn: 'Minho Jung', title: '백엔드 엔지니어', department: '엔지니어링', email: 'minho@aurora.io', phone: '010-2100-0005', location: '재택', timezone: 'Asia/Seoul', managerId: 'u_cto', presence: 'online', statusEmoji: '🏠', statusText: '재택근무', skills: ['Kotlin', 'PostgreSQL', 'Kafka'], joinedAt: '2021-09-01', birthday: '07-23' },
  { id: 'u_ml', name: '강유나', nameEn: 'Yuna Kang', title: 'ML 엔지니어', department: '엔지니어링', email: 'yuna@aurora.io', phone: '010-2100-0006', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_cto', presence: 'away', statusEmoji: '☕', statusText: '커피 타임', skills: ['PyTorch', 'LLM', 'MLOps'], joinedAt: '2023-02-13', birthday: '10-02' },
  { id: 'u_devops', name: '윤태현', nameEn: 'Taehyun Yoon', title: 'DevOps 엔지니어', department: '엔지니어링', email: 'taehyun@aurora.io', phone: '010-2100-0007', location: '판교 오피스', timezone: 'Asia/Seoul', managerId: 'u_cto', presence: 'offline', skills: ['AWS', 'Terraform', 'Observability'], joinedAt: '2022-07-04', birthday: '12-25' },
  { id: 'u_design', name: '한소희', nameEn: 'Sohee Han', title: '프로덕트 디자이너', department: '디자인', email: 'sohee@aurora.io', phone: '010-2100-0008', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_me', presence: 'online', statusEmoji: '🎨', statusText: '피그마 작업 중', skills: ['Figma', 'Motion', 'Design Systems'], joinedAt: '2022-11-21', birthday: '05-30' },
  { id: 'u_design2', name: '오민지', nameEn: 'Minji Oh', title: 'UX 리서처', department: '디자인', email: 'minji@aurora.io', phone: '010-2100-0009', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_me', presence: 'online', skills: ['User Interview', 'Usability Testing'], joinedAt: '2024-01-08', birthday: '03-14' },
  { id: 'u_pm', name: '서현우', nameEn: 'Hyunwoo Seo', title: '프로덕트 매니저', department: '제품', email: 'hyunwoo@aurora.io', phone: '010-2100-0010', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_me', presence: 'away', statusEmoji: '📅', statusText: '스프린트 플래닝', skills: ['Agile', 'Analytics'], joinedAt: '2023-06-19', birthday: '08-09' },
  { id: 'u_mkt', name: '임채원', nameEn: 'Chaewon Lim', title: '마케팅 리드', department: '마케팅', email: 'chaewon@aurora.io', phone: '010-2100-0011', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_ceo', presence: 'online', statusEmoji: '📣', statusText: '런칭 캠페인 준비', skills: ['Brand', 'Growth', 'Content'], joinedAt: '2021-03-15', birthday: '06-11' },
  { id: 'u_sales', name: '조은우', nameEn: 'Eunwoo Cho', title: '세일즈 매니저', department: '영업', email: 'eunwoo@aurora.io', phone: '010-2100-0012', location: '부산 지사', timezone: 'Asia/Seoul', managerId: 'u_ceo', presence: 'online', statusEmoji: '🤝', statusText: '고객사 방문', skills: ['B2B Sales', 'Negotiation'], joinedAt: '2022-04-25', birthday: '01-19' },
  { id: 'u_hr', name: '배수아', nameEn: 'Sua Bae', title: '피플팀 매니저', department: '피플팀', email: 'sua@aurora.io', phone: '010-2100-0013', location: '서울 HQ', timezone: 'Asia/Seoul', managerId: 'u_ceo', presence: 'online', statusEmoji: '🌱', skills: ['Recruiting', 'Culture'], joinedAt: '2021-08-02', birthday: '10-05' },
  { id: 'u_global', name: 'Emily Carter', nameEn: 'Emily Carter', title: 'Global Partnerships', department: '영업', email: 'emily@aurora.io', phone: '+1-415-555-0114', location: 'San Francisco', timezone: 'America/Los_Angeles', managerId: 'u_sales', presence: 'offline', statusEmoji: '🌙', statusText: 'Sleeping (PST)', skills: ['Partnerships', 'GTM'], joinedAt: '2024-04-01', birthday: '09-02' },
]

/** Pseudo-user for bot / integration messages. */
export const BOT_USER: User = {
  id: 'u_bot', name: 'Nexus Bot', nameEn: 'Nexus Bot', title: '워크스페이스 어시스턴트', department: '경영',
  email: 'bot@aurora.io', phone: '-', location: 'Cloud', timezone: 'UTC', managerId: null, presence: 'online',
  statusEmoji: '🤖', skills: [], joinedAt: '2020-01-01', birthday: '01-01',
}
