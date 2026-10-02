import { createContext, useContext } from 'react'

export type NodeRunState = 'idle' | 'running' | 'success' | 'failed' | 'skipped'
export type EdgeRunState = 'idle' | 'active' | 'done'

export interface RunVisualState {
  running: boolean
  nodes: Record<string, NodeRunState>
  edges: Record<string, EdgeRunState>
}

export const EMPTY_RUN: RunVisualState = { running: false, nodes: {}, edges: {} }

export const RunContext = createContext<RunVisualState>(EMPTY_RUN)

export const useNodeRunState = (id: string): NodeRunState => useContext(RunContext).nodes[id] ?? 'idle'
export const useEdgeRunState = (id: string): EdgeRunState => useContext(RunContext).edges[id] ?? 'idle'
export const useRunActive = () => useContext(RunContext).running
