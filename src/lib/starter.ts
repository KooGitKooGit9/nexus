/**
 * Starting content for a brand-new (blank) workspace. Demo workspaces upload the built-in Aurora Labs seed
 * instead; blank ones get ONLY this — real teams must never see fictional people or data.
 * Pure data: must not import stores (sync.ts imports this).
 */
type Item = { id: string } & Record<string, unknown>

export function starterItems(store: string, coll: string, ctx: { workspaceName: string; memberId: string }): Item[] {
  const now = new Date().toISOString()
  if (store === 'messenger' && coll === 'channels') {
    return [
      { id: 'c_general', name: 'general', kind: 'public', emoji: '📢', memberIds: [ctx.memberId], createdBy: ctx.memberId, createdAt: now, topic: '전사 공지와 중요한 소식', description: `${ctx.workspaceName}의 모든 멤버가 함께하는 채널입니다.` },
      { id: 'c_random', name: 'random', kind: 'public', emoji: '🎲', memberIds: [ctx.memberId], createdBy: ctx.memberId, createdAt: now, topic: '업무 밖 이야기 환영', description: '점심 메뉴, 취미, 아무 이야기나 나누는 곳' },
    ]
  }
  if (store === 'messenger' && coll === 'messages') {
    return [
      {
        id: 'msg_welcome',
        channelId: 'c_general',
        userId: 'u_bot',
        createdAt: now,
        reactions: {},
        text: [
          `**${ctx.workspaceName}**에 오신 걸 환영해요 👋`,
          '',
          '시작하기 좋은 순서:',
          '1. **설정 → 멤버**에서 동료를 초대하세요',
          '2. **프로젝트**에서 첫 프로젝트와 태스크를 만들어 보세요',
          '3. 오른쪽 위 **Nexus AI**에게 "내일 오후 3시에 팀 회의 잡아줘"처럼 말로 시켜 보세요',
        ].join('\n'),
      },
    ]
  }
  return []
}

/**
 * Per-member state overrides for a member's first visit to a blank workspace — replaces demo defaults
 * baked into store initial state (sample notifications, focus lists pointing at demo people…).
 */
export const STARTER_USER_STATE: Record<string, Record<string, unknown>> = {
  core: { notifications: [] },
  // demo stars / saved messages / read markers / drafts point at demo channels & messages
  messenger: { starred: [], bookmarks: [], lastRead: {}, drafts: {}, collapsed: {}, scheduled: [], lastChannelId: 'c_general', leftChannels: [] },
  // demo "recently visited" pages + expanded demo folders
  docs: { recentIds: [], expanded: {} },
  whiteboard: { viewports: {} },
  // demo: already clocked in at 08:47 and 4.5 days of leave used — a new member has done neither
  people: {
    clock: { date: '', sessions: [], mode: 'office' },
    hoursLog: {},
    balance: { annualTotal: 15, annualUsed: 0, halfTotal: 6, halfUsed: 0, sickTotal: 10, sickUsed: 0 },
  },
  // demo sticky note text; fresh pomodoro stats; the "시작하기" checklist starts visible
  home: { note: '', noteUpdatedAt: null, focusSessions: {}, onboardingDismissed: false },
  'projects-prefs': { views: {}, filters: { search: '', assigneeIds: [], priorities: [], labels: [], mineOnly: false, groupBy: 'status' } },
}
