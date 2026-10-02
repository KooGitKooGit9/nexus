import { lazy, Suspense } from 'react'
import { useSyncStatus } from './lib/sync'

// Public site (landing, pricing, auth, legal, invites) and onboarding are separate chunks.
const AppRouter = lazy(() => import('./app/AppRouter'))
const PublicApp = lazy(() => import('@/features/public').then((m) => ({ default: m.PublicApp })))
const Onboarding = lazy(() => import('@/features/public').then((m) => ({ default: m.Onboarding })))
const InviteAccept = lazy(() => import('@/features/public').then((m) => ({ default: m.InviteAccept })))

/** Pages that stay public even for signed-in visitors. */
const ALWAYS_PUBLIC = /^\/(pricing|legal)(\/|$)/

function Screen() {
  const needsLogin = useSyncStatus((s) => s.needsLogin)
  const needsWorkspace = useSyncStatus((s) => s.needsWorkspace)
  const path = location.pathname
  if (needsLogin || ALWAYS_PUBLIC.test(path)) return <PublicApp />
  if (path.startsWith('/invite/')) return <InviteAccept />
  if (needsWorkspace) return <Onboarding />
  return <AppRouter />
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-full bg-bg" />}>
      <Screen />
    </Suspense>
  )
}
