import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Building, CalendarDays, Check, FileText, HardDrive, KanbanSquare, MessagesSquare, RotateCcw, Trash2, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { refreshMe, reloadInto, useWorkspace } from '@/lib/workspace'
import { resetWorkspace } from '@/lib/persist'
import { toast } from '@/store/core'
import { planById } from '@/config/brand'
import { Badge, Button, Modal } from '@/components/ui'
import { cn, formatBytes, gradientFor, initials, PALETTE } from '@/lib/utils'
import { FormAlert, TextField } from '@/features/public/components/Fields'
import { errorMessage } from '@/features/public/lib'
import { useMessenger } from '@/features/messenger/store'
import { useDocs } from '@/features/docs/store'
import { useProjects } from '@/features/projects/store'
import { useWorkflows } from '@/features/workflows/store'
import { useFiles } from '@/features/files/store'
import { useCalendar } from '@/features/calendar/store'
import { ConnectionCard } from '../components/ConnectionCard'
import { SettingsSection } from '../components/Section'
import { RoleBadge } from './Members'

export function WorkspaceSettings() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const offline = ws.id === 'local'
  const isAdmin = ws.role === 'owner' || ws.role === 'admin'
  const isOwner = ws.role === 'owner'
  const isDemo = ws.kind === 'demo'
  const plan = planById(ws.plan)

  const messages = useMessenger((s) => s.messages.length)
  const channels = useMessenger((s) => s.channels.length)
  const docs = useDocs((s) => s.docs.length)
  const tasks = useProjects((s) => s.tasks.length)
  const runs = useWorkflows((s) => s.workflows.reduce((n, w) => n + (w.runs?.length ?? 0), 0))
  const storage = useFiles((s) => s.files.reduce((n, f) => n + (f.trashed ? 0 : f.size ?? 0), 0))
  const events = useCalendar((s) => s.events.length)

  const stats = [
    { icon: <MessagesSquare />, label: '메시지', value: messages.toLocaleString(), sub: `채널 ${channels}개` },
    { icon: <KanbanSquare />, label: '태스크', value: tasks.toLocaleString() },
    { icon: <FileText />, label: '문서', value: docs.toLocaleString() },
    { icon: <CalendarDays />, label: '일정', value: events.toLocaleString() },
    { icon: <HardDrive />, label: '파일', value: formatBytes(storage) },
    { icon: <Zap />, label: '자동화 실행', value: runs.toLocaleString() },
  ]

  return (
    <>
      {/* identity card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass relative overflow-hidden rounded-3xl p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-[30%] bg-gradient-to-br font-display text-2xl font-bold text-white shadow-glow', ws.iconColor ? '' : gradientFor(ws.name))} style={ws.iconColor ? { background: ws.iconColor } : undefined}>
            {initials(ws.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-bold tracking-tight">{ws.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone={isDemo ? 'warning' : 'success'} dot>{isDemo ? '데모 워크스페이스' : '팀 워크스페이스'}</Badge>
              <Badge tone="accent">{plan.name} 플랜</Badge>
              <span className="text-[12px] text-muted">내 역할</span>
              <RoleBadge role={ws.role} />
            </div>
          </div>
          {!offline && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate('/settings/members')}>멤버 관리</Button>
              <Button size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => navigate('/settings/billing')}>요금제 & 결제</Button>
            </div>
          )}
        </div>
        {isDemo && (
          <p className="relative mt-4 rounded-xl border border-warning/25 bg-warning/[0.06] px-3.5 py-2.5 text-[12.5px] text-fg/85 break-keep">
            가상의 회사(Aurora Labs) 데이터와 시뮬레이션된 동료가 들어 있는 체험용 공간이에요. 실제 팀 워크스페이스에는 초대한 사람만 있어요.
          </p>
        )}
      </motion.div>

      <ConnectionCard delay={0.03} />

      {!offline && <WorkspaceInfo canEdit={isAdmin} />}

      <SettingsSection title="활동 현황" description="이 워크스페이스에 쌓인 데이터예요. 요금제 한도는 요금제 & 결제에서 확인하세요." icon={<HardDrive />} delay={0.1}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((u, i) => (
            <motion.div key={u.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }} className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <div className="flex items-center gap-2 text-[12px] text-muted [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-accent">{u.icon}{u.label}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold">{u.value}</span>
                {u.sub && <span className="text-xs text-subtle">{u.sub}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      <DangerZone isOwner={isOwner || offline} isDemo={isDemo || offline} offline={offline} />
    </>
  )
}

function WorkspaceInfo({ canEdit }: { canEdit: boolean }) {
  const ws = useWorkspace()
  const [name, setName] = useState(ws.name)
  const [color, setColor] = useState<string | undefined>(ws.iconColor)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setName(ws.name); setColor(ws.iconColor) }, [ws.id, ws.name, ws.iconColor])
  const trimmed = name.trim()
  const nameErr = !trimmed ? '이름을 입력해 주세요.' : trimmed.length > 40 ? '40자 이내로 입력해 주세요.' : null
  const dirty = trimmed !== ws.name || color !== ws.iconColor

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || nameErr) return
    setSaving(true)
    setError(null)
    try {
      await api.updateWorkspace(ws.id, { name: trimmed, ...(color ? { iconColor: color } : {}) })
      await refreshMe()
      toast('워크스페이스 정보를 저장했어요', { variant: 'success' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection title="워크스페이스 정보" icon={<Building />} delay={0.05} description={canEdit ? undefined : '이름과 색상은 소유자와 관리자만 바꿀 수 있어요.'}>
      <form onSubmit={save} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="워크스페이스 이름" value={name} maxLength={40} disabled={!canEdit} onChange={(e) => setName(e.target.value)} error={dirty ? nameErr : null} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted">아이콘 색상</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="아이콘 색상">
              {PALETTE.map((c) => {
                const on = color === c
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={c}
                    disabled={!canEdit}
                    onClick={() => setColor(c)}
                    className={cn('focus-ring flex h-9 w-9 items-center justify-center rounded-xl transition disabled:opacity-50', on ? 'ring-2 ring-fg/70 ring-offset-2 ring-offset-surface' : 'hover:scale-105')}
                    style={{ background: c }}
                  >
                    {on && <Check className="h-4 w-4 text-white" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="primary" loading={saving} disabled={!dirty || !!nameErr}>저장</Button>
          </div>
        )}
      </form>
    </SettingsSection>
  )
}

function DangerZone({ isOwner, isDemo, offline }: { isOwner: boolean; isDemo: boolean; offline: boolean }) {
  const ws = useWorkspace()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!isOwner) return null
  const confirmWord = isDemo ? '초기화' : ws.name
  const close = () => { if (loading) return; setOpen(false); setTyped(''); setError(null) }

  const run = async () => {
    if (typed.trim() !== confirmWord) return
    setLoading(true)
    setError(null)
    if (isDemo) {
      resetWorkspace()
      return
    }
    try {
      await api.deleteWorkspace(ws.id, typed.trim())
      reloadInto('/')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
    }
  }

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-danger/30 bg-danger/[0.04] p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-danger/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger"><AlertTriangle className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-danger">위험 구역</h2>
              <div className="mt-2 text-[13.5px] font-medium">{isDemo ? '데모 초기화' : '워크스페이스 삭제'}</div>
              <p className="mt-0.5 max-w-lg text-[12.5px] leading-relaxed text-muted break-keep">
                {isDemo
                  ? offline
                    ? '이 브라우저에 저장된 데모 데이터를 모두 지우고 처음 상태로 되돌려요.'
                    : '이 데모 워크스페이스의 메시지, 태스크, 문서, 일정 등을 모두 지우고 처음 데모 상태로 되돌려요. 접속 중인 멤버의 화면도 새로고침돼요.'
                  : '메시지, 태스크, 문서, 파일 등 워크스페이스의 모든 데이터와 멤버 연결이 영구 삭제돼요. 삭제 전에 설정 → 데이터에서 JSON으로 내보내 두세요.'}
              </p>
            </div>
          </div>
          <Button variant="danger" leftIcon={isDemo ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />} onClick={() => setOpen(true)}>
            {isDemo ? '데모 초기화' : '워크스페이스 삭제'}
          </Button>
        </div>
      </section>

      <Modal
        open={open}
        onClose={close}
        size="sm"
        title={<span className="flex items-center gap-2 text-danger"><AlertTriangle className="h-5 w-5" />{isDemo ? '데모를 초기화할까요?' : '정말 삭제할까요?'}</span>}
        description="이 작업은 되돌릴 수 없어요."
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={loading}>취소</Button>
            <Button variant="danger" loading={loading} disabled={typed.trim() !== confirmWord} onClick={() => void run()}>{isDemo ? '초기화' : '영구 삭제'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <FormAlert>{error}</FormAlert>}
          <label className="block text-[12.5px] text-muted">
            확인을 위해 <b className="select-all text-fg">{confirmWord}</b>을(를) 입력하세요
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className="input-base mt-1.5" placeholder={confirmWord} />
          </label>
        </div>
      </Modal>
    </>
  )
}
