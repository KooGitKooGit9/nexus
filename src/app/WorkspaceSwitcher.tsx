import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronsUpDown, Loader2, LogOut, Plus, Sparkles, UserPlus } from 'lucide-react'
import { Popover } from '@/components/ui'
import { api, ApiError, type WorkspaceSummary } from '@/lib/api'
import { useMe, useWorkspace, reloadInto } from '@/lib/workspace'
import { clearSession } from '@/lib/session'
import { useSyncStatus } from '@/lib/sync'
import { cn, gradientFor } from '@/lib/utils'

const PLAN_LABEL: Record<WorkspaceSummary['plan'], string> = { free: 'Free', pro: 'Pro', business: 'Business' }

export function WorkspaceMark({ ws, size = 'md' }: { ws: Pick<WorkspaceSummary, 'id' | 'name' | 'iconColor'>; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-display font-bold text-white', size === 'sm' ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm', gradientFor(ws.iconColor ?? ws.id))}
    >
      {ws.name.trim().charAt(0).toUpperCase() || 'N'}
    </span>
  )
}

/** Workspace name in the sidebar header → switch / create workspace, invite, log out. */
export function WorkspaceSwitcher({ children }: { children: ReactNode }) {
  const me = useMe()
  const current = useWorkspace()
  const serverMode = useSyncStatus((s) => s.mode === 'server')
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!serverMode || !me?.account) return <>{children}</>

  const switchTo = async (id: string) => {
    if (id === current.id) return
    setBusy(id)
    try {
      await api.switchWorkspace(id)
      reloadInto('/')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '전환하지 못했어요.')
      setBusy(null)
    }
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy('new')
    setError('')
    try {
      await api.createWorkspace({ name: name.trim(), kind: 'blank' })
      reloadInto('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '만들지 못했어요.')
      setBusy(null)
    }
  }

  return (
    <Popover
      placement="bottom-start"
      className="w-72 p-1.5"
      trigger={({ toggle }) => (
        <button onClick={toggle} className="group flex min-w-0 flex-1 items-center gap-1 rounded-lg text-left focus-ring" aria-label="워크스페이스 전환">
          {children}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-subtle transition group-hover:text-fg" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{me.account!.email || '게스트 데모'}</div>
          {me.workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => switchTo(w.id)}
              className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-line/[0.07]', w.id === current.id && 'bg-line/[0.05]')}
            >
              <WorkspaceMark ws={w} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{w.name}</span>
                <span className="block text-[11px] text-muted">
                  {w.kind === 'demo' ? '데모' : PLAN_LABEL[w.plan]} · {w.role === 'owner' ? '소유자' : w.role === 'admin' ? '관리자' : '멤버'}
                </span>
              </span>
              {busy === w.id ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : w.id === current.id && <Check className="h-4 w-4 text-accent" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line/10" />
          {creating ? (
            <form onSubmit={create} className="flex flex-col gap-2 p-1.5">
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="새 워크스페이스 이름" className="input-base h-9 text-[13px]" />
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-2.5 py-1 text-[12.5px] text-muted hover:bg-line/[0.07]">취소</button>
                <button type="submit" disabled={!name.trim() || busy === 'new'} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-[12.5px] font-medium text-white disabled:opacity-50">
                  {busy === 'new' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}만들기
                </button>
              </div>
            </form>
          ) : (
            !me.account!.guest && (
              <button onClick={() => setCreating(true)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg/90 transition hover:bg-line/[0.07]">
                <Plus className="h-4 w-4 opacity-80" /> 새 워크스페이스
              </button>
            )
          )}
          {current.kind !== 'demo' && (
            <button onClick={() => { close(); navigate('/settings/members') }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg/90 transition hover:bg-line/[0.07]">
              <UserPlus className="h-4 w-4 opacity-80" /> 멤버 초대
            </button>
          )}
          {me.account!.guest && (
            <button onClick={() => { close(); navigate('/settings/account') }} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-accent transition hover:bg-accent/10">
              <Sparkles className="h-4 w-4" /> 무료 계정 만들기
            </button>
          )}
          <button onClick={() => void clearSession()} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-fg/90 transition hover:bg-line/[0.07]">
            <LogOut className="h-4 w-4 opacity-80" /> 로그아웃
          </button>
          {error && <p className="px-2.5 pb-1 text-[12px] text-danger">{error}</p>}
        </div>
      )}
    </Popover>
  )
}
