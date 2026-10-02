import type { Tone } from '@/components/ui'
import type { AnnouncementCategory } from '@/features/goals/types'

export const CATEGORIES: AnnouncementCategory[] = ['전사공지', '인사', '제품', '이벤트', 'IT']

export const CATEGORY_META: Record<AnnouncementCategory, { tone: Tone; emoji: string; color: string }> = {
  전사공지: { tone: 'accent', emoji: '📢', color: '#8b5cf6' },
  인사: { tone: 'success', emoji: '🌱', color: '#34d399' },
  제품: { tone: 'cyan', emoji: '🚀', color: '#22d3ee' },
  이벤트: { tone: 'pink', emoji: '🎉', color: '#f472b6' },
  IT: { tone: 'info', emoji: '🔐', color: '#60a5fa' },
}

export const QUICK_REACTIONS = ['👍', '🎉', '❤️', '🙌', '🚀', '😍', '👀', '✅', '🙏', '🔥', '😂', '🥳']
