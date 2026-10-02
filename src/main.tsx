import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSync } from './lib/sync'

// Detect the backend, log in / pull shared workspace data, then render.
initSync()
  .catch((err) => console.error('[sync] init failed', err))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
