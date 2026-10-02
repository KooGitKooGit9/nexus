import { AnimatePresence, motion } from 'framer-motion'
import { Copy, MousePointerClick, Trash2, Braces, Info, X } from 'lucide-react'
import { Avatar, Badge, Button, Field, Input, Textarea } from '@/components/ui'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import { useUser } from '@/store/core'
import { CATEGORY_META, getDef } from '../catalog'
import type { FlowNode, FlowNodeData, Workflow } from '../types'
import { NodeIcon, formatDuration } from '../components/bits'
import { FieldInput } from './fields'
import { demoWebhookUrl, nextCronRun } from '../engine'
import { isDemoWorkspace } from '@/lib/workspace'

interface Props {
  node: FlowNode | null
  workflow: Workflow
  variables: string[]
  onChangeData: (id: string, patch: Partial<FlowNodeData>) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onUpdateWorkflow: (patch: Partial<Workflow>) => void
  /** current (unsaved) graph node categories for the info panel */
  nodeTypesCount?: Record<string, number>
  overlay?: boolean
  onClose?: () => void
  className?: string
}

export function Inspector({ node, workflow, variables, onChangeData, onDelete, onDuplicate, onUpdateWorkflow, nodeTypesCount, overlay, onClose, className }: Props) {
  return (
    <aside
      className={cn(
        'glass-strong flex w-[320px] shrink-0 flex-col',
        overlay ? 'absolute bottom-3 right-3 top-3 z-30 max-w-[calc(100%-24px)] overflow-hidden rounded-2xl border border-line/10 shadow-float transition-[bottom] duration-300' : 'border-l border-line/10',
        className,
      )}
    >
      {overlay && onClose && (
        <button type="button" onClick={onClose} title="패널 닫기" className="absolute right-2.5 top-2.5 z-10 rounded-md p-1 text-muted transition hover:bg-line/10 hover:text-fg"><X className="h-4 w-4" /></button>
      )}
      <AnimatePresence mode="wait">
        {node ? (
          <motion.div key={node.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
            <NodeForm node={node} workflowId={workflow.id} variables={variables} onChangeData={onChangeData} onDelete={onDelete} onDuplicate={onDuplicate} />
          </motion.div>
        ) : (
          <motion.div key="wf" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} className="flex min-h-0 flex-1 flex-col">
            <WorkflowInfo workflow={workflow} onUpdate={onUpdateWorkflow} nodeTypesCount={nodeTypesCount} />
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}

function NodeForm({ node, workflowId, variables, onChangeData, onDelete, onDuplicate }: Omit<Props, 'workflow' | 'onUpdateWorkflow'> & { node: FlowNode; workflowId: string }) {
  const def = getDef(node.data.kind)
  const cat = CATEGORY_META[def.category]
  const setConfig = (key: string, v: unknown) => onChangeData(node.id, { config: { ...node.data.config, [key]: v } })
  return (
    <>
      <div className="border-b border-line/10 p-4 pr-10">
        <div className="flex items-center gap-3">
          <NodeIcon kind={node.data.kind} size="lg" />
          <div className="min-w-0">
            <div className={cn('text-[10.5px] font-semibold uppercase tracking-wider', cat.text)}>{cat.glyph} {cat.label}</div>
            <div className="truncate text-[15px] font-semibold text-fg">{def.label}</div>
            <div className="truncate text-xs text-muted">{def.description}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <Field label="단계 이름">
          <Input value={node.data.title ?? ''} placeholder={def.label} onChange={(e) => onChangeData(node.id, { title: e.target.value || undefined })} className="h-9" />
        </Field>
        {def.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <FieldInput field={f} value={node.data.config[f.key]} onChange={(v) => setConfig(f.key, v)} variables={variables} />
          </Field>
        ))}
        {node.data.kind === 'webhook' && (
          <div className="rounded-xl border border-warning/25 bg-warning/[0.06] p-3 text-[11.5px]">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-warning">엔드포인트 <Badge tone="warning">{isDemoWorkspace() ? '데모' : '곧 제공'}</Badge></div>
            <code className="block break-all font-mono text-[11px] text-fg/80">{String(node.data.config.method ?? 'POST')} {demoWebhookUrl(workflowId, String(node.data.config.path ?? '/hooks/new'))}</code>
            <p className="mt-1.5 text-muted">{isDemoWorkspace() ? '외부 호출 수신 서버는 없어요.' : '외부 호출 수신은 곧 제공돼요.'} 상단 <b>지금 실행</b>에서 JSON 본문을 넣어 웹훅 호출을 재현할 수 있어요.</p>
          </div>
        )}
        {node.data.kind === 'form_submitted' && (
          <div className="rounded-xl border border-info/25 bg-info/[0.06] p-3 text-[11.5px] text-muted">
            상단 <b className="text-fg">지금 실행</b>에서 양식 내용을 직접 입력해 제출할 수 있어요.
          </div>
        )}
        {node.data.kind === 'schedule' && (() => {
          const next = nextCronRun(String(node.data.config.cron ?? ''))
          return (
            <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3 text-[11.5px] text-muted">
              다음 실행: <b className="text-fg">{next ? formatDate(next, 'M월 d일 (EEE) HH:mm') : '8일 안에 없음'}</b>
              <div className="mt-0.5 text-subtle">워크플로우가 활성화돼 있으면 접속 중인 구성원 중 한 명의 브라우저에서 실행돼요.</div>
            </div>
          )
        })()}
        {def.outputs && (
          <div className="rounded-xl border border-line/10 bg-line/[0.03] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Braces className="h-3 w-3" />다음 단계에서 쓸 수 있는 변수</div>
            <div className="flex flex-wrap gap-1">
              {def.outputs.map((o) => <span key={o} className="rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[10.5px] text-accent">{`{{${o}}}`}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-line/10 p-3">
        <Button variant="secondary" size="sm" className="flex-1" leftIcon={<Copy className="h-3.5 w-3.5" />} onClick={() => onDuplicate(node.id)}>복제</Button>
        <Button variant="ghost" size="sm" className="flex-1 text-danger hover:bg-danger/10 hover:text-danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onDelete(node.id)}>삭제</Button>
      </div>
    </>
  )
}

function WorkflowInfo({ workflow, onUpdate, nodeTypesCount }: { workflow: Workflow; onUpdate: (p: Partial<Workflow>) => void; nodeTypesCount?: Record<string, number> }) {
  const owner = useUser(workflow.ownerId)
  const ok = workflow.runs.filter((r) => r.status === 'success').length
  const rate = workflow.runs.length ? Math.round((ok / workflow.runs.length) * 100) : 0
  const avg = workflow.runs.length ? Math.round(workflow.runs.reduce((n, r) => n + r.durationMs, 0) / workflow.runs.length) : 0
  const counts = (['trigger', 'condition', 'action', 'delay'] as const).map((c) => ({ c, n: nodeTypesCount ? nodeTypesCount[c] ?? 0 : workflow.nodes.filter((n) => n.type === c).length }))
  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-4">
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line/15 px-4 py-6 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent animate-float"><MousePointerClick className="h-5 w-5" /></div>
        <div className="text-sm font-semibold text-fg">노드를 선택하세요</div>
        <p className="mt-1 text-xs text-muted">선택한 단계의 설정을 여기서 편집할 수 있어요</p>
      </div>

      <Field label="설명">
        <Textarea value={workflow.description ?? ''} onChange={(e) => onUpdate({ description: e.target.value })} placeholder="이 워크플로우가 하는 일을 적어주세요" className="min-h-[70px] text-[13px]" />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '총 실행', value: workflow.runs.length.toLocaleString() },
          { label: '성공률', value: `${rate}%` },
          { label: '평균 소요', value: avg ? formatDuration(avg) : '-' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-line/[0.04] px-2 py-2.5 text-center">
            <div className="font-display text-base font-bold text-fg">{s.value}</div>
            <div className="text-[10.5px] text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-muted">구성</div>
        <div className="flex flex-wrap gap-1.5">
          {counts.filter((x) => x.n).map(({ c, n }) => (
            <Badge key={c} tone="neutral"><span className={CATEGORY_META[c].text}>{CATEGORY_META[c].glyph}</span>{CATEGORY_META[c].label} {n}</Badge>
          ))}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between"><span className="text-muted">소유자</span><span className="flex items-center gap-1.5 text-fg"><Avatar userId={workflow.ownerId} size="xs" />{owner?.name ?? '나간 멤버'}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted">생성일</span><span className="text-fg">{formatDate(workflow.createdAt)}</span></div>
        <div className="flex items-center justify-between"><span className="text-muted">마지막 수정</span><span className="text-fg">{timeAgo(workflow.updatedAt)}</span></div>
      </div>

      <div className="flex gap-2 rounded-xl bg-info/10 p-3 text-[11.5px] leading-relaxed text-info">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <b>테스트 실행</b>은 실제 엔진으로 샘플 데이터를 흘려보내되 메시지·태스크 등은 만들지 않아요.
          <b> 지금 실행</b>은 확인 후 실제로 동작하고, <b>활성</b> 상태면 트리거 이벤트에 자동으로 반응해요.
        </span>
      </div>
    </div>
  )
}
