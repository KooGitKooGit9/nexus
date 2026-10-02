import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import { persisted, syncAcrossTabs } from '@/lib/persist'
import { uid } from '@/lib/utils'
import { getCurrentUserId } from '@/store/core'
import { seedWorkflows } from './seed'
import { BLANK_TEMPLATE, TEMPLATES } from './templates'
import type { FlowNode, Workflow, WorkflowRun } from './types'

interface WorkflowsState {
  workflows: Workflow[]

  createFromTemplate: (templateId: string) => string
  updateWorkflow: (id: string, patch: Partial<Omit<Workflow, 'id'>>) => void
  saveGraph: (id: string, nodes: FlowNode[], edges: Edge[]) => void
  toggleEnabled: (id: string, enabled?: boolean) => void
  duplicateWorkflow: (id: string) => string | null
  deleteWorkflow: (id: string) => void
  /** Prepends a run (optionally with a pre-made id) and returns its id. */
  addRun: (id: string, run: Omit<WorkflowRun, 'id'> & { id?: string }) => string
  updateRun: (id: string, runId: string, patch: Partial<WorkflowRun>) => void
}

/** Strip transient React Flow props (selected, measured, dragging…) before persisting. */
function cleanNodes(nodes: FlowNode[]): FlowNode[] {
  return nodes.map(({ id, type, position, data }) => ({ id, type, position: { x: Math.round(position.x), y: Math.round(position.y) }, data }))
}
function cleanEdges(edges: Edge[]): Edge[] {
  return edges.map(({ id, source, target, sourceHandle, targetHandle, type, data }) => ({ id, source, target, sourceHandle, targetHandle, type, data }))
}

export const useWorkflows = create<WorkflowsState>()(
  persisted<WorkflowsState>(
    'workflows',
    (set, get) => ({
      workflows: seedWorkflows(),

      createFromTemplate: (templateId) => {
        const tpl = TEMPLATES.find((t) => t.id === templateId) ?? BLANK_TEMPLATE
        const { nodes, edges } = tpl.build()
        const now = new Date().toISOString()
        const id = uid('wf')
        const existing = get().workflows.filter((w) => w.name.startsWith(tpl.name)).length
        const wf: Workflow = {
          id,
          name: existing ? `${tpl.name} ${existing + 1}` : tpl.name,
          description: tpl.id === BLANK_TEMPLATE.id ? '' : tpl.description,
          emoji: tpl.emoji,
          enabled: false,
          ownerId: getCurrentUserId(),
          nodes,
          edges,
          runs: [],
          createdAt: now,
          updatedAt: now,
          templateId: tpl.id,
        }
        set((s) => ({ workflows: [wf, ...s.workflows] }))
        return id
      },

      updateWorkflow: (id, patch) =>
        set((s) => ({ workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)) })),

      saveGraph: (id, nodes, edges) => get().updateWorkflow(id, { nodes: cleanNodes(nodes), edges: cleanEdges(edges) }),

      toggleEnabled: (id, enabled) =>
        set((s) => ({ workflows: s.workflows.map((w) => (w.id === id ? { ...w, enabled: enabled ?? !w.enabled } : w)) })),

      duplicateWorkflow: (id) => {
        const src = get().workflows.find((w) => w.id === id)
        if (!src) return null
        const now = new Date().toISOString()
        const copy: Workflow = { ...JSON.parse(JSON.stringify(src)), id: uid('wf'), name: `${src.name} (사본)`, enabled: false, runs: [], createdAt: now, updatedAt: now, ownerId: getCurrentUserId() }
        set((s) => ({ workflows: [copy, ...s.workflows] }))
        return copy.id
      },

      deleteWorkflow: (id) => set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) })),

      addRun: (id, run) => {
        const runId = run.id ?? uid('run')
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, runs: [{ ...run, id: runId }, ...w.runs].slice(0, 120) } : w)),
        }))
        return runId
      },
      updateRun: (id, runId, patch) =>
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, runs: w.runs.map((r) => (r.id === runId ? { ...r, ...patch } : r)) } : w)),
        })),
    }),
    {
      version: 2,
      // v1 was the empty skeleton → reseed
      migrate: () => ({ workflows: seedWorkflows() }) as unknown as WorkflowsState,
    },
  ),
)
syncAcrossTabs(useWorkflows)

/* ───────────── Derived helpers ───────────── */

export const WEEK_MS = 7 * 86400_000

export function runsSince(w: Workflow, ms: number) {
  const since = Date.now() - ms
  return w.runs.filter((r) => new Date(r.startedAt).getTime() >= since)
}

/** Count runs per day for the last `days` days (oldest → newest). */
export function dailyRunCounts(w: Workflow, days = 14): { total: number; failed: number }[] {
  const out = Array.from({ length: days }, () => ({ total: 0, failed: 0 }))
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const startMs = start.getTime() - (days - 1) * 86400_000
  for (const r of w.runs) {
    const t = new Date(r.startedAt).getTime()
    if (t < startMs) continue
    const idx = Math.floor((t - startMs) / 86400_000)
    if (idx >= 0 && idx < days) {
      out[idx].total++
      if (r.status === 'failed') out[idx].failed++
    }
  }
  return out
}
