import {
  CalendarPlus, FilePlus2, ListPlus, Stamp, Workflow, Megaphone, Target, PenTool, Sun, Moon, PanelLeftClose,
  BellOff, Keyboard, Sparkles, Palette, Settings, type LucideIcon,
} from 'lucide-react'
import { NAV } from '@/app/nav'
import { getSessionScope } from '@/lib/session'
import { useCore, useUI, toast, toggleSidebarResponsive } from '@/store/core'
import { ACCENTS } from '@/features/settings/constants'
import type { SearchFn, SearchResult } from '@/lib/search'
import { search as searchMessenger } from '@/features/messenger/search'
import { search as searchProjects } from '@/features/projects/search'
import { search as searchDocs } from '@/features/docs/search'
import { search as searchFiles } from '@/features/files/search'
import { search as searchCalendar } from '@/features/calendar/search'
import { search as searchWorkflows } from '@/features/workflows/search'
import { search as searchApprovals } from '@/features/approvals/search'
import { search as searchGoals } from '@/features/goals/search'
import { search as searchPeople } from '@/features/people/search'
import { search as searchWhiteboard } from '@/features/whiteboard/search'

export interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  icon?: LucideIcon
  emoji?: string
  /** CSS background for the icon tile */
  tile?: string
  userId?: string
  keywords?: string[]
  /** "G then X" navigation hotkey */
  hotkey?: string
  /** key combo hint, e.g. ['⌘','J'] */
  shortcut?: string[]
  href?: string
  run: () => void
}

export type Navigate = (to: string) => void

