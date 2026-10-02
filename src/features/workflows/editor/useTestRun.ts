import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge } from '@xyflow/react'
import { sleep } from '@/lib/utils'
import { toast } from '@/store/core'
import { getDef } from '../catalog'
import { executionOrder } from '../graph'
import { runWorkflow, samplePayload, type Payload, type RunMode } from '../engine'
import { useWorkflows } from '../store'
import type { FlowNode } from '../types'
import { EMPTY_RUN, type RunVisualState } from './runContext'

export interface LogLine {
  id: number
  at: number
  tone: 'info' | 'success' | 'warn' | 'error' | 'muted' | 'accent'
  text: string
  kind?: string
}

const UNIT: Record<string, string> = { minutes: '분', hours: '시간', days: '일' }

function waitLabel(ms: number) {
  if (ms >= 86_400_000) return `${Math.round(ms / 86_400_000)}일`
  if (ms >= 3_600_000) return `${Math.round(ms / 3_600_000)}시간`
  return `${Math.max(1, Math.round(ms / 60_000))}분`
}

/**
 * Editor runs on the real engine:
 * - `run('dry')`  — "테스트 실행": sandbox with sample data, same evaluation, no side effects.
 * - `run('live', payload)` — "지금 실행": real actions (after a confirm in the UI).
 * The node/edge animation is driven by the engine's step hooks.
 */
