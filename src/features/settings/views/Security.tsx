import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck, Smartphone, Laptop, Tablet, LogOut, KeyRound, ScrollText, Copy, Check, Monitor } from 'lucide-react'
import { toast } from '@/store/core'
import { Avatar, Badge, Button, Modal, Switch, Tabs, type Tone } from '@/components/ui'
import { cn, formatDate, hashIndex, timeAgo } from '@/lib/utils'
import { useCore } from '@/store/core'
import { useSettings } from '../store'
import type { AuditCategory, Session } from '../types'
import { SettingsSection, SettingRow } from '../components/Section'

const CAT: Record<AuditCategory, { label: string; tone: Tone }> = {
  auth: { label: '인증', tone: 'info' },
  member: { label: '멤버', tone: 'cyan' },
  security: { label: '보안', tone: 'danger' },
  data: { label: '데이터', tone: 'warning' },
  integration: { label: '연동', tone: 'accent' },
}

const DEVICE_ICON: Record<Session['kind'], typeof Laptop> = { desktop: Laptop, mobile: Smartphone, tablet: Tablet }

export function SecuritySettings() {
  const twoFactor = useSettings((s) => s.twoFactor)
  const setTwoFactor = useSettings((s) => s.setTwoFactor)
  const sessions = useSettings((s) => s.sessions)
  const revoke = useSettings((s) => s.revokeSession)
  const revokeOthers = useSettings((s) => s.revokeOtherSessions)
  const audit = useSettings((s) => s.audit)
  const [setup, setSetup] = useState(false)
  const [cat, setCat] = useState<'all' | AuditCategory>('all')
  const rows = audit.filter((a) => cat === 'all' || a.category === cat)

  const score = (twoFactor ? 40 : 0) + 30 + (sessions.length <= 2 ? 30 : sessions.length <= 4 ? 15 : 0)

  return (
    <>
      <SettingsSection title="계정 보안" description="워크스페이스는 Google Workspace SSO로 보호되고 있어요." icon={<ShieldCheck />}
        action={<div className="text-right"><div className="text-[11px] text-subtle">보안 점수</div><div className={cn('font-display text-2xl font-bold', score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-danger')}>{score}</div></div>}
      >
        <SettingRow label={<span className="flex items-center gap-2">2단계 인증 (TOTP){twoFactor ? <Badge tone="success" dot>활성</Badge> : <Badge tone="warning" dot>권장</Badge>}</span>} description="로그인할 때 인증 앱의 6자리 코드를 추가로 확인해요." icon={<KeyRound />}>
          <Switch checked={twoFactor} onChange={(v) => { if (v) setSetup(true); else { setTwoFactor(false); toast('2단계 인증을 해제했어요', { variant: 'warning' }) } }} />
        </SettingRow>
        <SettingRow label="SSO 로그인" description="Google Workspace SAML · aurora.io 도메인" icon={<ShieldCheck />}>
          <Badge tone="success">관리자 적용</Badge>
        </SettingRow>
        <SettingRow label="비밀번호" description="SSO 계정의 비밀번호는 Google 계정에서 관리돼요." icon={<KeyRound />}>
          <Button size="sm" variant="outline" onClick={() => toast('Google 계정 보안 페이지에서 변경할 수 있어요', { emoji: '🔐' })}>관리</Button>
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="로그인된 기기"
        description="내 계정에 로그인된 세션이에요. 모르는 기기가 있다면 바로 로그아웃하세요."
        icon={<Monitor />}
        delay={0.05}
        action={sessions.length > 1 && <Button size="sm" variant="outline" leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={() => { revokeOthers(); toast('다른 모든 기기에서 로그아웃했어요', { variant: 'success' }) }}>다른 기기 모두 로그아웃</Button>}
      >
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {sessions.map((s) => {
              const Icon = DEVICE_ICON[s.kind]
              return (
                <motion.div key={s.id} layout exit={{ opacity: 0, x: 30, height: 0 }} className={cn('flex items-center gap-3.5 rounded-2xl border p-3.5', s.current ? 'border-accent/25 bg-accent/[0.05]' : 'border-line/10')}>
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', s.current ? 'bg-accent-gradient text-white shadow-glow-sm' : 'bg-line/[0.06] text-muted')}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13.5px] font-medium">{s.device}{s.current && <Badge tone="accent">현재 세션</Badge>}</div>
                    <div className="truncate text-[12px] text-muted">{s.browser} · {s.os} · {s.location} · <span className="font-mono">{s.ip}</span></div>
                  </div>
                  <div className="text-right text-[11.5px]">
                    {s.current ? <span className="flex items-center gap-1.5 text-success"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />지금 활동 중</span> : <span className="text-subtle">{timeAgo(s.lastActive)}</span>}
                  </div>
                  {!s.current && (
                    <Button size="xs" variant="ghost" className="hover:!text-danger" onClick={() => { revoke(s.id); toast(`${s.device}에서 로그아웃했어요`) }}>로그아웃</Button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </SettingsSection>

      <SettingsSection title="감사 로그" description="워크스페이스에서 일어난 보안 관련 활동 기록이에요." icon={<ScrollText />} delay={0.1}>
        <Tabs<'all' | AuditCategory>
          size="sm"
          value={cat}
          onChange={setCat}
          items={[{ value: 'all', label: '전체' }, ...(Object.keys(CAT) as AuditCategory[]).map((k) => ({ value: k, label: CAT[k].label }))]}
        />
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line/10">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-line/[0.04] text-left text-[11.5px] text-muted">
                <th className="px-4 py-2.5 font-medium">시간</th>
                <th className="px-4 py-2.5 font-medium">사용자</th>
                <th className="px-4 py-2.5 font-medium">분류</th>
                <th className="px-4 py-2.5 font-medium">활동</th>
                <th className="px-4 py-2.5 font-medium">대상</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((a) => (
                <tr key={a.id} className="border-t border-line/[0.07] transition hover:bg-line/[0.03]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted" title={formatDate(a.at, 'yyyy.MM.dd HH:mm:ss')}>{timeAgo(a.at)}</td>
                  <td className="px-4 py-2.5"><AuditActor id={a.actorId} /></td>
                  <td className="px-4 py-2.5"><Badge tone={CAT[a.category].tone}>{CAT[a.category].label}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{a.action}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-muted">{a.target}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-subtle">{a.ip}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">기록이 없어요</td></tr>}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <TwoFactorModal open={setup} onClose={() => setSetup(false)} onDone={() => { setTwoFactor(true); setSetup(false); toast('2단계 인증이 활성화되었어요', { variant: 'success', emoji: '🛡️' }) }} />
    </>
  )
}

function AuditActor({ id }: { id: string }) {
  const u = useCore((s) => s.users.find((x) => x.id === id))
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <Avatar userId={id} size="xs" />
      {u?.name ?? id}
    </span>
  )
}

/** Deterministic fake QR code. */
function FakeQR({ seed }: { seed: string }) {
  const N = 25
  const cells = useMemo(() => {
    const out: boolean[] = []
    for (let i = 0; i < N * N; i++) out.push(hashIndex(seed + i, 100) < 48)
    return out
  }, [seed])
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7
    for (const [ox, oy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      if (inBox(ox, oy)) {
        const dx = x - ox, dy = y - oy
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0
      }
    }
    return -1
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} className="h-44 w-44 rounded-xl bg-white p-2.5" shapeRendering="crispEdges">
      {Array.from({ length: N * N }, (_, i) => {
        const x = i % N, y = Math.floor(i / N)
        const f = finder(x, y)
        const on = f === -1 ? cells[i] : f === 1
        return on ? <rect key={i} x={x} y={y} width={1} height={1} fill="#0f1222" /> : null
      })}
    </svg>
  )
}

function TwoFactorModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)
  const backup = useMemo(() => Array.from({ length: 8 }, (_, i) => `${(hashIndex('bk' + i, 9000) + 1000)}-${(hashIndex('ck' + i, 9000) + 1000)}`), [])
  const secret = 'NXUS 7KQ2 MZ4P A9LD'

  const close = () => { setCode(''); setStep(1); onClose() }
  const verify = () => {
    setVerifying(true)
    setTimeout(() => { setVerifying(false); setStep(2) }, 800)
  }

  return (
    <Modal open={open} onClose={close} size="md" title="2단계 인증 설정" description={step === 1 ? '인증 앱(Google Authenticator, 1Password 등)으로 QR 코드를 스캔하세요.' : '백업 코드를 안전한 곳에 보관하세요.'}
      footer={step === 1
        ? <><Button variant="ghost" onClick={close}>취소</Button><Button variant="primary" disabled={code.length !== 6} loading={verifying} onClick={verify}>확인</Button></>
        : <Button variant="primary" onClick={() => { close(); onDone() }}>완료</Button>}
    >
      {step === 1 ? (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <FakeQR seed="nexus-haneul" />
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-xs text-muted">수동 입력 키</div>
              <div className="mt-1 rounded-lg bg-line/[0.05] px-3 py-2 font-mono text-sm tracking-wider">{secret}</div>
            </div>
            <div>
              <div className="mb-1.5 text-xs text-muted">앱에 표시된 6자리 코드</div>
              <input
                autoFocus
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="input-base text-center font-mono text-2xl tracking-[0.5em]"
              />
              <div className="mt-1.5 text-[11px] text-subtle">데모 환경이에요. 아무 6자리 숫자나 입력하세요.</div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line/10 bg-line/[0.03] p-4 font-mono text-sm">
            {backup.map((b) => <span key={b} className="text-center">{b}</span>)}
          </div>
          <Button size="sm" variant="outline" className="mt-3" leftIcon={copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            onClick={() => { navigator.clipboard?.writeText(backup.join('\n')); setCopied(true) }}>
            {copied ? '복사됨' : '백업 코드 복사'}
          </Button>
        </div>
      )}
    </Modal>
  )
}
