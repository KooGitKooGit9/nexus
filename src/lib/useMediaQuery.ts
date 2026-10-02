import { useSyncExternalStore } from 'react'

/** Reactive `window.matchMedia` hook. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Below this width the sidebar collapses into a rail and expands as an overlay. */
export const NARROW_QUERY = '(max-width: 1023.98px)'
export const useIsNarrow = () => useMediaQuery(NARROW_QUERY)
export const isNarrowViewport = () => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches
