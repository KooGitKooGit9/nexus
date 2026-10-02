/**
 * Tiny shared flags for the workflow engine (kept dependency-free so stores can import it without cycles).
 *
 * - `engineActing`: >0 while the engine itself performs actions (creating tasks, sending messages…).
 *   Triggers observed during that time are ignored so workflows can't loop into each other.
 * - `remoteDepth`: >0 while a store change comes from another client (realtime sync). Event triggers
 *   fire only on the client that made the change ("acting client"), never on every receiver.
 */
export const flags = { engineActing: 0, remoteDepth: 0 }

export function asEngine<T>(fn: () => T): T {
  flags.engineActing++
  try {
    return fn()
  } finally {
    flags.engineActing--
  }
}
