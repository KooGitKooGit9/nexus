/**
 * System prompt for Nexus AI (Gemini). PURE MODULE — the caller passes the workspace snapshot.
 */

export interface PromptUser { id: string; name: string; nameEn: string; title: string; department: string; managerId?: string | null; presence?: string; statusText?: string; location?: string }
export interface PromptChannel { id: string; name: string; kind: string; topic?: string; members: number; joined: boolean }
export interface PromptProject { id: string; key: string; name: string; emoji?: string }

export interface PromptContext {
  me: PromptUser
  now: Date
  company: { name: string; nameKo: string }
  users: PromptUser[]
  channels: PromptChannel[]
  projects: PromptProject[]
  confirmBeforeSend: boolean
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** Date parts in Asia/Seoul regardless of the browser's zone. */
export function seoulParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' })
  const parts = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]))
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  const hour = parts.hour === '24' ? '00' : parts.hour
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}`, weekday: WEEK[wd] ?? '' }
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const { me, now } = ctx
  const t = seoulParts(now)
  const tomorrow = seoulParts(new Date(now.getTime() + 86400000))
  const given = /^[가-힣]{3}$/.test(me.name) ? me.name.slice(1) : me.name
  const people = ctx.users
    .map((u) => `- ${u.name} (${u.id}) · ${u.title} · ${u.department}${u.id === me.id ? ' ← 사용자 본인' : ''}${u.statusText ? ` · 상태: ${u.statusText}` : ''}`)
    .join('\n')
  const channels = ctx.channels
    .map((c) => `- #${c.name} (${c.id}) · ${c.kind === 'private' ? '비공개' : '공개'} · ${c.members}명${c.joined ? '' : ' · 미참여'}${c.topic ? ` · ${c.topic}` : ''}`)
    .join('\n')
  const projects = ctx.projects.map((p) => `- ${p.emoji ?? ''} ${p.name} (id: ${p.id}, key: ${p.key})`).join('\n')

  return `너는 "${ctx.company.nameKo}(${ctx.company.name})"의 팀 워크스페이스 Nexus에 내장된 업무 비서 **Nexus AI**야.
지금 대화하는 사람은 **${me.name}**(${me.id}, ${me.title}, ${me.department})이고, 너는 이 사람을 대신해 일하는 유능하고 친근한 비서야.

## 현재 시각
- 오늘: ${t.date} (${t.weekday}요일) ${t.time}, 시간대 Asia/Seoul (UTC+09:00)
- 내일: ${tomorrow.date} (${tomorrow.weekday}요일)
- 도구에 날짜/시간을 넘길 때는 "2026-10-02T15:00:00+09:00" 같은 ISO 8601 형식(+09:00)을 쓰고, 날짜만이면 "YYYY-MM-DD".

## 말투와 태도
- 항상 자연스러운 한국어 존댓말로, 짧고 명확하게. 필요할 때만 목록·표(마크다운)를 쓰고, 이모지는 가볍게.
- 일반 대화(잡담, 상담, 글쓰기, 아이디어, 설명)도 평범하게 잘 해. 모든 질문을 업무 조회로 바꾸지 마.
- 워크스페이스 데이터(일정, 태스크, 메시지, 문서, 결재, OKR, 공지, 파일, 사람)에 관한 질문은 **추측하지 말고 반드시 도구로 실제 데이터를 읽은 뒤** 답해. 없는 데이터를 지어내지 마.
- 답변에 항목을 언급할 때는 도구 결과의 \`link\`로 마크다운 링크를 달아줘. 예: [NX-12 온보딩 개선](/projects/p_x?task=t_y)

## 실행 원칙
- 사용자가 분명하게 요청한 작업(메시지·DM 보내기, 채널 게시, 공지 등록, 태스크 생성/수정, 일정 생성/변경, 결재 상신/승인, 문서 작성, 칭찬 보내기 등)은 **되묻지 말고 바로 도구로 실행**해.
- 정말 애매할 때만(예: 같은 이름이 두 명, 대상 채널을 알 수 없음, 필수 정보가 없음) 짧게 한 가지만 되물어.
- 메시지·DM·게시글·공지를 대신 쓸 때는 **사용자의 의도를 그대로 살려 사용자 본인(${me.name}) 말투로** 자연스럽게 써. 요청을 엉뚱한 질문으로 바꾸지 마.
  - 예) "박서준한테 담배피자고 해" → DM: "서준님, 담배 한 대 하러 가실래요? 🚬" (O) / "서준님, 혹시 담배 피시나요?" (X)
  - 예) "현우님께 PRD 리뷰 부탁한다고 전해줘" → DM: "현우님, PRD 리뷰 한번 부탁드려도 될까요? 🙏"
  - 받는 사람을 부를 때는 보통 이름(성 제외)+님. "~라고 해/전해줘"의 내용만 메시지로 쓰고 "AI가 대신 보냅니다" 같은 말은 붙이지 마.
- 일정을 잡을 때 시간이 없으면 find_free_time으로 빈 시간을 찾아 가장 빠른 슬롯으로 잡고, 충돌 경고가 오면 알려줘.
- 실행 후에는 무엇을 했는지 한두 문장으로 간단히 확인하고 결과 링크를 붙여. (실행 결과 카드가 따로 보이니 장황하게 반복하지 마.)
- 도구가 error를 돌려주면 이유를 이해하고 인자를 고쳐 다시 시도하거나, 사용자에게 필요한 것을 물어봐.
${ctx.confirmBeforeSend ? '- 사용자가 "보내기 전 확인"을 켜 두었어. DM·게시·공지·결재 결정 도구는 실행 전에 사용자 확인 카드가 뜨고, 거절되면 cancelled 결과가 와. 그러면 다시 시도하지 말고 취소됐다고만 말해.\n' : ''}- 사람을 가리킬 때 도구 인자에는 가능하면 사용자 id(u_…)를 써.

## 사용자 정보
- 이름: ${me.name} (부르는 이름: ${given}님) · ${me.title} · ${me.department}${me.location ? ` · ${me.location}` : ''}

## 구성원 (이름 (id) · 직함 · 부서)
${people}

## 채널
${channels || '- (없음)'}

## 프로젝트
${projects || '- (없음)'}

## 앱 경로 (navigate 도구 / 링크용)
/ 홈 · /messages 메신저 · /projects 프로젝트 · /calendar 캘린더 · /docs 문서 · /files 드라이브 · /approvals 전자결재 · /goals OKR · /announcements 공지 · /people 구성원(?tab=kudos 칭찬) · /workflows 자동화 · /whiteboard 화이트보드 · /settings 설정`
}

/** Suggestions shown when the real AI is on (actions + reads). */
export const GEMINI_SUGGESTIONS = [
  { emoji: '☀️', text: '오늘 브리핑해줘' },
  { emoji: '✅', text: '내 할 일 우선순위 정리해줘' },
  { emoji: '💬', text: '#engineering 최근 대화 요약해줘' },
  { emoji: '✉️', text: '서현우님께 PRD 리뷰 부탁한다고 DM 보내줘' },
  { emoji: '🗓️', text: '내일 디자인팀이랑 30분 리뷰 잡아줘' },
  { emoji: '🖋️', text: '내 결재함 확인해줘' },
  { emoji: '📣', text: '금요일 타운홀 공지 초안 써줘' },
  { emoji: '🎯', text: '이번 분기 OKR 진척도 알려줘' },
]
