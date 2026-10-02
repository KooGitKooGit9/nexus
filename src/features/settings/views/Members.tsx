import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Crown, Link2, LogOut, Mail, RefreshCw, Search, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { api, type Invite, type Member, type Role } from '@/lib/api'
import { reloadInto, useWorkspace } from '@/lib/workspace'
import { toast } from '@/store/core'
import { Badge, Button, Modal, Select, Skeleton, Textarea, type Tone } from '@/components/ui'
import { cn, formatDate, gradientFor, initials } from '@/lib/utils'
import { FormAlert } from '@/features/public/components/Fields'
import { InviteLinkList } from '@/features/public/InviteLinks'
import { absoluteUrl, errorMessage, parseEmails, useCopy } from '@/features/public/lib'
import { isPlanLimitError, planLimitKind, PlanLimitNotice, type LimitKind } from '../billing'
import { SettingsSection } from '../components/Section'

export const ROLE_META: Record<Role, { label: string; tone: Tone; icon?: typeof Crown }> = {
  owner: { label: '소유자', tone: 'accent', icon: Crown },
  admin: { label: '관리자', tone: 'cyan', icon: Shield },
  member: { label: '멤버', tone: 'neutral' },
}

export function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role]
  return <Badge tone={m.tone} icon={m.icon ? <m.icon className="h-3 w-3" /> : undefined}>{m.label}</Badge>
}

function MemberFace({ m }: { m: Member }) {
  return (
    <span className="relative shrink-0">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-semibold text-white', gradientFor(m.memberId))}>{initials(m.name)}</span>
      <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface', m.online ? 'bg-emerald-400' : 'bg-zinc-500')} title={m.online ? '접속 중' : '오프라인'} />
    </span>
  )
}

type Data = { members: Member[]; invites: Invite[] }

