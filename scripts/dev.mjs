// Starts the API server (with --watch) and Vite together. Ctrl+C stops both.
import { spawn } from 'node:child_process'

const procs = [
  spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit', env: { ...process.env, PORT: undefined } }),
  spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], { stdio: 'inherit' }),
]
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const p of procs) p.on('exit', (code) => { if (code && code !== 0) stop() })
