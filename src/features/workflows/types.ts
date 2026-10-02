import type { Node, Edge } from '@xyflow/react'

export interface WorkflowRunStep {
  nodeId: string
  label: string
  status: 'success' | 'failed' | 'skipped'
  /** ms offset from run start */
  at: number
  message?: string
}

export interface WorkflowRun {
  id: string
  startedAt: string
  durationMs: number
  status: 'success' | 'failed' | 'running'
  trigger: string
  /** optional per-step log (test runs / seeded runs) */
  steps?: WorkflowRunStep[]
  /** true when started by hand from the editor ("테스트 실행" / "지금 실행") */
  manual?: boolean
  /** 'dry' = sandbox test with sample data (no side effects), 'live' = real side effects. Absent on seeded demo history. */
  mode?: 'dry' | 'live'
  /** who's browser executed it */
  actorId?: string
  /** dedupe key for scheduled / calendar triggers (one run per occurrence across all clients) */
  key?: string
  /** while waiting in a Delay step: when it resumes (ISO) */
  waitUntil?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  emoji: string
  enabled: boolean
  ownerId: string
  nodes: Node[]
  edges: Edge[]
  runs: WorkflowRun[]
  createdAt: string
  updatedAt: string
  /** template id this workflow was created from */
  templateId?: string
}

/* ───────────── Node model (stored in Node.data) ───────────── */

export type NodeCategory = 'trigger' | 'condition' | 'action' | 'delay'

export interface ConditionRule {
  id: string
  field: string
  op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists'
  value: string
}

/** Shape of `node.data` for every workflow node. React Flow requires an index signature. */
export interface FlowNodeData extends Record<string, unknown> {
  /** catalog key, e.g. "message_received", "send_message" */
  kind: string
  /** optional custom title (falls back to catalog label) */
  title?: string
  config: Record<string, unknown>
}

export type FlowNode = Node<FlowNodeData, NodeCategory>
