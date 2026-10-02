import { useEffect, useMemo, useState } from 'react'
import { Database, Download, AlertTriangle, RotateCcw, FileJson, History, Trash2, Server, Users } from 'lucide-react'
import { getCurrentUserId, toast } from '@/store/core'
import { STORAGE_PREFIX, resetWorkspace } from '@/lib/persist'
import { useSyncStatus } from '@/lib/sync'
import { Badge, Button, Modal } from '@/components/ui'
import { formatBytes, formatDate } from '@/lib/utils'
import { useSettings } from '../store'
import { SettingsSection, SettingRow } from '../components/Section'

const LABELS: Record<string, string> = {
  core: '사용자 · 알림 · 환경설정', messenger: '메신저', projects: '프로젝트 & 태스크', calendar: '캘린더', docs: '문서 & 위키',
  files: '드라이브', workflows: '자동화', approvals: '전자결재', goals: 'OKR & 공지', people: '구성원', whiteboard: '화이트보드',
  settings: '설정', 'palette-recent': '커맨드 팔레트 최근 항목', inbox: '구성원 알림 배달함', 'calendar-prefs': '캘린더 보기 설정',
}

function readKeys() {
  const out: { key: string; name: string; bytes: number }[] = []
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith(STORAGE_PREFIX)) continue
      const v = localStorage.getItem(k) ?? ''
      out.push({ key: k, name: k.slice(STORAGE_PREFIX.length), bytes: new Blob([v]).size })
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => b.bytes - a.bytes)
}

type Bootstrap = { stores: Record<string, Record<string, unknown[]>>; userState: Record<string, unknown>; online?: string[] }

const fetchBootstrap = async (): Promise<Bootstrap> => {
  const r = await fetch(`/api/bootstrap?user=${encodeURIComponent(getCurrentUserId())}`)
  if (!r.ok) throw new Error(String(r.status))
  return (await r.json()) as Bootstrap
}

/** Shared collections on the server → rows for the usage list. */
function serverKeys(b: Bootstrap) {
  const out: { key: string; name: string; bytes: number; items: number }[] = []
  for (const [store, colls] of Object.entries(b.stores ?? {})) {
    let bytes = 0
    let items = 0
    for (const list of Object.values(colls ?? {})) {
      items += list.length
      bytes += new Blob([JSON.stringify(list)]).size
    }
    out.push({ key: `server:${store}`, name: store, bytes, items })
  }
  return out.sort((a, b) => b.bytes - a.bytes)
}

function download(payload: unknown, prefix: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}-${formatDate(new Date(), 'yyyyMMdd-HHmm')}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return blob.size
}

