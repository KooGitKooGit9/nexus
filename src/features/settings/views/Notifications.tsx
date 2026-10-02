import { useState } from 'react'
import { BellRing, Moon, Monitor, Mail, Volume2, Smartphone, Send, ShieldCheck, ShieldAlert, Bell } from 'lucide-react'
import { notify, toast } from '@/store/core'
import { Badge, Button, Select, Switch } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { NotificationType } from '@/store/types'
import { NOTIF_STYLE } from '@/app/shell/notifStyle'
import { NOTIF_TYPE_META } from '../constants'
import { useSettings, isDndActive, type NotifChannels } from '../store'
import { SettingsSection, SettingRow } from '../components/Section'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
type Perm = NotificationPermission | 'unsupported'
const getPerm = (): Perm => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported')

export function NotificationSettings() {
  const s = useSettings()
  const [perm, setPerm] = useState<Perm>(getPerm)
  const [asking, setAsking] = useState(false)
  const active = isDndActive(s.dnd)

  const request = async () => {
    if (perm === 'unsupported') return
    setAsking(true)
    try {
      const p = await Notification.requestPermission()
      setPerm(p)
      if (p === 'granted') toast('데스크톱 알림이 허용되었어요', { variant: 'success', emoji: '🔔' })
      else if (p === 'denied') toast('알림 권한이 거부되었어요', { variant: 'warning', description: '브라우저 사이트 설정에서 다시 허용할 수 있어요.' })
    } finally {
      setAsking(false)
    }
  }

  const test = () => {
    notify({ type: 'system', title: '테스트 알림이에요 👋', body: '알림 설정이 정상적으로 동작하고 있어요.', link: '/settings/notifications' })
    if (perm === 'granted' && s.channels.desktop) {
      try { new Notification('Nexus · 테스트 알림', { body: '데스크톱 알림이 정상적으로 동작합니다.' }) } catch { /* ignore */ }
    }
  }

  const channels: { key: keyof NotifChannels; label: string; description: string; icon: React.ReactNode; soon?: boolean }[] = [
    { key: 'desktop', label: '데스크톱 알림', description: '브라우저가 백그라운드일 때도 알려드려요', icon: <Monitor /> },
    { key: 'sound', label: '알림음', description: '새 알림이 오면 소리로 알려드려요', icon: <Volume2 />, soon: true },
    { key: 'email', label: '이메일', description: '놓친 멘션과 결재 요청을 메일로 받아요', icon: <Mail />, soon: true },
    { key: 'mobilePush', label: '모바일 푸시', description: '모바일 앱으로 알림을 받아요', icon: <Smartphone />, soon: true },
  ]

  return (
    <>
      {/* permission banner */}
      <div className="glass relative overflow-hidden rounded-3xl p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-glow-sm', perm === 'granted' ? 'bg-success' : perm === 'denied' ? 'bg-danger' : 'bg-accent-gradient')}>
            {perm === 'granted' ? <ShieldCheck className="h-6 w-6" /> : perm === 'denied' ? <ShieldAlert className="h-6 w-6" /> : <BellRing className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-semibold">
              데스크톱 알림 권한
              <Badge tone={perm === 'granted' ? 'success' : perm === 'denied' ? 'danger' : 'warning'} dot>
                {perm === 'granted' ? '허용됨' : perm === 'denied' ? '차단됨' : perm === 'unsupported' ? '지원 안 됨' : '요청 필요'}
              </Badge>
            </div>
            <p className="mt-0.5 text-[13px] text-muted">
              {perm === 'granted' ? '중요한 알림을 운영체제 알림 센터로 받을 수 있어요.' : perm === 'denied' ? '브라우저 주소창의 사이트 설정에서 알림을 허용해 주세요.' : '권한을 허용하면 탭을 보고 있지 않아도 멘션과 결재 요청을 받을 수 있어요.'}
            </p>
          </div>
          <div className="flex gap-2">
            {perm === 'default' && <Button variant="primary" loading={asking} leftIcon={<BellRing className="h-4 w-4" />} onClick={request}>권한 요청</Button>}
            <Button variant="secondary" leftIcon={<Send className="h-4 w-4" />} onClick={test}>테스트 알림</Button>
          </div>
        </div>
      </div>

      <SettingsSection title="알림 유형" description="받고 싶은 알림만 골라보세요. 끈 유형은 알림함에도 표시되지 않아요." icon={<Bell />} delay={0.05}
        action={
          <div className="flex gap-1">
            <Button size="xs" variant="ghost" onClick={() => (Object.keys(NOTIF_TYPE_META) as NotificationType[]).forEach((t) => s.setNotif(t, true))}>모두 켜기</Button>
            <Button size="xs" variant="ghost" onClick={() => (Object.keys(NOTIF_TYPE_META) as NotificationType[]).forEach((t) => s.setNotif(t, t === 'system'))}>최소화</Button>
          </div>
        }
      >
        {(Object.keys(NOTIF_TYPE_META) as NotificationType[]).map((t) => {
          const st = NOTIF_STYLE[t]
          return (
            <SettingRow
              key={t}
              label={NOTIF_TYPE_META[t].label}
              description={NOTIF_TYPE_META[t].description}
              icon={<span className={cn('-m-2 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white', st.tile)}><st.icon className="h-4 w-4" /></span>}
            >
              <Switch checked={s.notif[t] !== false} onChange={(v) => s.setNotif(t, v)} />
            </SettingRow>
          )
        })}
      </SettingsSection>

      <SettingsSection title="전달 방식" icon={<Send />} delay={0.1}>
        {channels.map((c) => (
          <SettingRow key={c.key} label={c.soon ? <span className="flex items-center gap-2">{c.label}<Badge>곧 제공</Badge></span> : c.label} description={c.description} icon={c.icon}>
            {c.soon ? (
              <span aria-hidden className="inline-flex h-6 w-11 items-center rounded-full bg-line/15 p-0.5 opacity-50"><span className="h-5 w-5 rounded-full bg-white shadow" /></span>
            ) : (
              <Switch checked={s.channels[c.key]} onChange={(v) => s.setChannel(c.key, v)} />
            )}
          </SettingRow>
        ))}
        <SettingRow label={<span className="flex items-center gap-2">요약 메일<Badge>곧 제공</Badge></span>} description="읽지 않은 활동을 모아서 보내드려요" icon={<Mail />}>
          <Select value="off" disabled onChange={() => undefined} className="h-9 w-32 py-1.5 opacity-50">
            <option value="off">받지 않음</option>
          </Select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="방해 금지 일정"
        description="정해진 시간에는 알림을 조용히 쌓아두고 상태를 자동으로 '방해 금지'로 표시해요."
        icon={<Moon />}
        delay={0.15}
        action={<Switch checked={s.dnd.enabled} onChange={(v) => s.setDnd({ enabled: v })} />}
      >
        <div className={cn('space-y-4 transition-opacity', !s.dnd.enabled && 'pointer-events-none opacity-45')}>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-muted">
              시작
              <input type="time" value={s.dnd.from} onChange={(e) => s.setDnd({ from: e.target.value })} className="input-base h-9 w-32 py-1" />
            </label>
            <span className="text-subtle">→</span>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              종료
              <input type="time" value={s.dnd.to} onChange={(e) => s.setDnd({ to: e.target.value })} className="input-base h-9 w-32 py-1" />
            </label>
            {s.dnd.enabled && (
              <Badge tone={active ? 'accent' : 'neutral'} dot className="ml-auto">{active ? '지금 방해 금지 중' : '현재 비활성 시간'}</Badge>
            )}
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted">반복 요일</div>
            <div className="flex gap-1.5">
              {DAYS.map((d, i) => {
                const on = s.dnd.days.includes(i)
                return (
                  <button
                    key={d}
                    onClick={() => s.setDnd({ days: on ? s.dnd.days.filter((x) => x !== i) : [...s.dnd.days, i].sort() })}
                    className={cn('h-9 w-9 rounded-xl text-[13px] font-medium transition', on ? 'bg-accent-gradient text-white shadow-glow-sm' : 'border border-line/10 text-muted hover:border-accent/40', (i === 0 || i === 6) && !on && 'text-danger/70')}
                  >
                    {d}
                  </button>
                )
              })}
              <div className="ml-2 flex gap-1">
                <Button size="xs" variant="ghost" onClick={() => s.setDnd({ days: [1, 2, 3, 4, 5] })}>평일</Button>
                <Button size="xs" variant="ghost" onClick={() => s.setDnd({ days: [0, 1, 2, 3, 4, 5, 6] })}>매일</Button>
              </div>
            </div>
          </div>
          <DndTimeline from={s.dnd.from} to={s.dnd.to} />
        </div>
      </SettingsSection>
    </>
  )
}

function DndTimeline({ from, to }: { from: string; to: string }) {
  const m = (t: string) => { const [h, mm] = t.split(':').map(Number); return ((h || 0) * 60 + (mm || 0)) / 1440 * 100 }
  const a = m(from), b = m(to)
  const now = (new Date().getHours() * 60 + new Date().getMinutes()) / 1440 * 100
  const segs = a <= b ? [[a, b]] : [[a, 100], [0, b]]
  return (
    <div>
      <div className="relative h-8 overflow-hidden rounded-xl border border-line/10 bg-line/[0.04]">
        {segs.map(([x, y], i) => (
          <div key={i} className="absolute inset-y-0 bg-gradient-to-r from-accent/40 to-accent-2/30" style={{ left: `${x}%`, width: `${y - x}%` }} />
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-accent-3 shadow-[0_0_8px_rgb(var(--accent-3))]" style={{ left: `${now}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        {['00', '06', '12', '18', '24'].map((h) => <span key={h}>{h}:00</span>)}
      </div>
    </div>
  )
}
