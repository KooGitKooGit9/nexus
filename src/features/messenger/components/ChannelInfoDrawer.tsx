import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Hash, Headphones, Link2, Lock, LogOut, Pencil, Pin, Star, UserPlus } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { getUser, toast, useCore } from '@/store/core'
import { Avatar, Badge, Button, Drawer, EmptyState, UnderlineTabs, PRESENCE_LABEL } from '@/components/ui'
import { useMessenger } from '../store'
import { channelPath, channelTitle, isDirect, useChatUI } from '../lib'
import { startHuddle } from '../actions'
import { InlinePreview } from '../markdown'
import { FileCard } from './Attachments'
import type { Attachment, Channel } from '../types'

type Tab = 'about' | 'members' | 'files' | 'pins'

export function ChannelInfoDrawer({ channel, onAddMembers }: { channel: Channel; onAddMembers: () => void }) {
  const open = useChatUI((s) => s.infoOpen)
  const setOpen = useChatUI((s) => s.setInfoOpen)
  const [tab, setTab] = useState<Tab>('about')
  const messages = useMessenger((s) => s.messages)
  const starred = useMessenger((s) => s.starred.includes(channel.id))
  const { toggleStar, leaveChannel, updateChannel, setTopic } = useMessenger.getState()
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const direct = isDirect(channel)

  const { files, pins } = useMemo(() => {
    const inCh = messages.filter((m) => m.channelId === channel.id && !m.deleted)
    const files: { att: Attachment; userId: string; at: string; msgId: string }[] = []
    for (const m of inCh) for (const a of m.attachments ?? []) files.push({ att: a, userId: m.userId, at: m.createdAt, msgId: m.id })
    files.sort((a, b) => (a.at < b.at ? 1 : -1))
    return { files, pins: inCh.filter((m) => m.pinned) }
  }, [messages, channel.id])

  const [editField, setEditField] = useState<null | 'topic' | 'description'>(null)
  const [draft, setDraft] = useState('')
  const startEdit = (f: 'topic' | 'description') => {
    setDraft((f === 'topic' ? channel.topic : channel.description) ?? '')
    setEditField(f)
  }
  const saveEdit = () => {
    if (editField === 'topic') setTopic(channel.id, draft.trim())
    else if (editField === 'description') updateChannel(channel.id, { description: draft.trim() })
    setEditField(null)
  }

  const go = (msgId: string) => {
    setOpen(false)
    navigate(channelPath(channel.id, { message: msgId }))
  }

  const members = channel.memberIds.map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => !!u)

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      width={460}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-xl text-white shadow-glow-sm">
            {direct ? <Avatar userId={channel.memberIds.find((x) => x !== me)} size="md" /> : channel.emoji ?? (channel.kind === 'private' ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold">{direct || channel.isApp ? channelTitle(channel) : `#${channel.name}`}</div>
            <div className="text-[11.5px] font-normal text-subtle">{channel.kind === 'private' ? '비공개 채널' : channel.kind === 'public' ? '공개 채널' : channel.isApp ? '앱' : '다이렉트 메시지'} · 멤버 {channel.memberIds.length}명</div>
          </div>
        </div>
      }
    >
      <div className="px-5 pt-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { icon: <Star className={cn('h-4 w-4', starred && 'fill-amber-400 text-amber-400')} />, label: starred ? '즐겨찾기됨' : '즐겨찾기', fn: () => toggleStar(channel.id) },
            { icon: <Headphones className="h-4 w-4" />, label: '허들', fn: () => { setOpen(false); startHuddle(channel.id) } },
            { icon: <Link2 className="h-4 w-4" />, label: '링크 복사', fn: () => { navigator.clipboard?.writeText(location.origin + channelPath(channel.id)).catch(() => {}); toast('채널 링크를 복사했어요', { emoji: '🔗' }) } },
          ].map((a) => (
            <button key={a.label} onClick={a.fn} disabled={channel.isApp && a.label === '허들'} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line/10 bg-line/[0.03] py-3 text-[12px] font-medium text-muted transition hover:border-accent/40 hover:text-fg disabled:opacity-40">
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
        <UnderlineTabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'about', label: '정보' },
            { value: 'members', label: '멤버', count: channel.memberIds.length },
            { value: 'files', label: '파일', count: files.length },
            { value: 'pins', label: '고정됨', count: pins.length },
          ]}
        />
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="p-5">
        {tab === 'about' && (
          <div className="space-y-3">
            {(['topic', 'description'] as const).map((f) => (
              <div key={f} className="group rounded-2xl border border-line/10 bg-line/[0.02] p-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-muted">{f === 'topic' ? '주제' : '설명'}</span>
                  {!direct && !channel.isApp && editField !== f && (
                    <button onClick={() => startEdit(f)} className="flex items-center gap-1 text-[12px] text-accent opacity-0 transition group-hover:opacity-100"><Pencil className="h-3 w-3" />편집</button>
                  )}
                </div>
                {editField === f ? (
                  <div className="space-y-2">
                    <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="input-base resize-none" />
                    <div className="flex justify-end gap-1.5">
                      <Button size="xs" variant="ghost" onClick={() => setEditField(null)}>취소</Button>
                      <Button size="xs" variant="primary" onClick={saveEdit}>저장</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13.5px] text-fg/85">{(f === 'topic' ? channel.topic : channel.description) || <span className="text-subtle">없음</span>}</div>
                )}
              </div>
            ))}
            <div className="rounded-2xl border border-line/10 bg-line/[0.02] p-4 text-[13px]">
              <div className="mb-1 text-[12px] font-semibold text-muted">생성</div>
              <div className="flex items-center gap-2">
                <Avatar userId={channel.createdBy} size="xs" />
                {getUser(channel.createdBy)?.name}님이 {format(new Date(channel.createdAt), 'yyyy년 M월 d일', { locale: ko })}에 만들었습니다
              </div>
            </div>
            {!direct && !channel.isApp && channel.id !== 'c_general' && (
              <Button
                variant="outline"
                className="w-full border-danger/30 text-danger hover:border-danger/60 hover:bg-danger/5"
                leftIcon={<LogOut className="h-4 w-4" />}
                onClick={() => {
                  leaveChannel(channel.id)
                  setOpen(false)
                  toast(`#${channel.name} 채널에서 나왔어요`, { emoji: '👋' })
                  navigate('/messages/c_general')
                }}
              >
                채널 나가기
              </Button>
            )}
          </div>
        )}

        {tab === 'members' && (
          <div className="space-y-1">
            {!direct && !channel.isApp && (
              <button onClick={() => { setOpen(false); onAddMembers() }} className="mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-accent/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm"><UserPlus className="h-4 w-4" /></span>
                <span className="text-[13.5px] font-semibold text-accent">멤버 추가</span>
              </button>
            )}
            {members.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-line/[0.04]">
                <Avatar user={u} size="md" showPresence />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">{u.name} {u.statusEmoji}</div>
                  <div className="truncate text-[11.5px] text-subtle">{u.title} · {PRESENCE_LABEL[u.presence]}</div>
                </div>
                {u.id === channel.createdBy && <Badge tone="accent">관리자</Badge>}
              </div>
            ))}
          </div>
        )}

        {tab === 'files' && (
          files.length ? (
            <div className="space-y-4">
              {files.some((f) => f.att.mime.startsWith('image/')) && (
                <div className="grid grid-cols-3 gap-2">
                  {files.filter((f) => f.att.mime.startsWith('image/')).map((f) => (
                    <button key={f.att.id} onClick={() => go(f.msgId)} className={cn('group relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br shadow-card', f.att.gradient ?? 'from-violet-500 to-cyan-500')}>
                      {f.att.url && <img src={f.att.url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                      <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-1 pt-4 text-left text-[10.5px] text-white opacity-0 transition group-hover:opacity-100">{f.att.name}</div>
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                {files.filter((f) => !f.att.mime.startsWith('image/')).map((f) => (
                  <div key={f.att.id}>
                    <FileCard att={f.att} compact />
                    <div className="mt-1 px-1 text-[11px] text-subtle">{getUser(f.userId)?.name} · {timeAgo(f.at)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={<Link2 />} title="공유된 파일이 없어요" description="메시지에 파일을 첨부하면 여기에 모아서 보여드려요." />
          )
        )}

        {tab === 'pins' && (
          pins.length ? (
            <div className="space-y-2">
              {pins.map((m) => (
                <button key={m.id} onClick={() => go(m.id)} className="w-full rounded-2xl border border-line/10 bg-line/[0.02] p-3 text-left transition hover:border-accent/30">
                  <div className="mb-1 flex items-center gap-2 text-[12.5px]">
                    <Avatar userId={m.userId} size="xs" />
                    <b>{getUser(m.userId)?.name}</b>
                    <span className="text-subtle">{timeAgo(m.createdAt)}</span>
                  </div>
                  <div className="line-clamp-3 text-[13px] text-fg/80"><InlinePreview text={m.text || '첨부 파일'} /></div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Pin />} title="고정된 메시지가 없어요" />
          )
        )}
      </motion.div>
    </Drawer>
  )
}
