import { useState } from 'react'
import { motion } from 'framer-motion'
import { Building, Crown, Check, HardDrive, MessagesSquare, FileText, KanbanSquare, Zap, CalendarDays, Users, Globe } from 'lucide-react'
import { toast } from '@/store/core'
import { COMPANY } from '@/store/seed-users'
import { AvatarStack, Button, Field, Input, Progress, useLiveUsers } from '@/components/ui'
import { formatBytes, PALETTE } from '@/lib/utils'
import { useMessenger } from '@/features/messenger/store'
import { useDocs } from '@/features/docs/store'
import { useProjects } from '@/features/projects/store'
import { useWorkflows } from '@/features/workflows/store'
import { useFiles } from '@/features/files/store'
import { useCalendar } from '@/features/calendar/store'
import { useSettings } from '../store'
import { ConnectionCard } from '../components/ConnectionCard'
import { SettingsSection } from '../components/Section'

export function WorkspaceSettings() {
  const users = useLiveUsers()
  const name = useSettings((s) => s.workspaceName)
  const domain = useSettings((s) => s.workspaceDomain)
  const setWorkspace = useSettings((s) => s.setWorkspace)
  const [draft, setDraft] = useState({ name, domain })

  const messages = useMessenger((s) => s.messages.length)
  const channels = useMessenger((s) => s.channels.length)
  const docs = useDocs((s) => s.docs.length)
  const tasks = useProjects((s) => s.tasks.length)
  const runs = useWorkflows((s) => s.workflows.reduce((n, w) => n + (w.runs?.length ?? 0), 0))
  const storage = useFiles((s) => s.files.reduce((n, f) => n + (f.trashed ? 0 : f.size ?? 0), 0))
  const events = useCalendar((s) => s.events.length)

  const depts = Object.entries(users.reduce<Record<string, number>>((m, u) => ({ ...m, [u.department]: (m[u.department] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
  const online = users.filter((u) => u.presence === 'online').length
  const STORAGE_LIMIT = 1024 ** 4 // 1 TB

  const usage = [
    { icon: <HardDrive />, label: '스토리지', value: formatBytes(storage), sub: '/ 1 TB', pct: (storage / STORAGE_LIMIT) * 100 },
    { icon: <MessagesSquare />, label: '메시지', value: messages.toLocaleString(), sub: `채널 ${channels}개`, pct: null },
    { icon: <FileText />, label: '문서', value: docs.toLocaleString(), sub: '무제한', pct: null },
    { icon: <KanbanSquare />, label: '태스크', value: tasks.toLocaleString(), sub: '무제한', pct: null },
    { icon: <Zap />, label: '자동화 실행', value: runs.toLocaleString(), sub: '/ 월 100,000회', pct: (runs / 100000) * 100 },
    { icon: <CalendarDays />, label: '일정', value: events.toLocaleString(), sub: '이번 달', pct: null },
  ]

  return (
    <>
      {/* plan card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-7 text-white shadow-glow">
        <div className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(255,255,255,0.45),transparent_50%)]" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="noise absolute inset-0" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/85"><Crown className="h-4 w-4" />현재 플랜</div>
            <div className="mt-1 font-display text-4xl font-bold tracking-tight">Enterprise</div>
            <div className="mt-1 text-sm text-white/80">{COMPANY.name} · 연간 결제 · 다음 갱신일 2027년 3월 1일</div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-white/90">
              {['무제한 멤버 & 게스트', 'SAML SSO · SCIM', '감사 로그 · DLP', '99.99% SLA', '전담 CSM', '1 TB 스토리지'].map((f) => (
                <span key={f} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />{f}</span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 p-4 text-right ring-1 ring-white/25 backdrop-blur">
            <div className="text-xs text-white/75">활성 멤버</div>
            <div className="font-display text-3xl font-bold">{users.length}<span className="text-base text-white/70"> / ∞</span></div>
            <AvatarStack userIds={users.map((u) => u.id)} max={6} size="xs" className="mt-2 justify-end" />
            <Button size="sm" className="mt-3 border-white/30 bg-white/20 text-white hover:bg-white/30" variant="outline" onClick={() => toast('청구 포털은 관리자 전용이에요', { emoji: '🧾' })}>청구 관리</Button>
          </div>
        </div>
      </motion.div>

      <ConnectionCard delay={0.03} />

      <SettingsSection title="워크스페이스 정보" icon={<Building />} delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="회사 이름"><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
          <Field label="워크스페이스 주소" hint="멤버 초대 링크에 사용돼요.">
            <Input icon={<Globe />} value={draft.domain} onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            disabled={draft.name === name && draft.domain === domain}
            onClick={() => { setWorkspace({ workspaceName: draft.name.trim() || name, workspaceDomain: draft.domain.trim() || domain }); toast('워크스페이스 정보가 저장되었어요', { variant: 'success' }) }}
          >
            저장
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title="사용량" description="이번 결제 주기 기준이에요." icon={<HardDrive />} delay={0.1}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {usage.map((u, i) => (
            <motion.div key={u.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }} className="rounded-2xl border border-line/10 bg-line/[0.03] p-4">
              <div className="flex items-center gap-2 text-[12px] text-muted [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-accent">{u.icon}{u.label}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold">{u.value}</span>
                <span className="text-xs text-subtle">{u.sub}</span>
              </div>
              {u.pct !== null && <Progress value={Math.max(1.5, u.pct)} size="sm" className="mt-2.5" />}
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="구성원" description={`${users.length}명 · 지금 ${online}명 온라인`} icon={<Users />} delay={0.15}>
        <div className="space-y-2.5">
          {depts.map(([d, n], i) => (
            <div key={d} className="flex items-center gap-3 text-[13px]">
              <span className="w-20 shrink-0 text-muted">{d}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line/[0.07]">
                <motion.div className="h-full rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} initial={{ width: 0 }} animate={{ width: `${(n / users.length) * 100}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }} />
              </div>
              <span className="w-10 shrink-0 text-right font-medium">{n}명</span>
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  )
}
