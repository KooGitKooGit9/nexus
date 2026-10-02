import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, addEdge, useEdgesState, useNodesState, useReactFlow,
  ConnectionLineType, type Connection, type Edge, type EdgeChange, type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import '../workflows.css'
import { motion } from 'framer-motion'
import { ArrowLeft, Play, Save, Workflow as WorkflowIcon, History, PenTool, Loader2, Check, Plus, PanelRight, AlertTriangle, Zap, FlaskConical } from 'lucide-react'
import { cn, uid } from '@/lib/utils'
import { Button, EmptyState, Kbd, Modal, Popover, Switch, Tabs, Tooltip } from '@/components/ui'
import { toast } from '@/store/core'
import { COMMON_VARIABLES, describeCron, getDef, NODE_DEFS } from '../catalog'
import { newNode } from '../graph'
import { useWorkflows } from '../store'
import type { FlowNode, FlowNodeData, Workflow } from '../types'
import { nodeTypes } from '../editor/FlowNodes'
import { edgeTypes } from '../editor/FlowEdge'
import { Palette, DND_MIME } from '../editor/Palette'
import { Inspector } from '../editor/Inspector'
import { RunConsole } from '../editor/RunConsole'
import { RunHistory } from '../editor/RunHistory'
import { RunContext } from '../editor/runContext'
import { useTestRun } from '../editor/useTestRun'
import { ManualRunModal } from '../editor/ManualRunModal'
import type { Payload } from '../engine'

const EMOJIS = ['⚡', '🚀', '🔔', '⏰', '📊', '🎫', '🚨', '☕', '🤖', '📬', '🧾', '🗂️', '💬', '🎯', '🌙', '✨', '🛠️', '📣']

export function WorkflowEditor({ id }: { id: string }) {
  const wf = useWorkflows((s) => s.workflows.find((w) => w.id === id))
  if (!wf)
    return (
      <EmptyState
        className="h-full"
        icon={<WorkflowIcon />}
        title="워크플로우를 찾을 수 없어요"
        description="삭제되었거나 주소가 잘못되었을 수 있어요."
        action={<Link to="/workflows"><Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />}>자동화 목록으로</Button></Link>}
      />
    )
  return (
    <ReactFlowProvider>
      <EditorInner key={wf.id} wf={wf} />
    </ReactFlowProvider>
  )
}

