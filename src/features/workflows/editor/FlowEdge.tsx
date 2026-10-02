import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type Edge, type EdgeProps, type EdgeTypes } from '@xyflow/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEdgeRunState } from './runContext'

type FlowEdgeData = { branch?: 'true' | 'false' }

const FlowEdge = memo(function FlowEdge(props: EdgeProps<Edge<FlowEdgeData>>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data, markerEnd } = props
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 18, offset: 24 })
  const state = useEdgeRunState(id)
  const { deleteElements } = useReactFlow()
  const gid = `wf-grad-${id}`
  const branch = data?.branch
  const from = branch === 'true' ? 'rgb(var(--success))' : branch === 'false' ? 'rgb(var(--danger))' : 'rgb(var(--accent))'
  const to = branch ? from : 'rgb(var(--accent-2))'

  return (
    <>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY + 0.01}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {/* track */}
      <BaseEdge id={id} path={path} style={{ stroke: 'rgb(var(--line) / 0.12)', strokeWidth: selected ? 4 : 3 }} />
      {/* flowing dashes */}
      <path
        d={path}
        fill="none"
        stroke={state === 'done' ? 'rgb(var(--success))' : `url(#${gid})`}
        strokeWidth={state === 'active' ? 3 : 2}
        strokeLinecap="round"
        markerEnd={markerEnd}
        className={cn('pointer-events-none transition-[stroke-width]', state === 'active' ? 'wf-edge-fast' : 'wf-edge-flow')}
        style={{ filter: state !== 'idle' || selected ? `drop-shadow(0 0 6px ${state === 'done' ? 'rgb(var(--success) / 0.8)' : 'rgb(var(--accent) / 0.8)'})` : undefined, opacity: state === 'idle' ? 0.85 : 1 }}
      />
      {state === 'active' && (
        <circle r={5} fill="rgb(var(--accent-2))" style={{ filter: 'drop-shadow(0 0 6px rgb(var(--accent-2)))' }}>
          <animateMotion dur="0.55s" repeatCount="indefinite" path={path} />
        </circle>
      )}
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="nodrag nopan absolute flex h-6 w-6 items-center justify-center rounded-full border border-line/15 bg-surface text-muted shadow-float transition hover:bg-danger hover:text-white"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            onClick={() => deleteElements({ edges: [{ id }] })}
            title="연결 삭제"
          >
            <X className="h-3 w-3" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

export const edgeTypes: EdgeTypes = { flow: FlowEdge }
