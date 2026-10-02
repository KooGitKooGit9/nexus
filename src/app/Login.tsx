import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Sparkles, Server, Wifi } from 'lucide-react'
import { useCore } from '@/store/core'
import { COMPANY } from '@/store/seed-users'
import { setSessionUserId } from '@/lib/session'
import { useSyncStatus } from '@/lib/sync'
import { Avatar } from '@/components/ui'
import { AuroraBackground } from './AuroraBackground'
import { cn } from '@/lib/utils'

/**
 * Workspace sign-in. Demo auth: pick which member you are (no password). Each browser — or each
 * tab opened with `?as=<userId>` — can be a different person, and everyone shares the same data.
 */
export function Login() {
  const users = useCore((s) => s.users)
  const online = useSyncStatus((s) => s.online)
  const aiEnabled = useSyncStatus((s) => s.aiEnabled)
  const [q, setQ] = useState('')
  const list = useMemo(
    () => users.filter((u) => !q || `${u.name} ${u.nameEn} ${u.title} ${u.department}`.toLowerCase().includes(q.toLowerCase())),
    [users, q],
  )

  const login = (id: string) => {
    setSessionUserId(id)
    location.reload()
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-y-auto p-6">
      <AuroraBackground />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="glass-strong w-full max-w-3xl rounded-[28px] p-6 sm:p-8 shadow-float"
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-accent-gradient blur-lg opacity-70" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x font-display text-2xl font-bold text-white">N</div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight">{COMPANY.workspace}에 로그인</h1>
            <p className="text-sm text-muted">{COMPANY.name} · {COMPANY.nameKo} 워크스페이스 — 본인 계정을 선택하세요</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5"><Server className="h-3.5 w-3.5 text-success" /> 서버 연결됨 · 실시간 동기화</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className={cn('h-3.5 w-3.5', aiEnabled ? 'text-accent' : 'text-subtle')} /> AI {aiEnabled ? '사용 가능' : '키 미설정'}</span>
          </div>
        </div>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름, 직무, 부서로 찾기" className="input-base pl-9" />
        </div>

        <div className="mt-4 grid max-h-[52vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {list.map((u) => {
            const isOnline = online.includes(u.id)
            return (
              <button
                key={u.id}
                onClick={() => login(u.id)}
                className="group flex items-center gap-3 rounded-2xl border border-line/10 bg-surface/50 p-3 text-left transition hover:border-accent/50 hover:bg-accent/10 hover:shadow-glow-sm"
              >
                <Avatar user={u} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {u.name}
                    {u.id === 'u_me' && <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">기본 데모 계정</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">{u.title} · {u.department}</span>
                </span>
                {isOnline && <span className="inline-flex items-center gap-1 text-[11px] text-success"><Wifi className="h-3 w-3" />접속 중</span>}
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-center text-[11.5px] text-subtle">
          다른 사람으로 동시에 테스트하려면 새 탭 주소 뒤에 <code className="rounded bg-line/10 px-1 font-mono">?as=u_fe</code> 처럼 붙여 여세요.
        </p>
      </motion.div>
    </div>
  )
}
