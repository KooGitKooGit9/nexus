import { useRef, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Hash, UploadCloud } from 'lucide-react'
import { toast, useCore } from '@/store/core'
import { Button } from '@/components/ui'
import { useMessenger } from '../store'
import { channelLabel, channelTitle, isDirect, useChatUI } from '../lib'
import { ChannelHeader } from '../components/ChannelHeader'
import { MessageList, TypingIndicator } from '../components/MessageList'
import { Composer } from '../components/Composer'
import { ChannelInfoDrawer } from '../components/ChannelInfoDrawer'
import { MembersModal } from '../components/modals'
import type { Channel } from '../types'

export function ChannelView({ channel, focusId }: { channel: Channel; focusId: string | null }) {
  const me = useCore((s) => s.currentUserId)
  const joinChannel = useMessenger((s) => s.joinChannel)
  const [members, setMembers] = useState<{ open: boolean; adding: boolean }>({ open: false, adding: false })
  const [topicSignal, setTopicSignal] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const dropRef = useRef<((files: File[]) => void) | null>(null)
  const isMember = channel.memberIds.includes(me)

  const placeholder = isDirect(channel) || channel.isApp ? `${channelTitle(channel)}에게 메시지 보내기` : `#${channel.name}에 메시지 보내기`

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e) || !isMember) return
        e.preventDefault()
        dragDepth.current++
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (hasFiles(e) && isMember) e.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDragging(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e) || !isMember) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length) {
          dropRef.current?.(files)
          toast(`파일 ${files.length}개를 업로드하고 있어요`, { emoji: "📎" })
        }
      }}
    >
      <ChannelHeader channel={channel} onMembers={() => setMembers({ open: true, adding: false })} editTopicSignal={topicSignal} />
      <MessageList
        key={`list-${channel.id}`}
        channel={channel}
        focusId={focusId}
        onAddMembers={() => setMembers({ open: true, adding: true })}
        onEditTopic={() => setTopicSignal((n) => n + 1)}
      />
      <TypingIndicator typingKey={channel.id} />
      {isMember ? (
        <Composer key={`composer-${channel.id}`} channelId={channel.id} placeholder={placeholder} fileDropRef={dropRef} />
      ) : (
        <div className="px-5 pb-5">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line/10 bg-surface/60 p-5 text-center backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[14px]">
              <Hash className="h-4 w-4 text-muted" />
              <b>{channel.name}</b> 채널을 미리 보는 중이에요
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  joinChannel(channel.id)
                  toast(`${channelLabel(channel)} 채널에 참여했어요`, { emoji: channel.emoji ?? '🎉', variant: 'success' })
                }}
              >
                채널 참여하기
              </Button>
              <Button variant="ghost" onClick={() => useChatUI.getState().setInfoOpen(true)}>세부 정보</Button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-3xl border-2 border-dashed border-accent/60 bg-accent/10 backdrop-blur-md"
          >
            <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl bg-accent-gradient opacity-60 blur-2xl" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-accent-gradient text-white shadow-glow animate-float">
                  <UploadCloud className="h-9 w-9" />
                </div>
              </div>
              <div className="text-lg font-bold">여기에 파일을 놓으세요</div>
              <div className="text-sm text-muted">{channelLabel(channel)}에 업로드됩니다</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChannelInfoDrawer channel={channel} onAddMembers={() => setMembers({ open: true, adding: true })} />
      <MembersModal channel={channel} open={members.open} startAdding={members.adding} onClose={() => setMembers({ open: false, adding: false })} />
    </div>
  )
}
