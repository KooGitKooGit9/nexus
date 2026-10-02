import type { Edge } from '@xyflow/react'
import { getDef } from './catalog'
import type { FlowNode, FlowNodeData, NodeCategory } from './types'

export const X_GAP = 340
export const Y_GAP = 150

/** Build a node at grid coordinates (col, row). col 0 = center, -1/+1 = branches. */
export function gnode(id: string, kind: string, col: number, row: number, config: Record<string, unknown> = {}, title?: string): FlowNode {
  const def = getDef(kind)
  const data: FlowNodeData = { kind, config: { ...structuredCloneSafe(def.defaults), ...config } }
  if (title) data.title = title
  return { id, type: def.category, position: { x: col * X_GAP, y: row * Y_GAP }, data }
}

export function gedge(source: string, target: string, sourceHandle?: 'true' | 'false'): Edge {
  return {
    id: `e_${source}_${target}${sourceHandle ? '_' + sourceHandle : ''}`,
    source,
    target,
    sourceHandle: sourceHandle ?? null,
    type: 'flow',
    data: sourceHandle ? { branch: sourceHandle } : {},
  }
}

export function structuredCloneSafe<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

export function newNode(kind: string, position: { x: number; y: number }, id: string): FlowNode {
  const def = getDef(kind)
  return { id, type: def.category as NodeCategory, position, data: { kind, config: structuredCloneSafe(def.defaults) } }
}

/** Ordered execution path from the trigger. Condition nodes follow `branchPick` (default: true). */
export function executionOrder(nodes: FlowNode[], edges: Edge[], branchPick: (nodeId: string) => 'true' | 'false' = () => 'true') {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const start = nodes.find((n) => n.type === 'trigger') ?? nodes[0]
  const order: { node: FlowNode; viaEdge?: Edge; branch?: 'true' | 'false' }[] = []
  if (!start) return { order, skipped: [] as string[], unreachable: [] as string[] }
  const visited = new Set<string>()
  const queue: { id: string; via?: Edge }[] = [{ id: start.id }]
  while (queue.length) {
    const { id, via } = queue.shift()!
    if (visited.has(id)) continue
    const node = byId.get(id)
    if (!node) continue
    visited.add(id)
    let outs = edges.filter((e) => e.source === id)
    let branch: 'true' | 'false' | undefined
    if (node.type === 'condition') {
      branch = branchPick(id)
      // only follow the picked branch — if it has no edge, the flow simply ends here
      outs = outs.filter((e) => (e.sourceHandle ?? 'true') === branch)
    }
    order.push({ node, viaEdge: via, branch })
    outs.forEach((e) => queue.push({ id: e.target, via: e }))
  }
  // nodes reachable from the trigger at all (any branch) vs. not connected
  const reach = new Set<string>([start.id])
  const stack = [start.id]
  while (stack.length) {
    const id = stack.pop()!
    edges.filter((e) => e.source === id).forEach((e) => { if (!reach.has(e.target)) { reach.add(e.target); stack.push(e.target) } })
  }
  const notRun = nodes.filter((n) => !visited.has(n.id))
  const skipped = notRun.filter((n) => reach.has(n.id)).map((n) => n.id)
  const unreachable = notRun.filter((n) => !reach.has(n.id)).map((n) => n.id)
  return { order, skipped, unreachable }
}

/** Main path kinds — used for mini previews. */
export function previewKinds(nodes: FlowNode[], edges: Edge[], max = 6): string[] {
  return executionOrder(nodes, edges).order.slice(0, max).map((o) => o.node.data.kind)
}
