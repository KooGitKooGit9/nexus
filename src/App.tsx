import { RouterProvider } from 'react-router-dom'
import { router } from './app/routes'
import { useSyncStatus } from './lib/sync'
import { Login } from './app/Login'

export default function App() {
  const needsLogin = useSyncStatus((s) => s.needsLogin)
  if (needsLogin) return <Login />
  return <RouterProvider router={router} />
}
