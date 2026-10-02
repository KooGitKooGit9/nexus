import { AtSign, MessageSquare, SquareCheck, Stamp, CalendarDays, Zap, Bell, FileText, type LucideIcon } from 'lucide-react'
import type { NotificationType } from '@/store/types'

/** Icon + gradient tile per notification type (shared by NotificationPanel and Settings → 알림). */
export const NOTIF_STYLE: Record<NotificationType, { icon: LucideIcon; tile: string; label: string }> = {
  mention: { icon: AtSign, tile: 'from-violet-500 to-fuchsia-500', label: '멘션' },
  message: { icon: MessageSquare, tile: 'from-cyan-400 to-blue-500', label: '메시지' },
  task: { icon: SquareCheck, tile: 'from-amber-400 to-orange-500', label: '태스크' },
  approval: { icon: Stamp, tile: 'from-pink-500 to-rose-500', label: '결재' },
  event: { icon: CalendarDays, tile: 'from-sky-400 to-indigo-500', label: '일정' },
  workflow: { icon: Zap, tile: 'from-emerald-400 to-teal-500', label: '자동화' },
  system: { icon: Bell, tile: 'from-slate-400 to-slate-600', label: '시스템' },
  doc: { icon: FileText, tile: 'from-indigo-400 to-violet-500', label: '문서' },
}
