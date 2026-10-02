import { useState } from 'react'
import { Check, Link2, Share2, UserPlus } from 'lucide-react'
import { Avatar, Button, Popover } from '@/components/ui'
import { getCurrentUserId, getUser, toast, useCore } from '@/store/core'
import { notifyMembers } from '@/app/notifyMembers'
import type { Board } from '../types'
import { useWhiteboard } from '../store'
import { isHuman } from '@/features/people/format'
import { useWorkspace } from '@/lib/workspace'

export function SharePopover({ board }: { board: Board }) {
  const workspaceName = useWorkspace().name
  const users = useCore((s) => s.users)
  const updateBoard = useWhiteboard((s) => s.updateBoard)
  const [copied, setCopied] = useState(false)
  const [picking, setPicking] = useState(false)
  const members = board.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as typeof users
  const others = users.filter((u) => isHuman(u) && !board.memberIds.includes(u.id))

  const copy = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
    setCopied(true)
    toast('보드 링크를 복사했어요', { emoji: '🔗', variant: 'success' })
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Popover
      placement="bottom-end"
      className="w-80 p-0"
      trigger={({ toggle }) => (
        <Button variant="primary" size="sm" leftIcon={<Share2 className="h-4 w-4" />} onClick={toggle}>공유</Button>
      )}
    >
      <div className="p-4">
        <div className="text-sm font-semibold text-fg">보드 공유</div>
        <p className="mt-0.5 text-xs text-muted">링크가 있는 {workspaceName} 구성원은 누구나 볼 수 있어요.</p>
        <button onClick={copy} className="mt-3 flex w-full items-center gap-2 rounded-xl border border-line/10 bg-line/[0.04] px-3 py-2 text-left text-xs text-muted transition hover:border-accent/40">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
          <span className="flex-1 truncate font-mono">{window.location.host}/whiteboard/{board.id}</span>
          <span className="font-semibold text-accent">{copied ? '복사됨' : '복사'}</span>
        </button>
      </div>
      <div className="border-t border-line/10 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">멤버 {members.length}명</span>
          <button onClick={() => setPicking((v) => !v)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-accent hover:bg-accent/10">
            <UserPlus className="h-3.5 w-3.5" /> 초대
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {picking
            ? others.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    updateBoard(board.id, { memberIds: [...board.memberIds, u.id] })
                    notifyMembers([u.id], {
                      type: 'doc',
                      title: `${getUser(getCurrentUserId())?.name ?? '누군가'}님이 화이트보드에 초대했습니다`,
                      body: `${board.emoji} ${board.name}`,
                      link: `/whiteboard/${board.id}`,
                    })
                    toast(`${u.name}님을 보드에 초대했어요`, { emoji: '✉️', variant: 'success', description: '초대 알림을 보냈어요' })
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-line/[0.06]"
                >
                  <Avatar user={u} size="sm" />
                  <span className="flex-1 text-[13px] text-fg">{u.name}</span>
                  <span className="text-[11px] text-subtle">{u.title}</span>
                </button>
              ))
            : members.map((u) => (
                <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <Avatar user={u} size="sm" showPresence />
                  <span className="flex-1 text-[13px] text-fg">{u.name}</span>
                  <span className="text-[11px] text-subtle">{u.id === board.ownerId ? '소유자' : '편집 가능'}</span>
                </div>
              ))}
          {picking && others.length === 0 && <p className="px-2 py-3 text-xs text-subtle">모든 구성원이 이미 참여 중이에요 🎉</p>}
        </div>
      </div>
    </Popover>
  )
}
