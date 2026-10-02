import { useEffect, useState } from 'react'
import { AlertTriangle, Copy, Play, Webhook } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, Textarea } from '@/components/ui'
import { toast } from '@/store/core'
import { getDef } from '../catalog'
import { demoWebhookUrl, samplePayload, type Payload } from '../engine'
import type { FlowNode, Workflow } from '../types'

const FORM_FIELDS: { key: string; label: string; textarea?: boolean }[] = [
  { key: 'form.name', label: '이름' },
  { key: 'form.email', label: '이메일' },
  { key: 'form.company', label: '회사' },
  { key: 'form.message', label: '메시지', textarea: true },
]

const SIDE_EFFECT: Record<string, string> = {
  send_message: '채널에 Nexus Bot 메시지 전송',
  create_task: '프로젝트에 태스크 생성 (담당자에게 알림)',
  request_approval: '전자결재 문서 상신 (결재자에게 알림)',
  create_doc: '위키에 문서 생성',
  http_request: '외부 URL로 HTTP 요청',
  notify: '구성원에게 알림 전송',
  send_email: '이메일 발송 기록 (데모 · 실제 메일 없음)',
  ai_summary: 'AI 요약 (키가 없으면 로컬 요약)',
  delay: '지연 — 이 브라우저가 열려 있는 동안 대기',
}

/** "지금 실행": confirm real side effects and (for form / webhook triggers) enter the payload. */
export function ManualRunModal({ open, onClose, workflow, nodes, onRun }: {
  open: boolean
  onClose: () => void
  workflow: Workflow
  nodes: FlowNode[]
  onRun: (payload: Payload) => void
}) {
  const trigger = nodes.find((n) => n.type === 'trigger')
  const kind = trigger?.data.kind
  const [form, setForm] = useState<Payload>({})
  const [json, setJson] = useState('')
  const [sample, setSample] = useState<Payload>({})

  // snapshot the sample when the dialog opens (later store updates must not wipe what the user typed)
  useEffect(() => {
    if (!open) return
    const s = samplePayload(workflow, trigger)
    setSample(s)
    setForm(Object.fromEntries(FORM_FIELDS.map((f) => [f.key, s[f.key] ?? ''])))
    setJson(JSON.stringify({ service: 'api-gateway', severity: 'critical', message: '5xx 에러율 12% 초과' }, null, 2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const effects = [...new Set(nodes.filter((n) => n.type === 'action' || n.type === 'delay').map((n) => n.data.kind))]
  let jsonError = ''
  let parsed: Record<string, unknown> | null = null
  if (kind === 'webhook') {
    try {
      const v = JSON.parse(json || '{}') as unknown
      if (v && typeof v === 'object' && !Array.isArray(v)) parsed = v as Record<string, unknown>
      else jsonError = 'JSON 객체여야 해요'
    } catch {
      jsonError = '올바른 JSON이 아니에요'
    }
  }

  const start = () => {
    let payload: Payload = { ...sample }
    if (kind === 'form_submitted') payload = { ...payload, ...form }
    if (kind === 'webhook' && parsed) {
      payload = { ...payload, body: JSON.stringify(parsed) }
      for (const [k, v] of Object.entries(parsed)) payload[`body.${k}`] = typeof v === 'string' ? v : JSON.stringify(v)
    }
    onRun(payload)
    onClose()
  }

  const url = kind === 'webhook' ? demoWebhookUrl(workflow.id, String(trigger?.data.config.path ?? '/hooks/new')) : ''
  const preview = Object.entries(sample).filter(([k]) => k.startsWith(kind === 'message_received' ? 'message.' : kind === 'task_status' || kind === 'schedule' ? 'task.' : kind === 'approval_requested' ? 'approval.' : kind === 'event_start' ? 'event.' : 'now.')).slice(0, 6)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={<span className="flex items-center gap-2"><Play className="h-4 w-4 text-accent" />지금 실행 — 실제 동작</span>}
      description={trigger ? `트리거: ${getDef(trigger.data.kind).label}${workflow.enabled ? '' : ' · 워크플로우가 꺼져 있어도 수동 실행은 가능해요'}` : '트리거가 없어요'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" leftIcon={<Play className="h-3.5 w-3.5 fill-current" />} disabled={!trigger || !!jsonError} onClick={start}>실제로 실행</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.07] p-3 text-[12.5px] text-fg/85">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <div className="font-medium">테스트가 아니라 실제로 실행돼요. 모든 구성원에게 보이는 변경이 생겨요.</div>
            {effects.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-muted">
                {effects.map((k) => <li key={k}>• {getDef(k).label} — {SIDE_EFFECT[k] ?? '실행'}</li>)}
              </ul>
            )}
          </div>
        </div>

        {kind === 'form_submitted' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {FORM_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} className={f.textarea ? 'sm:col-span-2' : undefined}>
                {f.textarea ? (
                  <Textarea value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="min-h-[70px] text-[13px]" />
                ) : (
                  <Input value={form[f.key] ?? ''} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} className="h-9" />
                )}
              </Field>
            ))}
          </div>
        )}

        {kind === 'webhook' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
              <div className="mb-1.5 flex items-center gap-2 text-[12px] font-medium text-muted">
                <Webhook className="h-3.5 w-3.5" /> 엔드포인트 <Badge tone="warning">데모</Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-line/[0.06] px-2 py-1 font-mono text-[11.5px]">{String(trigger?.data.config.method ?? 'POST')} {url}</code>
                <Button size="icon-sm" variant="ghost" aria-label="복사" onClick={() => { void navigator.clipboard?.writeText(url); toast('URL을 복사했어요', { emoji: '🔗' }) }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <p className="mt-1.5 text-[11px] text-subtle">이 데모에는 외부에서 들어오는 웹훅 수신 서버가 없어요. 아래 본문으로 웹훅 호출을 대신 실행해요.</p>
            </div>
            <Field label="요청 본문 (JSON)" hint={jsonError || '{{body.키}} 로 각 값을 쓸 수 있어요'}>
              <Textarea value={json} onChange={(e) => setJson(e.target.value)} className="min-h-[120px] font-mono text-[12px]" />
            </Field>
          </div>
        )}

        {kind !== 'form_submitted' && kind !== 'webhook' && preview.length > 0 && (
          <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
            <div className="mb-2 text-[12px] font-medium text-muted">트리거 데이터 (현재 워크스페이스 기준)</div>
            <div className="space-y-1 font-mono text-[11.5px]">
              {preview.map(([k, v]) => (
                <div key={k} className="flex gap-2"><span className="shrink-0 text-accent">{`{{${k}}}`}</span><span className="min-w-0 truncate text-fg/80">{v || '—'}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
