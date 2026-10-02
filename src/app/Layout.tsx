import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCore, useUI, toggleSidebarResponsive } from '@/store/core'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { AuroraBackground } from './AuroraBackground'
import { NAV } from './nav'
import { CommandPalette } from './shell/CommandPalette'
import { NotificationPanel } from './shell/NotificationPanel'
import { AIPanel } from './shell/AIPanel'
import { Toaster } from './shell/Toaster'
import { ShortcutsModal } from './shell/ShortcutsModal'
import { CallOverlay } from '@/features/messenger/CallOverlay'
import { Skeleton } from '@/components/ui'
import { startEventReminders } from '@/features/calendar/reminders'
import { startInboxDelivery } from '@/lib/inbox'
import { startWorkflowEngine } from '@/features/workflows/engine'
import { notify, toast } from '@/store/core'
import { onSyncEvent } from '@/lib/sync'
import { UpgradePromptHost } from '@/features/settings/billing'
// Side-effect import: starts the focus-timer watcher even when Home (lazy) hasn't been visited yet
import '@/features/home/store'

function useThemeSync() {
  const theme = useCore((s) => s.theme)
  const accent = useCore((s) => s.accent)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.accent = accent
  }, [theme, accent])
}

/** Global hotkeys: ⌘K palette, ⌘J AI, [ sidebar, g+<key> navigation, ? shortcuts */
function useGlobalHotkeys() {
  const navigate = useNavigate()
  useEffect(() => {
    let gPressed = 0
    // Match physical keys (e.code) so shortcuts also work while the Korean IME is active (e.key would be 'ㅎ' etc.)
    const isKey = (e: KeyboardEvent, letter: string) => e.key.toLowerCase() === letter || e.code === 'Key' + letter.toUpperCase()
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat) return
      const t = e.target as HTMLElement
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
      const ui = useUI.getState()
      if ((e.metaKey || e.ctrlKey) && isKey(e, 'k')) { e.preventDefault(); ui.setCommandOpen(!ui.commandOpen); return }
      if ((e.metaKey || e.ctrlKey) && isKey(e, 'j')) { e.preventDefault(); ui.setAiOpen(!ui.aiOpen); return }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '[' || e.code === 'BracketLeft') { toggleSidebarResponsive(); return }
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) { ui.setShortcutsOpen(true); return }
      if (e.shiftKey) return
      if (isKey(e, 'g')) { gPressed = Date.now(); return }
      if (Date.now() - gPressed < 1000) {
        const item = NAV.find((n) => n.hotkey && isKey(e, n.hotkey))
        if (item) { navigate(item.path); gPressed = 0 }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
}

function PageFallback() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      <Skeleton className="h-72" />
    </div>
  )
}

export function Layout() {
  useThemeSync()
  useGlobalHotkeys()
  useEffect(() => { startEventReminders() }, [])
  // Bell entry always; skip the toast when the user is already looking at the linked page
  useEffect(() => startInboxDelivery((n) => notify(n, !(n.link && n.link.split('?')[0] === location.pathname))), [])
  // Real automation: event triggers (acting client) + cron / calendar triggers (sync leader)
  useEffect(() => startWorkflowEngine(), [])
  // Server-side rejections (plan limits…) arrive over the socket
  useEffect(() => onSyncEvent('server-error', (m) => toast(String(m.message ?? '요청이 거절되었어요.'), { variant: 'warning', emoji: m.error === 'PLAN_LIMIT' ? '💎' : '⚠️' })), [])
  const loc = useLocation()
  const section = '/' + (loc.pathname.split('/')[1] ?? '')
  const reduceMotion = useCore((s) => s.reduceMotion)

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
    <div className="relative flex h-full w-full overflow-hidden">
      <AuroraBackground />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
      <NotificationPanel />
      <AIPanel />
      <ShortcutsModal />
      <CallOverlay />
      <Toaster />
      <UpgradePromptHost />
    </div>
    </MotionConfig>
  )
}
