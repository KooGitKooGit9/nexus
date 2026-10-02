import './index.css'
import { initSync } from './lib/sync'

// Resolve the session (account → workspace → member) and pull workspace data BEFORE importing the app:
// persisted stores namespace their local cache by workspace+member at import time.
initSync()
  .catch((err) => console.error('[sync] init failed', err))
  .finally(async () => {
    const [{ StrictMode, createElement }, { createRoot }, { default: App }] = await Promise.all([
      import('react'),
      import('react-dom/client'),
      import('./App.tsx'),
    ])
    createRoot(document.getElementById('root')!).render(createElement(StrictMode, null, createElement(App)))
  })