export function useTestRun(workflowId: string, getGraph: () => { nodes: FlowNode[]; edges: Edge[] }) {
  const [visual, setVisual] = useState<RunVisualState>(EMPTY_RUN)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<null | { ok: boolean; ms: number; steps: number }>(null)
  const [mode, setMode] = useState<RunMode>('dry')
  const alive = useRef(true)
  const lineId = useRef(0)
  /** bumped by reset() / a new run so an in-flight run stops touching state */
  const runToken = useRef(0)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const run = useCallback(async (runMode: RunMode = 'dry', customPayload?: Payload) => {
    const { nodes, edges } = getGraph()
    const token = ++runToken.current
    const live = () => alive.current && runToken.current === token
    const t0 = performance.now()
    const log = (tone: LogLine['tone'], text: string, kind?: string) => {
      if (live()) setLogs((l) => [...l, { id: ++lineId.current, at: Date.now(), tone, text, kind }])
    }
    setMode(runMode)
    setLogs([])
    setDone(null)
    setProgress(0)
    setVisual({ running: true, nodes: {}, edges: {} })

    const wf = useWorkflows.getState().workflows.find((w) => w.id === workflowId)
    const trigger = nodes.find((n) => n.type === 'trigger')
    const payload = customPayload ?? samplePayload({ name: wf?.name ?? '워크플로우', ownerId: wf?.ownerId ?? '' }, trigger)
    log(
      'accent',
      runMode === 'dry'
        ? `▶ 테스트 실행 시작 — 노드 ${nodes.length}개 · 샘플 데이터 · 실제 메시지/태스크는 만들지 않아요`
        : `▶ 실제 실행 시작 — 노드 ${nodes.length}개 · 실제로 메시지를 보내고 태스크/문서를 만들어요`,
    )
    await sleep(380)
    if (!live()) return
    if (!trigger) {
      log('error', '✕ 트리거 노드가 없어요. 팔레트에서 트리거를 추가하세요.')
      setVisual((v) => ({ ...v, running: false }))
      setProgress(100)
      setDone({ ok: false, ms: Math.round(performance.now() - t0), steps: 0 })
      toast('실행 실패', { variant: 'error', emoji: '⚠️', description: '트리거 노드가 없어요. 팔레트에서 트리거를 추가하세요.' })
      return
    }

    // rough total for the progress bar (the real path is decided while running)
    const estimate = Math.max(1, executionOrder(nodes, edges).order.length)
    let executed = 0
    const dry = runMode === 'dry'

    const result = await runWorkflow(
      { id: workflowId, name: wf?.name ?? '워크플로우', ownerId: wf?.ownerId ?? '', nodes, edges },
      {
        mode: runMode,
        payload,
        manual: true,
        trigger: `${dry ? '테스트 실행' : '수동 실행'} · ${getDef(trigger.data.kind).label}`,
        hooks: {
          // a dry run is a pure preview → closing the console cancels it; a live run keeps going in the background
          isCancelled: dry ? () => !live() : undefined,
          onEdge: async (e) => {
            if (!live()) return
            setVisual((v) => ({ ...v, edges: { ...v.edges, [e.id]: 'active' } }))
            await sleep(dry ? 380 : 260)
            if (live()) setVisual((v) => ({ ...v, edges: { ...v.edges, [e.id]: 'done' } }))
          },
          onNodeStart: async (node) => {
            if (!live()) return
            const def = getDef(node.data.kind)
            setVisual((v) => ({ ...v, nodes: { ...v.nodes, [node.id]: 'running' } }))
            log('info', `${def.category === 'trigger' ? '⚡' : def.category === 'condition' ? '◇' : def.category === 'delay' ? '⏱' : '▸'} ${node.data.title || def.label} 실행 중…`, node.data.kind)
            await sleep(dry ? 420 : 180)
          },
          onWait: (node, ms, until) => {
            log('warn', `  ⏳ ${waitLabel(ms)} 대기 중 — ${until.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 재개 · 이 브라우저가 열려 있는 동안 진행돼요 (로그를 닫아도 계속 실행)`)
            const amount = Number(node.data.config.amount ?? 1)
            if (live()) toast('지연 단계 대기 중', { emoji: '⏳', description: `${amount}${UNIT[String(node.data.config.unit)] ?? ''} 후 다음 단계를 실행해요` })
          },
          onNodeEnd: async (node, step, extra) => {
            if (!live()) return
            executed++
            setVisual((v) => ({ ...v, nodes: { ...v.nodes, [node.id]: step.status === 'failed' ? 'failed' : 'success' } }))
            if (extra.branch) {
              extra.trace?.forEach((t) => log('muted', `  · ${t}`))
              const label = extra.branch === 'true' ? '참' : '거짓'
              log('warn', `  ↳ 조건 평가 결과: ${label} → ${extra.branchHasEdge ? `"${label}" 분기로 진행` : `"${label}" 분기에 연결된 단계가 없어 종료`}`)
            } else if (step.status === 'failed') {
              log('error', `  ✕ ${step.message}`)
            } else {
              log('success', `  ✓ ${step.message}`)
            }
            setProgress(Math.min(95, Math.round((executed / estimate) * 100)))
            await sleep(dry ? 110 : 60)
          },
        },
      },
    )
    if (!live() || result.error === 'cancelled') return

    const notRun = [...result.skipped, ...result.unreachable]
    if (notRun.length) {
      setVisual((v) => ({ ...v, nodes: { ...v.nodes, ...Object.fromEntries(notRun.map((id) => [id, 'skipped' as const])) } }))
      const branchSkipped = result.skipped.length
      if (branchSkipped) log('muted', `  ⤼ ${result.ok ? '선택되지 않은 분기의' : '실행되지 않은'} 단계 ${branchSkipped}개 건너뜀`)
      if (result.unreachable.length) log('muted', `  ⤼ 트리거와 연결되지 않은 단계 ${result.unreachable.length}개 — 연결선을 확인하세요`)
    }
    const ms = result.durationMs
    const okSteps = result.steps.filter((s) => s.status === 'success').length
    if (result.ok) log('success', `✓ 실행 완료 — ${okSteps}단계 성공 · ${(ms / 1000).toFixed(2)}초${dry ? ' · 테스트라 실제 변경은 없어요' : ''}`)
    else log('error', `✕ 실행 실패 — ${result.error}`)
    setVisual((v) => ({ ...v, running: false }))
    setProgress(100)
    setDone({ ok: result.ok, ms, steps: okSteps })

    const name = wf?.name ?? '워크플로우'
    if (result.ok)
      toast(dry ? '테스트 실행 성공' : '실행 완료', { variant: 'success', emoji: '✅', description: `"${name}" · ${okSteps}단계 ${dry ? '모두 통과했어요' : '실제로 실행했어요'}` })
    else toast(dry ? '테스트 실행 실패' : '실행 실패', { variant: 'error', emoji: '⚠️', description: result.error })
  }, [getGraph, workflowId])

  const reset = useCallback(() => {
    runToken.current++ // stops UI updates (a dry run is cancelled; a live run continues in the background)
    setVisual(EMPTY_RUN)
    setDone(null)
    setProgress(0)
  }, [])

  return { visual, logs, progress, done, run, reset, mode }
}
