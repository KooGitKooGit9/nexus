import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Check, Globe2, Hash, Lock, Search, Smile, UserPlus, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCurrentUserId, toast, useCore } from '@/store/core'
import { Avatar, Badge, Button, Field, Modal, Popover, PresenceDot, Tabs, PRESENCE_LABEL } from '@/components/ui'
import { useMessenger } from '../store'
import { slugify } from '../lib'
import { EmojiPicker } from './EmojiPicker'
import type { Channel } from '../types'
import { isHuman, joinMeta } from '@/features/people/format'

/* ───────────── User picker ───────────── */

export function UserPicker({ selected, onChange, exclude = [], height = 'max-h-64' }: { selected: string[]; onChange: (ids: string[]) => void; exclude?: string[]; height?: string }) {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const list = users.filter(
    (u) => u.id !== me && isHuman(u) && !exclude.includes(u.id) && (!q || u.name.includes(q) || (u.nameEn ?? '').toLowerCase().includes(q.toLowerCase()) || (u.title ?? '').includes(q) || (u.department ?? '').includes(q) || (u.email ?? '').toLowerCase().includes(q.toLowerCase())),
  )
  const nobodyElse = !users.some((u) => u.id !== me && isHuman(u) && !exclude.includes(u.id))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <div className="rounded-2xl border border-line/10 bg-surface-2/40">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line/[0.07] p-2">
        {selected.map((id) => {
          const u = users.find((x) => x.id === id)
          return (
            <motion.span key={id} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 rounded-full bg-accent/15 py-0.5 pl-0.5 pr-1.5 text-[12px] font-medium text-accent">
              <Avatar userId={id} size="xs" />
              {u?.name ?? '나간 멤버'}
              <button onClick={() => toggle(id)} className="rounded-full p-0.5 hover:bg-accent/20"><X className="h-3 w-3" /></button>
            </motion.span>
          )
        })}
        <div className="relative min-w-[140px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름, 직함, 부서로 검색" className="h-8 w-full bg-transparent pl-7 text-[13px] outline-none placeholder:text-subtle" />
        </div>
      </div>
      <div className={cn('overflow-y-auto p-1', height)}>
        {list.map((u) => {
          const on = selected.includes(u.id)
          return (
            <button key={u.id} onClick={() => toggle(u.id)} className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition', on ? 'bg-accent/10' : 'hover:bg-line/[0.05]')}>
              <div className="relative">
                <Avatar user={u} size="sm" />
                <PresenceDot presence={u.presence} className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-medium">{u.name} {u.statusEmoji && <span className="text-[12px]">{u.statusEmoji}</span>}</div>
                <div className="truncate text-[11.5px] text-subtle">{joinMeta(u.title, u.department) || u.email}</div>
              </div>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border transition', on ? 'border-transparent bg-accent-gradient text-white' : 'border-line/20')}>
                {on && <Check className="h-3 w-3" />}
              </span>
            </button>
          )
        })}
        {!list.length && (nobodyElse ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="text-2xl">👋</div>
            <div className="text-[12.5px] text-muted">{exclude.length > 1 ? '추가할 수 있는 멤버가 없어요' : '아직 워크스페이스에 다른 멤버가 없어요'}</div>
            <button onClick={() => navigate('/settings/members')} className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2.5 py-1 text-[12px] font-medium text-accent transition hover:bg-accent/20">
              <UserPlus className="h-3.5 w-3.5" /> 동료 초대하기
            </button>
          </div>
        ) : (
          <div className="py-6 text-center text-[12.5px] text-subtle">검색 결과가 없어요</div>
        ))}
      </div>
    </div>
  )
}

/* ───────────── Create channel ───────────── */

