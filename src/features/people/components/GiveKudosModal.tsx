import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Check, Search, Send } from 'lucide-react'
import { Avatar, Button, Input, Modal, Textarea } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { cn } from '@/lib/utils'
import type { KudosBadge } from '../types'
import { KUDOS_BADGES, KUDOS_BADGE_KEYS } from '../lib'
import { usePeople } from '../store'

const SUGGESTIONS: Record<KudosBadge, string[]> = {
  collab: ['함께 일해서 정말 든든했어요!', '막힐 때마다 먼저 손 내밀어줘서 고마워요 🤝'],
  impact: ['이번 결과물 덕분에 지표가 확 올랐어요 📈', '팀 전체에 큰 임팩트를 만들어줬어요!'],
  challenge: ['어려운 문제를 끝까지 파고드는 모습 멋져요 🔥', '새로운 시도를 두려워하지 않는 용기에 박수!'],
  customer: ['고객 목소리를 누구보다 잘 들어줬어요 💎', '사용자 관점에서 끝까지 고민해줘서 감사해요'],
  care: ['바쁜 와중에도 동료를 챙겨줘서 고마워요 💖', '따뜻한 한마디가 큰 힘이 됐어요'],
  growth: ['짧은 시간에 엄청 성장했어요 🌱', '배운 걸 팀에 나눠줘서 고마워요!'],
}

export function fireConfetti() {
  const colors = ['#8b5cf6', '#22d3ee', '#f472b6', '#fbbf24', '#34d399']
  const end = Date.now() + 700
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors, zIndex: 200 })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors, zIndex: 200 })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  confetti({ particleCount: 120, spread: 90, startVelocity: 42, origin: { y: 0.6 }, colors, zIndex: 200 })
  frame()
}

export function GiveKudosModal({ open, onClose, defaultToId }: { open: boolean; onClose: () => void; defaultToId?: string }) {
  const users = useCore((s) => s.users)
  const meId = useCore((s) => s.currentUserId)
  const give = usePeople((s) => s.giveKudos)
  const [toId, setToId] = useState<string | undefined>(defaultToId)
  const [badge, setBadge] = useState<KudosBadge>('collab')
  const [message, setMessage] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (open) {
      setToId(defaultToId !== meId ? defaultToId : undefined)
      setMessage('')
      setQ('')
      setBadge('collab')
    }
  }, [open, defaultToId, meId])

  const candidates = useMemo(
    () => users.filter((u) => u.id !== meId && (!q || [u.name, u.nameEn, u.title, u.department].some((f) => f.toLowerCase().includes(q.toLowerCase())))),
    [users, meId, q],
  )
  const to = users.find((u) => u.id === toId)
  const canSend = !!toId && message.trim().length > 0

  const submit = () => {
    if (!canSend || !to) return
    give({ toId: to.id, badge, message: message.trim() })
    fireConfetti()
    toast(`${to.name}님께 칭찬을 보냈어요!`, { emoji: KUDOS_BADGES[badge].emoji, variant: 'success', description: `#${KUDOS_BADGES[badge].label} · 칭찬 보드에 게시되고 ${to.name}님께 알림이 갔어요` })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="👏 칭찬 보내기"
      description="동료의 멋진 순간을 팀 모두와 함께 축하해요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!canSend} leftIcon={<Send className="h-4 w-4" />} onClick={submit}>칭찬 보내기</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">누구에게 보낼까요?</span>
            <div className="w-48"><Input icon={<Search />} placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 py-1 text-xs" /></div>
          </div>
          <div className="grid max-h-[180px] grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5">
            {candidates.map((u) => {
              const sel = u.id === toId
              return (
                <button
                  key={u.id}
                  onClick={() => setToId(u.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition-all',
                    sel ? 'border-accent/60 bg-accent/10 shadow-glow-sm' : 'border-transparent hover:bg-line/[0.05]',
                  )}
                >
                  <Avatar user={u} size="md" />
                  <span className="w-full truncate text-center text-[11px] font-medium text-fg">{u.name}</span>
                  {sel && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-gradient text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </motion.span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-muted">어떤 가치를 보여줬나요?</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {KUDOS_BADGE_KEYS.map((k) => {
              const b = KUDOS_BADGES[k]
              const sel = badge === k
              return (
                <motion.button
                  key={k}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setBadge(k)}
                  className={cn('flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all', sel ? 'border-transparent text-white' : 'border-line/10 text-muted hover:text-fg hover:border-line/25')}
                  style={sel ? { background: `linear-gradient(135deg, ${b.from}, ${b.to})`, boxShadow: `0 6px 20px -6px ${b.ring}` } : undefined}
                >
                  <span className="text-xl">{b.emoji}</span>#{b.label}
                </motion.button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-medium text-muted">메시지</div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={to ? `${to.name}님께 전하고 싶은 말을 적어주세요…` : '먼저 받는 사람을 선택하세요'}
            maxLength={200}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS[badge].map((s) => (
              <button key={s} onClick={() => setMessage(s)} className="rounded-full border border-line/10 bg-line/[0.04] px-2.5 py-1 text-[11px] text-muted transition hover:border-accent/40 hover:text-fg">
                {s}
              </button>
            ))}
            <span className="ml-auto self-center text-[10px] text-subtle tabular-nums">{message.length}/200</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
