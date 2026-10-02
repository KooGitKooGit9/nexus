import { LogOut, Server, Sparkles, Wifi, WifiOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Tooltip } from '@/components/ui'
import { useCore, useCurrentUser } from '@/store/core'
import { useSyncStatus } from '@/lib/sync'
import { clearSession } from '@/lib/session'
import { cn } from '@/lib/utils'
import { SettingsSection } from './Section'

export function logout() {
  void clearSession() // POSTs /api/auth/logout, then navigates to /login itself
}

/** Live connection status: server / offline, who is online right now, AI availability, sign-out. */
export function ConnectionCard({ delay = 0 }: { delay?: number }) {
  const navigate = useNavigate()
  const mode = useSyncStatus((s) => s.mode)
  const connected = useSyncStatus((s) => s.connected)
  const online = useSyncStatus((s) => s.online)
  const aiEnabled = useSyncStatus((s) => s.aiEnabled)
  const aiModel = useSyncStatus((s) => s.aiModel)
  const users = useCore((s) => s.users)
  const me = useCurrentUser()
  const server = mode === 'server'
  const onlineUsers = users.filter((u) => online.includes(u.id))

  return (
    <SettingsSection
      title="연결 상태"
      description={server ? '실시간 동기화 서버에 연결된 워크스페이스예요. 변경 사항이 모든 구성원에게 즉시 반영돼요.' : '서버 없이 이 브라우저에서만 동작하는 오프라인 데모 모드예요.'}
      icon={server ? <Server /> : <WifiOff />}
      delay={delay}
      action={
        <Button size="sm" variant="outline" leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={logout}>
          로그아웃
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
          <div className="flex items-center gap-2 text-[12px] text-muted">
            {server ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-warning" />} 동기화
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', server && connected ? 'bg-success animate-pulse' : server ? 'bg-warning' : 'bg-zinc-500')} />
            <span className="text-[15px] font-semibold">{server ? (connected ? '서버 연결됨' : '재연결 중…') : '오프라인 모드'}</span>
          </div>
          <div className="mt-1 text-[11.5px] text-subtle">{server ? 'WebSocket · SQLite' : '데이터는 이 브라우저에만 저장돼요'}</div>
        </div>
        <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
          <div className="flex items-center gap-2 text-[12px] text-muted"><Sparkles className="h-4 w-4 text-accent" /> Nexus AI</div>
          <div className="mt-2 text-[15px] font-semibold">{aiEnabled ? '사용 가능' : server ? 'API 키 미설정' : '서버 필요'}</div>
          <div className="mt-1 truncate text-[11.5px] text-subtle">{aiEnabled ? aiModel || 'Gemini' : '서버 환경 변수에 GEMINI_API_KEY를 설정하세요'}</div>
        </div>
        <div className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
          <div className="text-[12px] text-muted">로그인 계정</div>
          <div className="mt-2 flex items-center gap-2">
            <Avatar user={me} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold">{me.name}</div>
              <div className="truncate text-[11px] text-subtle">{me.title}</div>
            </div>
          </div>
        </div>
      </div>

      {server && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-muted">
            지금 접속 중 <Badge tone="success">{onlineUsers.length}명</Badge>
          </div>
          {onlineUsers.length ? (
            <div className="flex flex-wrap gap-2">
              {onlineUsers.map((u) => (
                <Tooltip key={u.id} content={`${u.title} · 프로필 보기`}>
                  <button
                    onClick={() => navigate(`/people/${u.id}`)}
                    className="flex items-center gap-2 rounded-xl border border-line/10 bg-surface/50 py-1.5 pl-1.5 pr-3 text-[12.5px] transition hover:border-accent/40 hover:bg-accent/10"
                  >
                    <Avatar user={u} size="xs" showPresence />
                    {u.name}
                    {u.id === me.id && <span className="text-subtle">(나)</span>}
                  </button>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className="text-[12.5px] text-subtle">접속 정보를 불러오는 중…</div>
          )}
        </div>
      )}
    </SettingsSection>
  )
}