export function DataSettings() {
  const [tick, setTick] = useState(0)
  const serverMode = useSyncStatus((s) => s.mode === 'server')
  const onlineCount = useSyncStatus((s) => s.online.length)
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [bootError, setBootError] = useState(false)
  useEffect(() => {
    if (!serverMode) return
    let alive = true
    fetchBootstrap().then((b) => { if (alive) { setBoot(b); setBootError(false) } }).catch(() => { if (alive) setBootError(true) })
    return () => { alive = false }
  }, [serverMode, tick])
  const localKeys = useMemo(() => readKeys(), [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const keys: { key: string; name: string; bytes: number; items?: number }[] = serverMode && boot ? serverKeys(boot) : localKeys
  const total = keys.reduce((s, k) => s + k.bytes, 0)
  const log = useSettings((s) => s.log)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const [exporting, setExporting] = useState(false)

  const exportAll = async () => {
    if (serverMode) {
      setExporting(true)
      try {
        const b = await fetchBootstrap()
        const size = download(
          { app: 'Nexus', workspace: 'Aurora Labs', source: 'server', exportedAt: new Date().toISOString(), exportedBy: getCurrentUserId(), version: 2, shared: b.stores, myState: b.userState },
          'nexus-workspace',
        )
        const n = Object.keys(b.stores ?? {}).length
        log('data', '워크스페이스 내보내기 (서버)', `${n}개 저장소 · ${formatBytes(size)}`)
        toast('서버의 워크스페이스 데이터를 내보냈어요', { variant: 'success', description: `공유 데이터 ${n}개 저장소 + 내 개인 설정 · ${formatBytes(size)}`, emoji: '📦' })
      } catch {
        toast('내보내기에 실패했어요', { variant: 'error', description: '서버에 연결할 수 없어요. 잠시 후 다시 시도하세요.' })
      } finally {
        setExporting(false)
        setTick((t) => t + 1)
      }
      return
    }
    exportLocal()
  }

  const exportLocal = () => {
    const data: Record<string, unknown> = {}
    for (const k of localKeys) {
      const raw = localStorage.getItem(k.key)
      try { data[k.key] = raw ? JSON.parse(raw) : null } catch { data[k.key] = raw }
    }
    const size = download({ app: 'Nexus', workspace: 'Aurora Labs', source: 'browser', exportedAt: new Date().toISOString(), version: 1, data }, 'nexus-workspace')
    log('data', '워크스페이스 내보내기', `${localKeys.length}개 저장소 · ${formatBytes(size)}`)
    setTick((t) => t + 1)
    toast('워크스페이스 데이터를 내보냈어요', { variant: 'success', description: `${localKeys.length}개 저장소 · ${formatBytes(size)}`, emoji: '📦' })
  }

  const clearRecent = () => {
    try { localStorage.removeItem(`${STORAGE_PREFIX}palette-recent`) } catch { /* ignore */ }
    setTick((t) => t + 1)
    toast('최근 검색 기록을 지웠어요', { emoji: '🧹' })
  }

  return (
    <>
      <SettingsSection
        title="데이터 내보내기"
        description={
          serverMode
            ? '워크스페이스 데이터는 Nexus 서버(SQLite)에 저장되고 모든 구성원이 실시간으로 공유해요. 서버의 공유 데이터와 내 개인 설정을 JSON으로 백업할 수 있어요.'
            : '서버 없이 실행 중이라 모든 데이터가 이 브라우저(localStorage)에 저장돼요. JSON으로 백업할 수 있어요.'
        }
        icon={serverMode ? <Server /> : <Database />}
        action={<Button variant="primary" loading={exporting} leftIcon={<Download className="h-4 w-4" />} onClick={() => void exportAll()}>JSON 내보내기</Button>}
      >
        {serverMode && bootError && <div className="mb-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[12.5px] text-warning">서버 사용량을 불러오지 못해 이 브라우저 캐시를 표시하고 있어요.</div>}
        <div className="mb-3 flex items-center gap-3 text-[13px]">
          <span className="text-muted">총 사용량</span>
          <span className="font-display text-lg font-bold">{formatBytes(total)}</span>
          <Badge>{keys.length}개 저장소</Badge>
          {serverMode && boot && <Badge tone="success">서버</Badge>}
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-line/[0.07]">
          {keys.map((k, i) => (
            <div key={k.key} title={`${k.name} · ${formatBytes(k.bytes)}`} className="h-full" style={{ width: `${(k.bytes / (total || 1)) * 100}%`, background: `hsl(${(260 + i * 37) % 360} 75% 62%)` }} />
          ))}
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {keys.map((k, i) => (
            <div key={k.key} className="flex items-center gap-2.5 border-b border-line/[0.06] py-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: `hsl(${(260 + i * 37) % 360} 75% 62%)` }} />
              <FileJson className="h-3.5 w-3.5 shrink-0 text-subtle" />
              <span className="min-w-0 flex-1 truncate">{LABELS[k.name] ?? k.name}</span>
              <span className="font-mono text-[11px] text-subtle">{k.items !== undefined ? `${k.items.toLocaleString()}개 항목` : k.key}</span>
              <span className="w-16 text-right font-medium">{formatBytes(k.bytes)}</span>
            </div>
          ))}
          {keys.length === 0 && <div className="py-6 text-center text-sm text-muted sm:col-span-2">저장된 데이터가 없어요</div>}
        </div>
      </SettingsSection>

      <SettingsSection title="개인 기록" icon={<History />} delay={0.05}>
        <SettingRow label="커맨드 팔레트 최근 항목" description="⌘K에서 최근 선택한 5개 항목을 지워요." icon={<History />}>
          <Button size="sm" variant="outline" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={clearRecent}>지우기</Button>
        </SettingRow>
      </SettingsSection>

      {/* danger zone */}
      <section className="relative overflow-hidden rounded-3xl border border-danger/30 bg-danger/[0.04] p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-danger/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger"><AlertTriangle className="h-5 w-5" /></div>
            <div>
              <h2 className="text-[15px] font-semibold text-danger">위험 구역</h2>
              <div className="mt-2 text-[13.5px] font-medium">워크스페이스 초기화</div>
              <p className="mt-0.5 max-w-lg text-[12.5px] text-muted">
                {serverMode ? (
                  <>
                    <b className="text-danger">모든 구성원에게 적용돼요.</b> 서버에 저장된 메시지, 태스크, 문서, 일정, 결재, 파일 목록과 모든 사람의 개인 설정을 삭제하고 처음 데모 상태로 되돌려요.
                    {onlineCount > 1 && <> 지금 접속 중인 {onlineCount - 1}명의 화면도 즉시 새로고침돼요.</>} 이 작업은 되돌릴 수 없어요.
                  </>
                ) : (
                  '메시지, 태스크, 문서, 일정, 설정 등 이 브라우저에 저장된 모든 Nexus 데이터를 삭제하고 처음 데모 상태로 되돌려요. 이 작업은 되돌릴 수 없어요.'
                )}
              </p>
            </div>
          </div>
          <Button variant="danger" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirm(true)}>워크스페이스 초기화</Button>
        </div>
      </section>

      <Modal
        open={confirm}
        onClose={() => { setConfirm(false); setTyped('') }}
        size="sm"
        title={<span className="flex items-center gap-2 text-danger"><AlertTriangle className="h-5 w-5" />정말 초기화할까요?</span>}
        description={serverMode ? '서버의 워크스페이스 전체가 초기화되고 모든 구성원의 화면이 새로고침됩니다.' : '모든 로컬 데이터가 삭제되고 페이지가 새로고침됩니다.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setConfirm(false); setTyped('') }}>취소</Button>
            <Button variant="danger" disabled={typed !== '초기화'} onClick={() => resetWorkspace()}>영구적으로 초기화</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-danger/20 bg-danger/[0.06] p-3 text-[12.5px] text-fg/85">
            삭제 대상: <b>{serverMode ? '서버 공유 데이터 · ' : ''}{keys.length}개 저장소</b> · {formatBytes(total)}
            {serverMode && <><br /><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> 모든 구성원의 데이터가 함께 삭제돼요.</span></>}
            <br />먼저 <button className="font-medium text-accent hover:underline" onClick={() => void exportAll()}>JSON으로 백업</button>해 두는 걸 권장해요.
          </div>
          <label className="block text-[12.5px] text-muted">
            확인을 위해 <b className="text-fg">초기화</b>를 입력하세요
            <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className="input-base mt-1.5" placeholder="초기화" />
          </label>
        </div>
      </Modal>
    </>
  )
}
