import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Compass, MessageSquareOff } from 'lucide-react'
import { getUser, useCore } from '@/store/core'
import { Button, EmptyState } from '@/components/ui'
import { useMessenger } from './store'
import { useChatUI } from './lib'
import { useMessengerSimulator } from './simulator'
import { ChannelSidebar, type SidebarView } from './components/ChannelSidebar'
import { ThreadPanel } from './components/ThreadPanel'
import { BrowseChannelsModal, CreateChannelModal, NewDMModal } from './components/modals'
import { ChannelView } from './views/ChannelView'
import { SearchPanel } from './views/SearchPanel'
import { SavedView } from './views/SavedView'
import { ActivityView } from './views/ActivityView'
import { ThreadsView } from './views/ThreadsView'

const VIEWS: SidebarView[] = ['threads', 'activity', 'saved']

export default function MessengerPage() {
  useMessengerSimulator()
  const params = useParams()
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const me = useCore((s) => s.currentUserId)
  const channels = useMessenger((s) => s.channels)
  const lastChannelId = useMessenger((s) => s.lastChannelId)
  const setLastChannel = useMessenger((s) => s.setLastChannel)
  const searchOpen = useChatUI((s) => s.searchOpen && s.searchQuery.trim().length > 0)
  const narrow = useChatUI((s) => s.narrow)
  const sidebarOpen = useChatUI((s) => s.sidebarOpen)
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null)

  const segs = (params['*'] ?? '').split('/').filter(Boolean)
  const view = (VIEWS as string[]).includes(segs[0]) ? (segs[0] as SidebarView) : null
  const channelId = view ? null : segs[0] ?? null
  const threadId = segs[1] === 'thread' ? segs[2] ?? null : null
  const focusId = sp.get('m')
  const hasRoute = segs.length > 0
  const channel = channels.find((c) => c.id === channelId && (c.kind === 'public' || c.memberIds.includes(me)))

  const [createOpen, setCreateOpen] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)

  useEffect(() => {
    if (channel) setLastChannel(channel.id)
  }, [channel, setLastChannel])

  // deep links from other modules: ?dm=<userId> opens (or creates) a 1:1 DM, ?new=1 opens the new-message picker,
  // ?channel=1 opens the create-channel dialog
  useEffect(() => {
    const dm = sp.get('dm')
    if (dm) {
      if (getUser(dm) && dm !== 'u_bot') {
        const ch = useMessenger.getState().openDM([dm])
        navigate(`/messages/${ch.id}`, { replace: true })
      } else {
        const next = new URLSearchParams(sp)
        next.delete('dm')
        setSp(next, { replace: true })
      }
      return
    }
    if (!hasRoute) return // wait for the redirect to a channel (query is preserved)
    if (sp.get('new') === '1' || sp.get('channel') === '1') {
      if (sp.get('new') === '1') setDmOpen(true)
      else setCreateOpen(true)
      const next = new URLSearchParams(sp)
      next.delete('new')
      next.delete('channel')
      setSp(next, { replace: true })
    }
  }, [sp, setSp, navigate, hasRoute])

  // close the info drawer when switching channels
  useEffect(() => {
    useChatUI.getState().setInfoOpen(false)
  }, [channelId])

  // container-width responsive layout (the app sidebar may be expanded or collapsed, so viewport width isn't enough)
  useEffect(() => {
    if (!rootEl || typeof ResizeObserver === 'undefined') return
    const apply = (w: number) => useChatUI.getState().setNarrow(w > 0 && w < 900)
    apply(rootEl.getBoundingClientRect().width)
    const ro = new ResizeObserver((entries) => apply(entries[0]?.contentRect.width ?? 0))
    ro.observe(rootEl)
    return () => ro.disconnect()
  }, [rootEl])

  // the overlay channel list closes once you pick something
  useEffect(() => {
    useChatUI.getState().setSidebarOpen(false)
  }, [channelId, view, threadId])

  // ?m=<id> pointing at a thread reply (bell, pins, saved, search) → open its thread instead of a channel that doesn't show it
  const focusMsg = useMessenger((s) => (focusId && channelId && !threadId ? s.messages.find((m) => m.id === focusId) : undefined))
  const focusThread = focusMsg && focusMsg.channelId === channelId && focusMsg.threadId && !focusMsg.alsoInChannel ? focusMsg.threadId : null
  useEffect(() => {
    if (focusThread && channelId && focusId) navigate(`/messages/${channelId}/thread/${focusThread}?m=${focusId}`, { replace: true })
  }, [focusThread, channelId, focusId, navigate])

  const closeThread = useCallback(() => {
    if (channelId) navigate(`/messages/${channelId}`)
  }, [channelId, navigate])

  if (!segs.length) {
    if (sp.get('dm')) return null // handled by the deep-link effect above
    const target = channels.find((c) => c.id === lastChannelId && c.memberIds.includes(me)) ? lastChannelId : 'c_general'
    return <Navigate to={`/messages/${target}${sp.toString() ? `?${sp}` : ''}`} replace />
  }

  const rightPanel = searchOpen ? 'search' : threadId && channel ? `thread:${threadId}` : null

  const sidebar = (
    <ChannelSidebar
      activeId={channel?.id ?? null}
      activeView={view}
      onCreateChannel={() => {
        useChatUI.getState().setSidebarOpen(false)
        setCreateOpen(true)
      }}
      onBrowse={() => {
        useChatUI.getState().setSidebarOpen(false)
        setBrowseOpen(true)
      }}
      onNewDM={() => {
        useChatUI.getState().setSidebarOpen(false)
        setDmOpen(true)
      }}
    />
  )

  return (
    <div ref={setRootEl} className="relative flex h-full w-full overflow-hidden">
      {!narrow && sidebar}
      <AnimatePresence>
        {narrow && sidebarOpen && (
          <>
            <motion.div
              key="sidebar-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => useChatUI.getState().setSidebarOpen(false)}
              className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            />
            <motion.div
              key="sidebar-panel"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="absolute inset-y-0 left-0 z-50 flex max-w-[85%] bg-surface/95 shadow-float"
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1">
        {view === 'saved' ? (
          <SavedView />
        ) : view === 'activity' ? (
          <ActivityView />
        ) : view === 'threads' ? (
          <ThreadsView />
        ) : channel ? (
          <ChannelView channel={channel} focusId={threadId ? null : focusId} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<MessageSquareOff />}
              title="대화를 찾을 수 없어요"
              description="채널이 삭제되었거나 접근 권한이 없을 수 있어요."
              action={
                <div className="flex gap-2">
                  <Button variant="primary" leftIcon={<Compass className="h-4 w-4" />} onClick={() => setBrowseOpen(true)}>채널 탐색</Button>
                  <Button variant="ghost" onClick={() => navigate('/messages/c_general')}>#general로 이동</Button>
                </div>
              }
            />
          </div>
        )}
      </main>

      <AnimatePresence initial={false}>
        {rightPanel && narrow && (
          // narrow: the panel floats over the conversation instead of squeezing it
          <motion.aside
            key={rightPanel.startsWith('thread') ? 'thread-overlay' : 'search-overlay'}
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            className="absolute inset-y-0 right-0 z-30 w-[min(420px,100%)] border-l border-line/[0.07] bg-surface/95 shadow-float backdrop-blur-2xl"
          >
            {rightPanel === 'search' ? (
              <SearchPanel channelId={channel?.id ?? null} />
            ) : (
              channel && threadId && <ThreadPanel key={threadId} channelId={channel.id} rootId={threadId} onClose={closeThread} />
            )}
          </motion.aside>
        )}
        {rightPanel && !narrow && (
          <motion.aside
            key={rightPanel.startsWith('thread') ? 'thread' : 'search'}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="relative h-full shrink-0 overflow-hidden border-l border-line/[0.07] bg-surface/40 backdrop-blur-2xl"
          >
            <div className="h-full w-[420px]">
              {rightPanel === 'search' ? (
                <SearchPanel channelId={channel?.id ?? null} />
              ) : (
                channel && threadId && <ThreadPanel key={threadId} channelId={channel.id} rootId={threadId} onClose={closeThread} />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <CreateChannelModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <BrowseChannelsModal open={browseOpen} onClose={() => setBrowseOpen(false)} onCreate={() => setCreateOpen(true)} />
      <NewDMModal open={dmOpen} onClose={() => setDmOpen(false)} />
    </div>
  )
}