export function CreateChannelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [emoji, setEmoji] = useState('✨')
  const [kind, setKind] = useState<'public' | 'private'>('public')
  const [members, setMembers] = useState<string[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const channels = useMessenger((s) => s.channels)
  const createChannel = useMessenger((s) => s.createChannel)
  const navigate = useNavigate()
  const slug = slugify(name)
  const exists = channels.some((c) => c.name === slug && (c.kind === 'public' || c.kind === 'private'))
  const valid = slug.length >= 2 && !exists

  const reset = () => {
    setName('')
    setDesc('')
    setEmoji('✨')
    setKind('public')
    setMembers([])
  }
  const submit = () => {
    if (!valid) return
    const ch = createChannel({ name: slug, kind, memberIds: members, description: desc || undefined, emoji })
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: ['#8b5cf6', '#22d3ee', '#f472b6'] })
    toast(`#${slug} 채널이 만들어졌어요`, { emoji, variant: 'success' })
    reset()
    onClose()
    navigate(`/messages/${ch.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="채널 만들기"
      description="채널은 팀이 소통하는 공간이에요. 주제별로 만들어 대화를 정리해보세요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>채널 만들기</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="이름" hint={exists ? <span className="text-danger">이미 같은 이름의 채널이 있어요</span> : slug && slug !== name ? <>채널 이름은 <b className="font-mono">#{slug}</b>(으)로 저장됩니다</> : '소문자, 숫자, 하이픈(-)을 사용할 수 있어요'}>
          <div className="flex gap-2">
            <Popover placement="bottom-start" className="p-1" open={emojiOpen} onOpenChange={setEmojiOpen} trigger={({ toggle }) => (
              <button type="button" onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line/10 bg-surface-2/70 text-xl transition hover:border-accent/40">
                {emoji || <Smile className="h-4 w-4" />}
              </button>
            )}>
              <EmojiPicker onPick={(e) => { setEmoji(e); setEmojiOpen(false) }} />
            </Popover>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">{kind === 'private' ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && submit()}
                placeholder="예: q4-launch"
                maxLength={40}
                className="input-base h-10 pl-9"
              />
            </div>
          </div>
        </Field>
        <Field label="설명 (선택)">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="이 채널은 무엇에 관한 곳인가요?" className="input-base" />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">공개 범위</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'public', icon: <Globe2 className="h-4 w-4" />, t: '공개', d: '워크스페이스 누구나 찾고 참여할 수 있어요' },
              { v: 'private', icon: <Lock className="h-4 w-4" />, t: '비공개', d: '초대된 멤버만 볼 수 있어요' },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setKind(o.v)}
                className={cn('relative rounded-2xl border p-3 text-left transition', kind === o.v ? 'border-accent/50 bg-accent/[0.07] shadow-glow-sm' : 'border-line/10 hover:border-line/25')}
              >
                <div className={cn('mb-1 flex items-center gap-2 text-[13.5px] font-semibold', kind === o.v && 'text-accent')}>{o.icon}{o.t}</div>
                <div className="text-[12px] text-muted">{o.d}</div>
                {kind === o.v && <motion.span layoutId="kind-check" className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent-gradient text-white"><Check className="h-3 w-3" /></motion.span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
            <span>멤버 초대</span>
            <span className="text-subtle">{members.length}명 선택됨</span>
          </div>
          <UserPicker selected={members} onChange={setMembers} height="max-h-48" />
        </div>
      </div>
    </Modal>
  )
}

/* ───────────── Browse channels ───────────── */

export function BrowseChannelsModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: () => void }) {
  const me = useCore((s) => s.currentUserId)
  const channels = useMessenger((s) => s.channels)
  const messages = useMessenger((s) => s.messages)
  const { joinChannel, leaveChannel } = useMessenger.getState()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | 'joined' | 'other'>('all')

  const list = useMemo(() => {
    return channels
      .filter((c) => (c.kind === 'public' || (c.kind === 'private' && c.memberIds.includes(me))) && !c.archived)
      .filter((c) => (tab === 'joined' ? c.memberIds.includes(me) : tab === 'other' ? !c.memberIds.includes(me) : true))
      .filter((c) => !q || c.name.includes(q.toLowerCase()) || c.description?.includes(q) || c.topic?.includes(q))
      .sort((a, b) => b.memberIds.length - a.memberIds.length)
  }, [channels, me, tab, q])

  const msgCount = (id: string) => messages.filter((m) => m.channelId === id && !m.threadId).length

  return (
    <Modal open={open} onClose={onClose} size="lg" title="채널 탐색" description="워크스페이스의 모든 채널을 둘러보고 참여해보세요.">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="채널 이름이나 설명으로 검색" className="input-base pl-9" />
          </div>
          <Button variant="primary" size="md" onClick={() => { onClose(); onCreate() }}>새 채널</Button>
        </div>
        <Tabs
          size="sm"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: '전체' },
            { value: 'joined', label: '참여 중' },
            { value: 'other', label: '참여 안 함' },
          ]}
        />
        <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
          {list.map((c, i) => {
            const joined = c.memberIds.includes(me)
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="group flex items-center gap-3 rounded-2xl border border-line/[0.07] bg-surface-2/40 p-3 transition hover:border-accent/30 hover:bg-surface-2/70"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-line/[0.06] text-xl">{c.emoji ?? '#'}</div>
                <button className="min-w-0 flex-1 text-left" onClick={() => { onClose(); navigate(`/messages/${c.id}`) }}>
                  <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                    {c.kind === 'private' ? <Lock className="h-3.5 w-3.5 text-subtle" /> : <Hash className="h-3.5 w-3.5 text-subtle" />}
                    {c.name}
                    {joined && <Badge tone="success" className="ml-1">참여 중</Badge>}
                  </div>
                  <div className="truncate text-[12px] text-muted">{c.description ?? c.topic}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />멤버 {c.memberIds.length}명</span>
                    <span>·</span>
                    <span>메시지 {msgCount(c.id)}개</span>
                  </div>
                </button>
                {joined ? (
                  c.id !== 'c_general' && (
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => { leaveChannel(c.id); toast(`#${c.name} 채널에서 나왔어요`, { emoji: '👋' }) }}>나가기</Button>
                  )
                ) : (
                  <Button size="sm" variant="primary" onClick={() => { joinChannel(c.id); toast(`#${c.name} 채널에 참여했어요`, { emoji: c.emoji ?? '🎉', variant: 'success' }) }}>참여</Button>
                )}
              </motion.div>
            )
          })}
          {!list.length && <div className="py-10 text-center text-sm text-subtle">조건에 맞는 채널이 없어요</div>}
        </div>
      </div>
    </Modal>
  )
}

