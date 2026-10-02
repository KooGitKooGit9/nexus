import {
  Home, MessagesSquare, KanbanSquare, CalendarDays, FileText, FolderOpen, PenTool, Workflow,
  Stamp, Target, Megaphone, Users, Settings, type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  section: 'main' | 'work' | 'company' | 'system'
  /** keyboard shortcut: g + key */
  hotkey?: string
}

export const NAV: NavItem[] = [
  { path: '/', label: '홈', icon: Home, section: 'main', hotkey: 'h' },
  { path: '/messages', label: '메신저', icon: MessagesSquare, section: 'main', hotkey: 'm' },
  { path: '/projects', label: '프로젝트', icon: KanbanSquare, section: 'work', hotkey: 'p' },
  { path: '/calendar', label: '캘린더', icon: CalendarDays, section: 'work', hotkey: 'c' },
  { path: '/docs', label: '문서 & 위키', icon: FileText, section: 'work', hotkey: 'd' },
  { path: '/files', label: '드라이브', icon: FolderOpen, section: 'work', hotkey: 'f' },
  { path: '/whiteboard', label: '화이트보드', icon: PenTool, section: 'work', hotkey: 'b' },
  { path: '/workflows', label: '자동화', icon: Workflow, section: 'work', hotkey: 'w' },
  { path: '/approvals', label: '전자결재', icon: Stamp, section: 'company', hotkey: 'a' },
  { path: '/goals', label: '목표 & OKR', icon: Target, section: 'company', hotkey: 'o' },
  { path: '/announcements', label: '공지사항', icon: Megaphone, section: 'company', hotkey: 'n' },
  { path: '/people', label: '구성원', icon: Users, section: 'company', hotkey: 'u' },
  { path: '/settings', label: '설정', icon: Settings, section: 'system', hotkey: 's' },
]

export const SECTION_LABEL: Record<NavItem['section'], string> = {
  main: '',
  work: '업무',
  company: '회사',
  system: '',
}