export function MemberSettings() {
  const ws = useWorkspace()
  const offline = ws.id === 'local'
  const isAdmin = ws.role === 'owner' || ws.role === 'admin'
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!offline)
  const [q, setQ] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'remove' | 'leave'; m: Member } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ask = (c: { kind: 'remove' | 'leave'; m: Member }) => { setConfirm(c); setConfirmOpen(true) }

  const load = useCallback(async () => {
    if (offline) return
    setLoading(true)
    setError(null)
    try {
      setData(await api.members(ws.id))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [ws.id, offline])

  useEffect(() => { void load() }, [load])

  const members = useMemo(() => {
    const list = data?.members ?? []
    const order: Record<Role, number> = { owner: 0, admin: 1, member: 2 }
    return list
      .filter((m) => !q || `${m.name} ${m.email}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => order[a.role] - order[b.role] || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'ko'))
  }, [data, q])

  const setRole = async (m: Member, role: Role) => {
    if (role === m.role) return
    setBusy(m.memberId)
    try {
      await api.setMemberRole(ws.id, m.memberId, role)
      setData((d) => d && { ...d, members: d.members.map((x) => (x.memberId === m.memberId ? { ...x, role } : x)) })
      toast(`${m.name}님의 역할을 ${ROLE_META[role].label}(으)로 바꿨어요`, { variant: 'success' })
    } catch (e) {
      toast('역할을 바꾸지 못했어요', { variant: 'error', description: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  const runConfirm = async () => {
    if (!confirm) return
    const { kind, m } = confirm
    setBusy(m.memberId)
    try {
      await api.removeMember(ws.id, m.memberId)
      if (kind === 'leave') {
        reloadInto('/')
        return
      }
      setData((d) => d && { ...d, members: d.members.filter((x) => x.memberId !== m.memberId) })
      toast(`${m.name}님을 워크스페이스에서 내보냈어요`)
      setConfirmOpen(false)
    } catch (e) {
      toast(kind === 'leave' ? '워크스페이스에서 나가지 못했어요' : '멤버를 내보내지 못했어요', { variant: 'error', description: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (inv: Invite) => {
    setBusy(inv.token)
    try {
      await api.revokeInvite(ws.id, inv.token)
      setData((d) => d && { ...d, invites: d.invites.filter((x) => x.token !== inv.token) })
      toast('초대를 취소했어요')
    } catch (e) {
      toast('초대를 취소하지 못했어요', { variant: 'error', description: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  if (offline) {
    return (
      <SettingsSection title="멤버" icon={<Users />} description="오프라인 데모 모드에서는 멤버를 관리할 수 없어요.">
        <p className="text-[13px] text-muted">서버에 연결된 워크스페이스에서 동료를 초대하고 역할을 관리할 수 있어요.</p>
      </SettingsSection>
    )
  }

  const onlineCount = data?.members.filter((m) => m.online).length ?? 0

  return (
    <>
      <SettingsSection
        title="멤버"
        icon={<Users />}
        description={data ? `${data.members.length}명 · 지금 ${onlineCount}명 접속 중` : '워크스페이스 구성원을 관리해요.'}
        action={
          <div className="flex items-center gap-1.5">
            <Button size="icon-sm" variant="ghost" aria-label="새로고침" onClick={() => void load()} disabled={loading}><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button>
            {isAdmin && <Button size="sm" variant="primary" leftIcon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => setInviteOpen(true)}>초대하기</Button>}
          </div>
        }
      >
        {!isAdmin && (
          <div className="mb-4 rounded-xl border border-line/10 bg-line/[0.03] px-3.5 py-2.5 text-[12.5px] text-muted">멤버 초대와 역할 변경은 소유자와 관리자만 할 수 있어요.</div>
        )}
        {error && (
          <div className="mb-4 space-y-2">
            <FormAlert>{error}</FormAlert>
            <Button size="sm" variant="outline" onClick={() => void load()}>다시 시도</Button>
          </div>
        )}
        {(data?.members.length ?? 0) > 6 && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 또는 이메일로 찾기" aria-label="멤버 검색" className="input-base pl-9" />
          </div>
        )}
        {loading && !data ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {members.map((m) => {
                const self = m.memberId === ws.memberId
                const canEdit = isAdmin && !self && m.role !== 'owner' && !(ws.role === 'admin' && m.role === 'admin')
                return (
                  <motion.li key={m.memberId} layout exit={{ opacity: 0, height: 0 }} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-3', self ? 'border-accent/25 bg-accent/[0.04]' : 'border-line/10')}>
                    <MemberFace m={m} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
                        <span className="truncate">{m.name}</span>
                        {self && <span className="text-[11.5px] text-subtle">(나)</span>}
                        <RoleBadge role={m.role} />
                      </div>
                      <div className="truncate text-[12px] text-muted">{m.email} · {formatDate(m.joinedAt, 'yyyy.MM.dd')} 참여</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canEdit && (
                        <Select aria-label={`${m.name} 역할`} value={m.role} disabled={busy === m.memberId} onChange={(e) => void setRole(m, e.target.value as Role)} className="h-8 w-[104px] py-1 text-[12.5px]">
                          <option value="admin">관리자</option>
                          <option value="member">멤버</option>
                        </Select>
                      )}
                      {canEdit && (
                        <Button size="icon-sm" variant="ghost" className="hover:!text-danger" aria-label={`${m.name} 내보내기`} onClick={() => ask({ kind: 'remove', m })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {self && m.role !== 'owner' && (
                        <Button size="xs" variant="ghost" className="hover:!text-danger" leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={() => ask({ kind: 'leave', m })}>나가기</Button>
                      )}
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
            {data && members.length === 0 && <li className="py-8 text-center text-[13px] text-muted">조건에 맞는 멤버가 없어요</li>}
          </ul>
        )}
      </SettingsSection>

      {isAdmin && data && (
        <SettingsSection title="대기 중인 초대" icon={<Mail />} description="아직 수락되지 않은 초대예요. 링크를 다시 보내거나 취소할 수 있어요." delay={0.05}>
          {data.invites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line/15 py-8 text-center text-[13px] text-muted">대기 중인 초대가 없어요</div>
          ) : (
            <ul className="space-y-2">
              {data.invites.map((inv) => <PendingInvite key={inv.token} inv={inv} busy={busy === inv.token} onRevoke={() => void revoke(inv)} />)}
            </ul>
          )}
        </SettingsSection>
      )}

      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        wsId={ws.id}
        canInviteAdmin={isAdmin}
        onCreated={(list) => setData((d) => d && { ...d, invites: [...list, ...d.invites] })}
      />

      <Modal
        open={confirmOpen}
        onClose={() => { if (busy === null) setConfirmOpen(false) }}
        size="sm"
        title={confirm?.kind === 'leave' ? `${ws.name}에서 나갈까요?` : `${confirm?.m.name}님을 내보낼까요?`}
        description={confirm?.kind === 'leave' ? '나가면 이 워크스페이스의 대화와 문서를 더 이상 볼 수 없어요. 다시 참여하려면 새 초대가 필요해요.' : '이 멤버는 더 이상 워크스페이스에 접근할 수 없어요. 작성한 메시지와 문서는 남아요.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy !== null}>취소</Button>
            <Button variant="danger" loading={busy !== null} onClick={() => void runConfirm()}>{confirm?.kind === 'leave' ? '나가기' : '내보내기'}</Button>
          </>
        }
      />
    </>
  )
}

function PendingInvite({ inv, busy, onRevoke }: { inv: Invite; busy: boolean; onRevoke: () => void }) {
  const { copied, copy } = useCopy()
  const expired = new Date(inv.expiresAt).getTime() < Date.now()
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-line/10 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line/[0.06] text-muted">{inv.email ? <Mail className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium">
          <span className="truncate">{inv.email ?? '링크 초대 (누구나)'}</span>
          <RoleBadge role={inv.role} />
          {expired && <Badge tone="warning">만료됨</Badge>}
        </div>
        <div className="text-[12px] text-muted">{formatDate(inv.createdAt, 'M월 d일')} 생성 · {formatDate(inv.expiresAt, 'M월 d일')} 만료</div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="xs" variant="outline" leftIcon={copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />} onClick={() => void copy(absoluteUrl(inv.url))} disabled={expired}>
          {copied ? '복사됨' : '링크 복사'}
        </Button>
        <Button size="xs" variant="ghost" className="hover:!text-danger" loading={busy} onClick={onRevoke}>취소</Button>
      </div>
    </li>
  )
}

function InviteModal({ open, onClose, wsId, canInviteAdmin, onCreated }: { open: boolean; onClose: () => void; wsId: string; canInviteAdmin: boolean; onCreated: (list: Invite[]) => void }) {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<{ kind?: LimitKind; message: string } | null>(null)
  const [created, setCreated] = useState<Invite[]>([])
  const parsed = parseEmails(emails)

  const close = () => {
    if (loading) return
    onClose()
    setTimeout(() => { setEmails(''); setRole('member'); setError(null); setLimit(null); setCreated([]) }, 200)
  }

  const submit = async (linkOnly: boolean) => {
    if (!linkOnly) {
      if (parsed.invalid.length) { setError(`이메일 형식을 확인해 주세요: ${parsed.invalid.slice(0, 3).join(', ')}`); return }
      if (!parsed.valid.length) { setError('초대할 이메일을 입력하거나, 링크 초대를 만들어 주세요.'); return }
    }
    setLoading(true)
    setError(null)
    setLimit(null)
    try {
      const { invites } = await api.createInvites(wsId, linkOnly ? { role } : { emails: parsed.valid, role })
      setCreated((c) => [...invites, ...c])
      onCreated(invites)
      if (!linkOnly) setEmails('')
    } catch (e) {
      if (isPlanLimitError(e)) setLimit({ kind: planLimitKind(e), message: e.message })
      else setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title="동료 초대하기"
      description="이메일로 초대하거나, 누구나 참여할 수 있는 링크를 만들어 공유하세요."
      footer={<Button variant={created.length ? 'primary' : 'ghost'} onClick={close}>{created.length ? '완료' : '닫기'}</Button>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-[12.5px] font-medium text-muted">이메일</span>
          <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={'jiwoo@company.com, minjun@company.com\n쉼표나 줄바꿈으로 여러 명을 입력하세요'} className="mt-1.5 min-h-[88px]" />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block w-36">
            <span className="text-[12.5px] font-medium text-muted">역할</span>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1.5">
              <option value="member">멤버</option>
              {canInviteAdmin && <option value="admin">관리자</option>}
            </Select>
          </label>
          <div className="min-w-0 flex-1 pb-2 text-[12px] text-subtle">
            {emails.trim() ? <>{parsed.valid.length}명 초대 예정{parsed.invalid.length > 0 && <span className="text-danger"> · 형식 오류 {parsed.invalid.length}개</span>}</> : '관리자는 멤버 초대와 역할 관리를 할 수 있어요.'}
          </div>
        </div>
        {error && <FormAlert>{error}</FormAlert>}
        {limit && <PlanLimitNotice limit={limit.kind} message={limit.message} />}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" className="flex-1" loading={loading} leftIcon={<UserPlus className="h-4 w-4" />} onClick={() => void submit(false)}>이메일로 초대</Button>
          <Button variant="outline" className="flex-1" disabled={loading} leftIcon={<Link2 className="h-4 w-4" />} onClick={() => void submit(true)}>링크 초대 만들기</Button>
        </div>
        <p className="text-[11.5px] text-subtle break-keep">메일 발송이 설정된 서버라면 초대 메일이 함께 가요. 만들어진 링크는 메신저 등으로 직접 전달해도 돼요.</p>
        {created.length > 0 && (
          <div>
            <div className="mb-2 text-[12.5px] font-semibold">만들어진 초대 링크</div>
            <InviteLinkList invites={created} />
          </div>
        )}
      </div>
    </Modal>
  )
}