function EditorInner({ wf }: { wf: Workflow }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { screenToFlowPosition, fitView } = useReactFlow<FlowNode, Edge>()
  const saveGraph = useWorkflows((s) => s.saveGraph)
  const updateWorkflow = useWorkflows((s) => s.updateWorkflow)
  const toggleEnabled = useWorkflows((s) => s.toggleEnabled)

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>(wf.nodes as FlowNode[])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(wf.edges)
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<'editor' | 'history'>('editor')
  const [name, setName] = useState(wf.name)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)

  /* ───── responsive: side panels become overlays when the editor is narrow ───── */
  const [width, setWidth] = useState(1400)
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    setWidth(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  const compact = width < 1100
  const tight = width < 760
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const graphRef = useRef({ nodes, edges })
  useLayoutEffect(() => {
    graphRef.current = { nodes, edges }
  }, [nodes, edges])
  const getGraph = useCallback(() => graphRef.current, [])
  const test = useTestRun(wf.id, getGraph)

  /* ───── change tracking ───── */
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    onNodesChangeBase(changes)
    if (changes.some((c) => c.type === 'position' || c.type === 'remove' || c.type === 'add' || c.type === 'replace')) setDirty(true)
  }, [onNodesChangeBase])
  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    onEdgesChangeBase(changes)
    if (changes.some((c) => c.type === 'remove' || c.type === 'add')) setDirty(true)
  }, [onEdgesChangeBase])

  const onConnect = useCallback((c: Connection) => {
    setEdges((eds) => addEdge({ ...c, id: uid('e'), type: 'flow', data: c.sourceHandle === 'true' || c.sourceHandle === 'false' ? { branch: c.sourceHandle } : {} }, eds))
    setDirty(true)
  }, [setEdges])

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (c.source === c.target) return false
    return !graphRef.current.edges.some((e) => e.source === c.source && e.target === c.target && (e.sourceHandle ?? null) === (c.sourceHandle ?? null))
  }, [])

  /* ───── add / drop ───── */
  const addAt = useCallback((kind: string, pos: { x: number; y: number }) => {
    const n = newNode(kind, pos, uid('n'))
    n.selected = true
    setNodes((ns) => [...ns.map((x) => (x.selected ? { ...x, selected: false } : x)), n])
    setDirty(true)
    const def = getDef(kind)
    setPaletteOpen(false)
    toast(`${def.label} 노드 추가`, { emoji: def.category === 'trigger' ? '⚡' : def.category === 'condition' ? '◇' : def.category === 'delay' ? '⏱' : '▶', duration: 1800 })
  }, [setNodes])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    const kind = e.dataTransfer.getData(DND_MIME)
    if (!kind || !NODE_DEFS.some((d) => d.kind === kind)) return
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    addAt(kind, { x: p.x - 134, y: p.y - 36 })
  }, [screenToFlowPosition, addAt])

  const addCenter = useCallback((kind: string) => {
    const r = wrapper.current?.getBoundingClientRect()
    const p = r ? screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 0, y: 0 }
    addAt(kind, { x: p.x - 134 + (Math.random() * 40 - 20), y: p.y - 36 + (Math.random() * 40 - 20) })
  }, [screenToFlowPosition, addAt])

  /* ───── inspector ops ───── */
  const selected = nodes.find((n) => n.selected) ?? null
  const typeCounts = useMemo(() => nodes.reduce<Record<string, number>>((m, n) => ((m[n.type ?? 'action'] = (m[n.type ?? 'action'] ?? 0) + 1), m), {}), [nodes])
  const closeInspector = useCallback(() => {
    setInfoOpen(false)
    setNodes((ns) => (ns.some((n) => n.selected) ? ns.map((n) => (n.selected ? { ...n, selected: false } : n)) : ns))
  }, [setNodes])
  const changeData = useCallback((id: string, patch: Partial<FlowNodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
    setDirty(true)
  }, [setNodes])
  const deleteNode = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    setDirty(true)
  }, [setNodes, setEdges])
  const duplicateNode = useCallback((id: string) => {
    const src = graphRef.current.nodes.find((n) => n.id === id)
    if (!src) return
    const copy: FlowNode = { ...src, id: uid('n'), selected: true, position: { x: src.position.x + 40, y: src.position.y + 40 }, data: JSON.parse(JSON.stringify(src.data)) }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), copy])
    setDirty(true)
  }, [setNodes])

  const variables = useMemo(() => {
    const out = new Set<string>()
    nodes.forEach((n) => getDef(n.data.kind).outputs?.forEach((o) => out.add(o)))
    COMMON_VARIABLES.forEach((v) => out.add(v))
    return [...out]
  }, [nodes])

  /* ───── top bar actions ───── */
  const save = useCallback(() => {
    const g = graphRef.current
    saveGraph(wf.id, g.nodes, g.edges)
    if (name.trim() && name !== wf.name) updateWorkflow(wf.id, { name: name.trim() })
    setDirty(false)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1600)
    toast('워크플로우를 저장했어요', { variant: 'success', emoji: '💾', description: `${g.nodes.length}개 노드 · ${g.edges.length}개 연결` })
  }, [saveGraph, updateWorkflow, wf.id, wf.name, name])

  const startTest = useCallback(() => {
    if (test.visual.running) return
    setTab('editor')
    setConsoleOpen(true)
    fitView({ padding: 0.25, duration: 500 })
    void test.run('dry')
  }, [test, fitView])

  const startLive = useCallback((payload: Payload) => {
    if (test.visual.running) return
    setTab('editor')
    setConsoleOpen(true)
    fitView({ padding: 0.25, duration: 500 })
    void test.run('live', payload)
  }, [test, fitView])

  const onToggle = (v: boolean) => {
    toggleEnabled(wf.id, v)
    const trig = nodes.find((n) => n.type === 'trigger')
    toast(v ? '워크플로우 활성화' : '워크플로우 비활성화', {
      variant: v ? 'success' : 'default',
      emoji: v ? '⚡' : '⏸️',
      description: v ? (trig?.data.kind === 'schedule' ? `다음 실행: ${describeCron(String(trig.data.config.cron ?? ''))}` : '이제 트리거 이벤트에 자동으로 반응해요') : '자동 실행이 중지되었어요',
    })
  }

  // ⌘S save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        startTest()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, startTest])

  // ?run=1 → auto test run
  const autoRan = useRef(false)
  useEffect(() => {
    if (params.get('run') === '1' && !autoRan.current) {
      autoRan.current = true
      const next = new URLSearchParams(params)
      next.delete('run')
      setParams(next, { replace: true })
      setTimeout(startTest, 600)
    }
  }, [params, setParams, startTest])

  const commitName = () => {
    const n = name.trim()
    if (!n) return setName(wf.name)
    if (n !== wf.name) updateWorkflow(wf.id, { name: n })
  }

  /* ───── leaving with unsaved changes ───── */
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Esc closes the compact-mode overlays (palette first, then inspector)
  const hasSelection = !!selected
  useEffect(() => {
    if (!compact || !(paletteOpen || infoOpen || hasSelection)) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing || blocker.state === 'blocked') return
      if (paletteOpen) setPaletteOpen(false)
      else closeInspector()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compact, paletteOpen, infoOpen, hasSelection, closeInspector, blocker.state])

  return (
    <div ref={root} className="flex h-full flex-col">
      {/* ───── Top bar ───── */}
      <div className={cn('glass-strong relative z-10 flex h-14 shrink-0 items-center border-b border-line/10 px-3', tight ? 'gap-1.5' : 'gap-3')}>
        <Tooltip content="자동화 목록" side="bottom">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/workflows')}><ArrowLeft className="h-4 w-4" /></Button>
        </Tooltip>
        <Popover
          trigger={({ toggle }) => (
            <button onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-xl bg-line/[0.06] text-xl transition hover:scale-105 hover:bg-line/10">{wf.emoji}</button>
          )}
        >
          {(close) => (
            <div className="grid grid-cols-6 gap-1 p-1">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => { updateWorkflow(wf.id, { emoji: e }); close() }} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition hover:scale-110 hover:bg-line/10">{e}</button>
              ))}
            </div>
          )}
        </Popover>
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full max-w-[320px] truncate rounded-lg bg-transparent px-1.5 py-0.5 text-[15px] font-semibold text-fg outline-none transition hover:bg-line/[0.05] focus:bg-line/[0.06] focus:ring-2 focus:ring-accent/30"
          />
          <div className="flex items-center gap-1.5 px-1.5 text-[11px] text-subtle">
            {dirty ? (
              <span className="flex items-center gap-1 truncate text-warning"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{tight ? '저장 안 됨' : '저장되지 않은 변경사항'}</span>
            ) : justSaved ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 text-success"><Check className="h-3 w-3" />저장됨</motion.span>
            ) : (
              <span className="truncate">{nodes.length}개 노드 · {edges.length}개 연결</span>
            )}
          </div>
        </div>

        <div className={cn('absolute left-1/2 -translate-x-1/2', compact && 'hidden')}>
          <Tabs
            size="sm"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'editor', label: '에디터', icon: <PenTool /> },
              { value: 'history', label: '실행 기록', icon: <History />, count: wf.runs.length },
            ]}
          />
        </div>

        <div className={cn('ml-auto flex shrink-0 items-center', tight ? 'gap-1' : 'gap-2')}>
          {compact && (
            <Tabs
              size="sm"
              value={tab}
              onChange={setTab}
              items={tight ? [{ value: 'editor', label: '', icon: <PenTool /> }, { value: 'history', label: '', icon: <History /> }] : [{ value: 'editor', label: '에디터' }, { value: 'history', label: '기록' }]}
            />
          )}
          <Tooltip content={wf.enabled ? '자동 실행 중 · 끄려면 클릭' : '꺼져 있음 · 켜면 자동 실행'} side="bottom">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl px-1.5 py-1 text-xs font-medium text-muted">
              {!tight && <span className={cn(wf.enabled && 'text-success')}>{wf.enabled ? '활성' : '비활성'}</span>}
              <Switch checked={wf.enabled} onChange={onToggle} size="sm" />
            </label>
          </Tooltip>
          <Tooltip content={<span className="flex items-center gap-1">저장 <Kbd>⌘S</Kbd></span>} side="bottom">
            <Button variant={dirty ? 'outline' : 'secondary'} size={tight ? 'icon-sm' : 'sm'} leftIcon={tight ? undefined : <Save className="h-3.5 w-3.5" />} onClick={save} className={cn(dirty && 'border-accent/50 text-accent')} aria-label="저장">
              {tight ? <Save className="h-3.5 w-3.5" /> : '저장'}
            </Button>
          </Tooltip>
          <Tooltip content="실제로 실행 (확인 후 메시지 전송 · 태스크 생성 등)" side="bottom">
            <Button
              variant="outline"
              size={tight ? 'icon-sm' : 'sm'}
              onClick={() => setManualOpen(true)}
              disabled={test.visual.running}
              leftIcon={tight ? undefined : <Zap className="h-3.5 w-3.5" />}
              aria-label="지금 실행"
            >
              {tight ? <Zap className="h-3.5 w-3.5" /> : '지금 실행'}
            </Button>
          </Tooltip>
          <Tooltip content={<span className="flex items-center gap-1">테스트 실행 (샘플 데이터 · 부작용 없음) <Kbd>⌘↵</Kbd></span>} side="bottom">
            <Button
              variant="primary"
              size="sm"
              onClick={startTest}
              disabled={test.visual.running}
              leftIcon={test.visual.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              className="relative overflow-hidden"
            >
              {test.visual.running ? (tight ? '실행 중' : '실행 중…') : tight ? '실행' : '테스트 실행'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* ───── Body ───── */}
      {tab === 'history' ? (
        <div className="min-h-0 flex-1"><RunHistory workflow={wf} /></div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {!compact && <Palette onAdd={addCenter} />}
          <div ref={wrapper} className="relative min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
            <RunContext.Provider value={test.visual}>
              <ReactFlow<FlowNode, Edge>
                className="nexus-flow"
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                isValidConnection={isValidConnection}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'flow' }}
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionLineStyle={{ stroke: 'rgb(var(--accent))', strokeWidth: 2, strokeDasharray: '6 6' }}
                nodesDraggable={!test.visual.running}
                fitView
                fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
                minZoom={0.25}
                maxZoom={1.75}
                deleteKeyCode={['Backspace', 'Delete']}
                attributionPosition="bottom-center"
              >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
                <Controls position="bottom-left" showInteractive={false} className="!mb-4 !ml-4" />
                <MiniMap
                  position="bottom-right"
                  pannable
                  zoomable
                  className="!mb-4 !mr-4"
                  nodeBorderRadius={14}
                  nodeColor={(n) => getDef((n.data as FlowNodeData).kind).color}
                  style={{ width: 168, height: 110 }}
                />
              </ReactFlow>
            </RunContext.Provider>
            {/* compact mode: floating toggles for the side panels */}
            {compact && !paletteOpen && (
              <Button variant="secondary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPaletteOpen(true)} className="absolute left-3 top-3 z-20 shadow-float">
                노드 추가
              </Button>
            )}
            {compact && !selected && !infoOpen && (
              <Tooltip content="워크플로우 정보" side="left">
                <Button variant="secondary" size="icon-sm" onClick={() => setInfoOpen(true)} className="absolute right-3 top-3 z-20 shadow-float" aria-label="워크플로우 정보">
                  <PanelRight className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
            {compact && paletteOpen && <Palette overlay onAdd={addCenter} onClose={() => setPaletteOpen(false)} className={cn(consoleOpen && '!bottom-[244px]')} />}
            {compact && (selected || infoOpen) && (
              <Inspector
                overlay
                onClose={closeInspector}
                className={cn(consoleOpen && '!bottom-[244px]')}
                node={selected}
                workflow={wf}
                variables={variables}
                onChangeData={changeData}
                onDelete={deleteNode}
                onDuplicate={duplicateNode}
                onUpdateWorkflow={(p) => updateWorkflow(wf.id, p)}
                nodeTypesCount={typeCounts}
              />
            )}
            {/* ambient glow while running */}
            <div className={cn('pointer-events-none absolute inset-0 transition-opacity duration-700', test.visual.running ? 'opacity-100' : 'opacity-0')} style={{ background: 'radial-gradient(60% 50% at 50% 40%, rgb(var(--accent) / 0.08), transparent 70%)' }} />
            <RunConsole
              open={consoleOpen}
              logs={test.logs}
              running={test.visual.running}
              progress={test.progress}
              done={test.done}
              onClose={() => { setConsoleOpen(false); test.reset() }}
              onRerun={startTest}
              mode={test.mode}
            />
          </div>
          {!compact && (
            <Inspector
              node={selected}
              workflow={wf}
              variables={variables}
              onChangeData={changeData}
              onDelete={deleteNode}
              onDuplicate={duplicateNode}
              onUpdateWorkflow={(p) => updateWorkflow(wf.id, p)}
              nodeTypesCount={typeCounts}
            />
          )}
        </div>
      )}

      <ManualRunModal open={manualOpen} onClose={() => setManualOpen(false)} workflow={wf} nodes={nodes} onRun={startLive} />

      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        size="sm"
        title={<span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" />저장되지 않은 변경사항</span>}
        description="이 워크플로우에 저장하지 않은 변경사항이 있어요. 나가기 전에 저장할까요?"
        footer={
          <>
            <Button variant="ghost" onClick={() => blocker.reset?.()}>계속 편집</Button>
            <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10" onClick={() => { setDirty(false); blocker.proceed?.() }}>저장하지 않고 나가기</Button>
            <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} onClick={() => { save(); blocker.proceed?.() }}>저장 후 나가기</Button>
          </>
        }
      />
    </div>
  )
}