export function buildCommands(navigate: Navigate) {
  const go: PaletteItem[] = NAV.map((n) => ({
    id: `go:${n.path}`,
    title: n.label,
    subtitle: '이동',
    icon: n.icon,
    hotkey: n.hotkey,
    href: n.path,
    keywords: [n.path.slice(1), '이동', 'go'],
    run: () => navigate(n.path),
  }))

  const createDefs: [string, string, LucideIcon, string, string[]][] = [
    ['task', '새 태스크', ListPlus, '/projects?new=1', ['task', '이슈', '할일', '할 일']],
    ['event', '새 일정', CalendarPlus, '/calendar?new=1', ['event', '미팅', '회의', '캘린더']],
    ['doc', '새 문서', FilePlus2, '/docs?new=1', ['doc', '페이지', '위키', '노트']],
    ['approval', '결재 올리기', Stamp, '/approvals?new=1', ['approval', '휴가', '지출', '품의']],
    ['workflow', '새 워크플로우', Workflow, '/workflows?new=1', ['automation', '자동화', 'zap']],
    ['announcement', '새 공지', Megaphone, '/announcements?new=1', ['notice', '공지사항']],
    ['goal', '새 목표', Target, '/goals?new=1', ['okr', 'objective', '목표']],
    ['whiteboard', '새 화이트보드', PenTool, '/whiteboard?new=1', ['board', '캔버스', '그리기']],
  ]
  const create: PaletteItem[] = createDefs.map(([k, title, icon, href, keywords]) => ({
    id: `new:${k}`, title, subtitle: '만들기', icon, href, keywords: ['만들기', '생성', 'new', 'create', ...keywords], run: () => navigate(href),
  }))

  const core = useCore.getState
  const settings: PaletteItem[] = [
    {
      id: 'cmd:theme', title: '테마 전환', subtitle: core().theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환',
      icon: core().theme === 'dark' ? Sun : Moon, keywords: ['theme', 'dark', 'light', '다크', '라이트', '모드'],
      run: () => { core().toggleTheme(); toast(core().theme === 'dark' ? '다크 모드' : '라이트 모드', { emoji: core().theme === 'dark' ? '🌙' : '☀️' }) },
    },
    ...ACCENTS.map<PaletteItem>((a) => ({
      id: `cmd:accent:${a.id}`, title: `액센트 색상: ${a.label}`, subtitle: core().accent === a.id ? '현재 사용 중' : '액센트 변경',
      icon: Palette, tile: `linear-gradient(135deg, ${a.from}, ${a.via})`, keywords: ['accent', 'color', '색상', '컬러', a.id],
      run: () => { core().setAccent(a.id); toast(`액센트 색상을 '${a.label}'(으)로 변경했어요`, { emoji: '🎨', variant: 'success' }) },
    })),
    {
      id: 'cmd:sidebar', title: core().sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기', icon: PanelLeftClose, shortcut: ['['],
      keywords: ['sidebar', '사이드바', '접기', '펼치기'], run: () => toggleSidebarResponsive(),
    },
    {
      id: 'cmd:dnd', title: '상태를 방해 금지로', subtitle: '알림을 잠시 꺼둡니다', icon: BellOff, keywords: ['dnd', 'do not disturb', '방해금지', '집중', '상태'],
      run: () => { core().setPresence('dnd'); core().setStatus('🔕', '방해 금지'); toast('방해 금지 모드가 켜졌어요', { emoji: '🔕', description: '알림이 조용히 쌓입니다' }) },
    },
    {
      id: 'cmd:shortcuts', title: '단축키 보기', icon: Keyboard, shortcut: ['?'], keywords: ['shortcut', 'keyboard', '키보드', '단축키'],
      run: () => useUI.getState().setShortcutsOpen(true),
    },
    {
      id: 'cmd:ai', title: 'Nexus AI 열기', icon: Sparkles, shortcut: ['⌘', 'J'], keywords: ['ai', '어시스턴트', '챗', 'chat'],
      run: () => useUI.getState().setAiOpen(true),
    },
    {
      id: 'cmd:settings-appearance', title: '테마 & 외관 설정', icon: Settings, keywords: ['설정', 'settings', 'appearance'], href: '/settings/appearance',
      run: () => navigate('/settings/appearance'),
    },
  ]
  return { go, create, settings }
}

export const SEARCHERS: [string, SearchFn][] = [
  ['messenger', searchMessenger],
  ['projects', searchProjects],
  ['docs', searchDocs],
  ['files', searchFiles],
  ['calendar', searchCalendar],
  ['workflows', searchWorkflows],
  ['approvals', searchApprovals],
  ['goals', searchGoals],
  ['people', searchPeople],
  ['whiteboard', searchWhiteboard],
]

/** Run every feature's search; one broken feature never breaks the palette. */
export function searchAll(q: string): SearchResult[] {
  const out: SearchResult[] = []
  const seen = new Set<string>()
  for (const [, fn] of SEARCHERS) {
    try {
      for (const r of fn(q) ?? []) {
        const key = `${r.group}:${r.href}:${r.title}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(r)
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

const GROUP_EMOJI: [RegExp, string][] = [
  [/메시지|대화/, '💬'], [/채널/, '#️⃣'], [/태스크|이슈|할 ?일/, '✅'], [/프로젝트/, '📁'], [/문서|위키|페이지/, '📄'],
  [/파일|드라이브|폴더/, '🗂️'], [/일정|캘린더|회의/, '📅'], [/워크플로우|자동화/, '⚡'], [/결재/, '🖋️'],
  [/목표|okr|kr/i, '🎯'], [/공지/, '📣'], [/사람|구성원|멤버/, '👤'],
]

export function groupEmoji(group: string): string {
  return GROUP_EMOJI.find(([re]) => re.test(group))?.[1] ?? '🔎'
}

/* ───────────── recent selections ───────────── */

export interface RecentEntry {
  id: string
  title: string
  subtitle?: string
  emoji?: string
  href?: string
  userId?: string
}

// per workspace member: recent picks must never leak across workspaces / accounts on one browser
const RECENT_BASE = 'nexus:palette-recent'
const recentKey = () => {
  const scope = getSessionScope()
  return scope ? `${RECENT_BASE}@${scope}` : RECENT_BASE
}

export function loadRecent(): RecentEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey()) ?? '[]')
    return Array.isArray(v) ? v.slice(0, 5) : []
  } catch {
    return []
  }
}

export function pushRecent(e: RecentEntry) {
  try {
    const next = [e, ...loadRecent().filter((r) => r.id !== e.id)].slice(0, 5)
    localStorage.setItem(recentKey(), JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