/* ───────────── New DM ───────────── */

export function NewDMModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>([])
  const openDM = useMessenger((s) => s.openDM)
  const navigate = useNavigate()
  const start = () => {
    if (!sel.length) return
    const ch = openDM(sel)
    setSel([])
    onClose()
    navigate(`/messages/${ch.id}`)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="새 메시지"
      description="한 명을 선택하면 다이렉트 메시지, 여러 명을 선택하면 그룹 대화가 시작돼요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={start} disabled={!sel.length}>{sel.length > 1 ? `그룹 대화 시작 (${sel.length + 1}명)` : '대화 시작'}</Button>
        </>
      }
    >
      <UserPicker selected={sel} onChange={setSel} height="max-h-80" />
    </Modal>
  )
}

/* ───────────── Members ───────────── */

export function MembersModal({ channel, open, onClose, startAdding }: { channel: Channel; open: boolean; onClose: () => void; startAdding?: boolean }) {
  const users = useCore((s) => s.users)
  const addMembers = useMessenger((s) => s.addMembers)
  const [adding, setAdding] = useState(!!startAdding)
  const [sel, setSel] = useState<string[]>([])
  const [q, setQ] = useState('')
  const me = getCurrentUserId()
  useEffect(() => {
    if (open) setAdding(!!startAdding)
  }, [open, startAdding])
  const members = channel.memberIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .filter((u) => !q || u.name.includes(q) || u.title.includes(q))
    .sort((a, b) => (a.presence === 'online' ? -1 : 1) - (b.presence === 'online' ? -1 : 1))

  const close = () => {
    setAdding(false)
    setSel([])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={<span className="flex items-center gap-2">{channel.emoji} {channel.kind === 'dm' || channel.kind === 'group' ? '대화 멤버' : `#${channel.name}`} <span className="text-sm font-normal text-subtle">멤버 {channel.memberIds.length}명</span></span>}
      footer={
        adding ? (
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>뒤로</Button>
            <Button
              variant="primary"
              disabled={!sel.length}
              onClick={() => {
                addMembers(channel.id, sel)
                toast(`${sel.length}명을 채널에 추가했어요`, { emoji: '🙌', variant: 'success' })
                setSel([])
                setAdding(false)
              }}
            >
              {sel.length}명 추가
            </Button>
          </>
        ) : undefined
      }
    >
      {adding ? (
        <UserPicker selected={sel} onChange={setSel} exclude={channel.memberIds} />
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="멤버 찾기" className="input-base pl-9" />
          </div>
          {channel.kind !== 'dm' && !channel.isApp && (
            <button onClick={() => setAdding(true)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-accent/10">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm"><UserPlus className="h-4 w-4" /></span>
              <span className="text-[13.5px] font-semibold text-accent">멤버 추가</span>
            </button>
          )}
          <div className="max-h-[50vh] overflow-y-auto">
            {members.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-line/[0.04]">
                <Avatar user={u} size="md" showPresence />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">
                    {u.name} {u.id === me && <span className="text-subtle">(나)</span>} {u.statusEmoji}
                  </div>
                  <div className="truncate text-[11.5px] text-subtle">{joinMeta(u.title, PRESENCE_LABEL[u.presence])}</div>
                </div>
                {u.id === channel.createdBy && <Badge tone="accent">채널 관리자</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
