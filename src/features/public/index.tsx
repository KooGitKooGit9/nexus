/**
 * Public site for logged-out visitors + the two "between" screens (onboarding, invite).
 *
 * Exports (App.tsx lazy-imports these by name):
 *  - PublicApp    — own browser router: / · /pricing · /login · /signup · /forgot · /reset/:token · /invite/:token · /legal/terms · /legal/privacy · * → landing
 *  - Onboarding   — logged-in account without a workspace (router-independent)
 *  - InviteAccept — /invite/:token for logged-in or logged-out visitors (router-independent)
 */
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PublicLayout } from './PublicLayout'
import { Landing } from './pages/Landing'
import { PricingPage } from './pages/Pricing'
import { ForgotPage, LoginPage, ResetPage, SignupPage } from './pages/Auth'
import { TermsPage } from './legal/Terms'
import { PrivacyPage } from './legal/Privacy'
import { InviteAccept } from './InviteAccept'
import { Onboarding } from './Onboarding'

let router: ReturnType<typeof createBrowserRouter> | null = null
function getRouter() {
  router ??= createBrowserRouter([
    {
      element: <PublicLayout />,
      children: [
        { index: true, element: <Landing /> },
        { path: 'pricing', element: <PricingPage /> },
        { path: 'legal/terms', element: <TermsPage /> },
        { path: 'legal/privacy', element: <PrivacyPage /> },
        { path: '*', element: <Landing /> },
      ],
    },
    { path: '/login', element: <LoginPage /> },
    { path: '/signup', element: <SignupPage /> },
    { path: '/forgot', element: <ForgotPage /> },
    { path: '/reset/:token', element: <ResetPage /> },
    { path: '/invite/:token', element: <InviteAccept /> },
  ])
  return router
}

export function PublicApp() {
  return <RouterProvider router={getRouter()} />
}

export { Onboarding, InviteAccept }
