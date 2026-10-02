// Production static hosting of the Vite build (./dist) with SPA fallback.
import fs from 'node:fs'
import path from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
}

export function createStatic(distDir) {
  const root = path.resolve(distDir)
  const indexFile = path.join(root, 'index.html')

  function sendFile(req, res, file, cache) {
    const stat = fs.statSync(file)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': cache,
    })
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(file).pipe(res)
  }

  /** Returns true when handled. Only called for GET/HEAD outside /api and /ws. */
  return function serveStatic(req, res, pathname) {
    let rel
    try { rel = decodeURIComponent(pathname) } catch { rel = '/' }
    if (rel.includes('\0')) rel = '/'
    const file = path.resolve(root, '.' + path.posix.normalize('/' + rel))
    const inside = file === root || file.startsWith(root + path.sep)
    if (inside && file !== root && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const cache = rel.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : file === indexFile ? 'no-cache' : 'public, max-age=3600'
      sendFile(req, res, file, cache)
      return true
    }
    // Missing hashed asset → real 404 (don't serve index.html as JS)
    if (rel.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/i.test(rel)) return false
    if (!fs.existsSync(indexFile)) return false
    sendFile(req, res, indexFile, 'no-cache')
    return true
  }
}
