import { useMemo, useState } from 'react'
import { Check, Globe, Link2, Lock, Search, Share2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Button, Popover, Switch } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { notifyMembers } from '@/app/notifyMembers'
import { useDocs } from '../store'
import { PERMISSION_LABEL } from '../constants'
import type { Doc, DocPermission } from '../types'
import { isHuman } from '@/features/people/format'
import { isDemoWorkspace, useWorkspace } from '@/lib/workspace'

const DEFAULT_MEMBERS = ['u_pm', 'u_design', 'u_fe', 'u_cto']

export function SharePopover({ doc }: { doc: Doc }) {
  const workspaceName = useWorkspace().name
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const updateDoc = useDocs((s) => s.updateDoc)
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState(false)

  const perms: Record<string, DocPermission> = useMemo(() => {
    if (doc.permissions) return doc.permissions
    const base: Record<string, DocPermission> = {}
    // demo docs without explicit permissions show the demo team; real workspaces start with just the author
    if (isDemoWorkspace()) DEFAULT_MEMBERS.forEach((id) => { if (id !== doc.authorId) base[id] = 'edit' })
    return base
  }, [doc.permissions, doc.authorId])

  const owner = doc.authorId
  const memberIds = [owner, ...Object.keys(perms).filter((id) => id !== owner)]
  const candidates = q.trim()
    ? users.filter((u) => isHuman(u) && !memberIds.includes(u.id) && (u.name.includes(q.trim()) || u.nameEn.toLowerCase().includes(q.trim().toLowerCase()) || u.email.includes(q.trim())))
    : []

  const setPerm = (uid: string, p: DocPermission | null) => {
    const next = { ...perms }
    if (p) next[uid] = p
    else delete next[uid]
    updateDoc(doc.id, { permissions: next }, { touch: false })
  }

  const copy = () => {
    navigator.clipboard?.writeText(`${location.origin}/docs/${doc.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
    toast('링크를 복사했어요', { emoji: '🔗', variant: 'success' })
  }

  return (
    <Popover
      placement="bottom-end"
      className="w-[380px] p-0"
      trigger={({ toggle, open }) => (
        <Button size="sm" variant={open ? 'outline' : 'ghost'} onClick={toggle} leftIcon={<Share2 className="h-3.5 w-3.5" />}>
          공유
        </Button>
      )}
    >
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold">“{doc.title || '제목 없음'}” 공유</h4>
          <span className="text-[11px] text-subtle">{memberIds.length}명 참여 중</span>
        </div>
        <div className="relative">
          <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 또는 이메일로 초대" className="input-base h-9 pl-9 text-[13px]" />
        </div>
        {candidates.length > 0 && (
          <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-line/10 bg-surface-2/60 p-1">
            {candidates.slice(0, 5).map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setPerm(u.id, 'edit')
                  setQ('')
                  notifyMembers([u.id], {
                    type: 'doc',
                    title: `${users.find((x) => x.id === me)?.name ?? '누군가'}님이 문서를 공유했습니다`,
                    body: `${doc.emoji} ${doc.title || '제목 없음'} · ${PERMISSION_LABEL.edit}`,
                    link: `/docs/${doc.id}`,
                  })
                  toast(`${u.name}님을 초대했어요`, { description: '초대 알림을 보냈어요', actorId: u.id, variant: 'success' })
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent/10"
              >
                <Avatar userId={u.id} size="xs" />
                <span className="flex-1 truncate text-[13px]">{u.name}{u.title ? <span className="text-subtle"> · {u.title}</span> : null}</span>
                <span className="text-[11px] text-accent">초대</span>
              </button>
            ))}
          </div>
        )}
        {q.trim() && !candidates.length && (
          <div className="mt-1.5 flex items-center gap-2 px-1 text-xs text-subtle"><Search className="h-3 w-3" /> 일치하는 구성원이 없어요</div>
        )}

        <div className="mt-3 max-h-56 space-y-0.5 overflow-y-auto">
          {memberIds.map((id) => {
            const u = users.find((x) => x.id === id)
            if (!u) return null
            const isOwner = id === owner
            return (
              <div key={id} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-line/[0.04]">
                <Avatar userId={id} size="sm" showPresence />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{u.name}{id === me && <span className="text-subtle"> (나)</span>}</div>
                  <div className="truncate text-[11px] text-subtle">{u.email}</div>
                </div>
                {isOwner ? (
                  <span className="px-2 text-[12px] text-subtle">소유자</span>
                ) : (
                  <select
                    value={perms[id] ?? 'view'}
                    onChange={(e) => setPerm(id, e.target.value === 'remove' ? null : (e.target.value as DocPermission))}
                    className="cursor-pointer rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[12px] text-muted outline-none transition hover:border-line/10 hover:bg-line/[0.05] hover:text-fg focus:border-accent/40"
                  >
                    {(Object.keys(PERMISSION_LABEL) as DocPermission[]).map((p) => (
                      <option key={p} value={p} className="bg-surface text-fg">{PERMISSION_LABEL[p]}</option>
                    ))}
                    <option value="remove" className="bg-surface text-danger">액세스 제거</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line/10 px-4 py-3">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', doc.linkShared ? 'bg-success/15 text-success' : 'bg-line/[0.06] text-muted')}>
          {doc.linkShared ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">{doc.linkShared ? `${workspaceName} 전체` : '초대된 사람만'}</div>
          <div className="text-[11px] text-subtle">{doc.linkShared ? '링크가 있는 구성원은 누구나 볼 수 있어요' : '초대된 구성원만 접근할 수 있어요'}</div>
        </div>
        <Switch size="sm" checked={!!doc.linkShared} onChange={(v) => updateDoc(doc.id, { linkShared: v }, { touch: false })} />
      </div>
      <div className="border-t border-line/10 p-3">
        <Button variant="secondary" className="w-full" size="sm" onClick={copy} leftIcon={copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Link2 className="h-3.5 w-3.5" />}>
          {copied ? '복사됨!' : '링크 복사'}
        </Button>
      </div>
    </Popover>
  )
}
