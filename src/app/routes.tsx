import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './Layout'

const Home = lazy(() => import('@/features/home'))
const Messenger = lazy(() => import('@/features/messenger'))
const Projects = lazy(() => import('@/features/projects'))
const Calendar = lazy(() => import('@/features/calendar'))
const Docs = lazy(() => import('@/features/docs'))
const Files = lazy(() => import('@/features/files'))
const Whiteboard = lazy(() => import('@/features/whiteboard'))
const Workflows = lazy(() => import('@/features/workflows'))
const Approvals = lazy(() => import('@/features/approvals'))
const Goals = lazy(() => import('@/features/goals'))
const Announcements = lazy(() => import('@/features/announcements'))
const People = lazy(() => import('@/features/people'))
const Settings = lazy(() => import('@/features/settings'))

/**
 * Every feature is mounted at `/<path>/*` — features may use nested <Routes> or useParams()['*'].
 * Convention: `?new=1` on a feature route should open that feature's "create" dialog.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'messages/*', element: <Messenger /> },
      { path: 'projects/*', element: <Projects /> },
      { path: 'calendar/*', element: <Calendar /> },
      { path: 'docs/*', element: <Docs /> },
      { path: 'files/*', element: <Files /> },
      { path: 'whiteboard/*', element: <Whiteboard /> },
      { path: 'workflows/*', element: <Workflows /> },
      { path: 'approvals/*', element: <Approvals /> },
      { path: 'goals/*', element: <Goals /> },
      { path: 'announcements/*', element: <Announcements /> },
      { path: 'people/*', element: <People /> },
      { path: 'settings/*', element: <Settings /> },
      { path: '*', element: <Home /> },
    ],
  },
])
