import { RouterProvider } from 'react-router-dom'
import { router } from './routes'

/** The signed-in app (separate chunk so the public landing page stays light). */
export default function AppRouter() {
  return <RouterProvider router={router} />
}
