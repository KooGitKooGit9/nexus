import { create } from 'zustand'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import type { NotificationType } from '@/store/types'
import type { AuditCategory, AuditEntry, Density, DndSchedule, IntegrationState, NotifPrefs, Session } from './types'
import { SEED_AUDIT, SEED_INTEGRATIONS, SEED_SESSIONS } from './seed'

export interface NotifChannels {
  desktop: boolean
  email: boolean
  sound: boolean
  mobilePush: boolean
}

interface SettingsState {
  density: Density
  notif: NotifPrefs
  channels: NotifChannels
  digest: 'off' | 'daily' | 'weekly'
  dnd: DndSchedule
  integrations: Record<string, IntegrationState>
  twoFactor: boolean
  sessions: Session[]
  audit: AuditEntry[]
  workspaceName: string
  workspaceDomain: string

  setDensity: (d: Density) => void
  setNotif: (type: NotificationType, on: boolean) => void
  setChannel: (key: keyof NotifChannels, on: boolean) => void
  setDigest: (d: SettingsState['digest']) => void
  setDnd: (patch: Partial<DndSchedule>) => void
  connectIntegration: (id: string, name: string, account: string) => void
  disconnectIntegration: (id: string, name: string) => void
  setTwoFactor: (v: boolean) => void
  revokeSession: (id: string) => void
  revokeOtherSessions: () => void
  setWorkspace: (patch: { workspaceName?: string; workspaceDomain?: string }) => void
  log: (category: AuditCategory, action: string, target: string) => void
}

const DEFAULT_NOTIF: NotifPrefs = {
  mention: true, message: true, task: true, approval: true, event: true, workflow: true, system: true, doc: true,
}

export const useSettings = create<SettingsState>()(
  persisted<SettingsState>('settings', (set, get) => ({
    density: 'comfortable',
    notif: DEFAULT_NOTIF,
    channels: { desktop: true, email: true, sound: false, mobilePush: true },
    digest: 'daily',
    dnd: { enabled: false, from: '22:00', to: '08:00', days: [0, 1, 2, 3, 4, 5, 6] },
    integrations: SEED_INTEGRATIONS,
    twoFactor: false,
    sessions: SEED_SESSIONS,
    audit: SEED_AUDIT,
    workspaceName: '오로라랩스',
    workspaceDomain: 'aurora.nexus.app',

    setDensity: (density) => set({ density }),
    setNotif: (type, on) => set((s) => ({ notif: { ...s.notif, [type]: on } })),
    setChannel: (key, on) => set((s) => ({ channels: { ...s.channels, [key]: on } })),
    setDigest: (digest) => set({ digest }),
    setDnd: (patch) => set((s) => ({ dnd: { ...s.dnd, ...patch } })),
    connectIntegration: (id, name, account) => {
      set((s) => ({ integrations: { ...s.integrations, [id]: { connected: true, connectedAt: new Date().toISOString(), account } } }))
      get().log('integration', '연동 추가', `${name} · ${account}`)
    },
    disconnectIntegration: (id, name) => {
      set((s) => ({ integrations: { ...s.integrations, [id]: { connected: false } } }))
      get().log('integration', '연동 해제', name)
    },
    setTwoFactor: (twoFactor) => {
      set({ twoFactor })
      get().log('security', twoFactor ? '2단계 인증 활성화' : '2단계 인증 비활성화', 'TOTP 인증 앱')
    },
    revokeSession: (id) => {
      const ses = get().sessions.find((x) => x.id === id)
      set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }))
      if (ses) get().log('auth', '세션 로그아웃', `${ses.device} · ${ses.browser}`)
    },
    revokeOtherSessions: () => {
      const n = get().sessions.filter((x) => !x.current).length
      set((s) => ({ sessions: s.sessions.filter((x) => x.current) }))
      get().log('auth', '다른 모든 세션 로그아웃', `${n}개 기기`)
    },
    setWorkspace: (patch) => set(patch),
    log: (category, action, target) =>
      set((s) => ({
        audit: [{ id: uid('aud'), actorId: getCurrentUserId(), category, action, target, ip: '211.234.10.42', at: new Date().toISOString() }, ...s.audit].slice(0, 60),
      })),
  })),
)
syncAcrossTabs(useSettings)

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** True if the DND schedule is active at the given moment (handles overnight ranges). */
export function isDndActive(dnd: DndSchedule, at = new Date()): boolean {
  if (!dnd.enabled) return false
  const now = at.getHours() * 60 + at.getMinutes()
  const from = toMinutes(dnd.from)
  const to = toMinutes(dnd.to)
  if (from === to) return dnd.days.includes(at.getDay())
  if (from < to) return dnd.days.includes(at.getDay()) && now >= from && now < to
  // overnight: e.g. 22:00 → 08:00. Morning part belongs to the previous day's schedule.
  if (now >= from) return dnd.days.includes(at.getDay())
  if (now < to) return dnd.days.includes((at.getDay() + 6) % 7)
  return false
}
