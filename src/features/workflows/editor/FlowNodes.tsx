import { memo, type CSSProperties, type ReactNode } from 'react'
import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_META, getDef } from '../catalog'
import type { FlowNode } from '../types'
import { NodeIcon } from '../components/bits'
import { useNodeRunState, type NodeRunState } from './runContext'

function StateBadge({ state }: { state: NodeRunState }) {
  return (
    <AnimatePresence mode="wait">
      {state === 'running' && (
        <motion.span key="run" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-info/20 text-info">
          <Loader2 className="h-3 w-3 animate-spin" />
        </motion.span>
      )}
      {state === 'success' && (
        <motion.span
          key="ok"
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white shadow-[0_0_14px_rgb(var(--success)/0.7)]"
        >
          <Check className="h-3 w-3" strokeWidth={3.5} />
        </motion.span>
      )}
      {state === 'failed' && (
        <motion.span key="fail" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white">
          <X className="h-3 w-3" strokeWidth={3.5} />
        </motion.span>
      )}
    </AnimatePresence>
  )
}

function Shell({ node, children, handles, className }: { node: NodeProps<FlowNode>; children?: ReactNode; handles: ReactNode; className?: string }) {
  const { data, selected, id, type } = node
  const def = getDef(data.kind)
  const cat = CATEGORY_META[type as keyof typeof CATEGORY_META] ?? CATEGORY_META.action
  const state = useNodeRunState(id)
  const style = { '--wf-c': `${def.color}aa` } as CSSProperties
  return (
    <div
      style={style}
      className={cn(
        'group relative w-[268px] rounded-[18px] transition-all duration-300',
        type === 'trigger' ? 'wf-trigger-border' : 'border border-line/10 bg-surface/80',
        'backdrop-blur-xl shadow-[0_12px_32px_-16px_rgb(0_0_0/0.6)]',
        selected && 'ring-2 ring-accent/70 ring-offset-2 ring-offset-bg',
        state === 'running' && 'wf-node-running',
        state === 'success' && 'border-success/50 shadow-[0_0_0_1px_rgb(var(--success)/0.45),0_0_28px_-6px_rgb(var(--success)/0.6)]',
        state === 'failed' && 'border-danger/60',
        state === 'skipped' && 'opacity-35 saturate-50',
        className,
      )}
    >
      {/* subtle top sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-b from-white/[0.06] to-transparent" />
      <div className="relative flex items-center justify-between px-3.5 pt-2.5">
        <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider', cat.text)}>
          <span>{cat.glyph}</span>
          {cat.label}
        </span>
        <StateBadge state={state} />
      </div>
      <div className="relative flex items-center gap-3 px-3.5 pb-3.5 pt-2">
        <NodeIcon kind={data.kind} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold text-fg">{data.title || def.label}</div>
          <div className="mt-0.5 truncate text-[11.5px] text-muted">{def.summary(data.config)}</div>
        </div>
      </div>
      {children}
      {handles}
    </div>
  )
}

const TriggerNode = memo((p: NodeProps<FlowNode>) => <Shell node={p} handles={<Handle type="source" position={Position.Bottom} />} />)

const ActionNode = memo((p: NodeProps<FlowNode>) => (
  <Shell node={p} handles={<><Handle type="target" position={Position.Top} /><Handle type="source" position={Position.Bottom} /></>} />
))

const DelayNode = memo((p: NodeProps<FlowNode>) => (
  <Shell node={p} className="border-dashed" handles={<><Handle type="target" position={Position.Top} /><Handle type="source" position={Position.Bottom} /></>} />
))

const ConditionNode = memo((p: NodeProps<FlowNode>) => (
  <Shell
    node={p}
    handles={
      <>
        <Handle type="target" position={Position.Top} />
        <Handle id="true" type="source" position={Position.Bottom} style={{ left: '28%', borderColor: 'rgb(var(--success))' }} />
        <Handle id="false" type="source" position={Position.Bottom} style={{ left: '72%', borderColor: 'rgb(var(--danger))' }} />
      </>
    }
  >
    <div className="relative flex border-t border-line/[0.07] text-[10.5px] font-semibold">
      <div className="flex flex-1 items-center justify-center gap-1 py-1.5 text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" />참</div>
      <div className="w-px bg-line/[0.07]" />
      <div className="flex flex-1 items-center justify-center gap-1 py-1.5 text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" />거짓</div>
    </div>
  </Shell>
))

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
}
