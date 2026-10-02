import { PanelLeft } from 'lucide-react'
import { useCore } from '@/store/core'
import { Tooltip } from '@/components/ui'
import { useMessenger } from '../store'
import { useChatUI } from '../lib'

/** Opens the overlay channel list when the messenger is too narrow to show it inline. */
export function SidebarToggle() {
  const narrow = useChatUI((s) => s.narrow)
  const me = useCore((s) => s.currentUserId)
  // re-render on new messages / reads so the dot stays accurate
  const unread = useMessenger((s) => s.unreadTotal(me))
  if (!narrow) return null
  return (
    <Tooltip content="채널 목록" side="bottom">
      <button
        onClick={() => useChatUI.getState().setSidebarOpen(true)}
        aria-label="채널 목록 열기"
        className="relative -ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-line/[0.07] hover:text-fg"
      >
        <PanelLeft className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />}
      </button>
    </Tooltip>
  )
}
