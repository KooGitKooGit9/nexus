import { isServerMode } from './sync'
import { getSessionUserId } from './session'

export interface UploadedFile {
  /** server file id (absent in offline mode) */
  id?: string
  /** URL usable in <img src>, <a href> — `/api/files/<id>` on the server, a blob: URL offline */
  url: string
  name: string
  mime: string
  size: number
}

/**
 * Upload a file to the backend (persisted on disk, shared with everyone). Offline (no server),
 * falls back to a local object URL so the UI still works for the current session.
 */
export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<UploadedFile> {
  if (!isServerMode()) {
    onProgress?.(100)
    return { url: URL.createObjectURL(file), name: file.name, mime: file.type || 'application/octet-stream', size: file.size }
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name))
    xhr.setRequestHeader('X-User', getSessionUserId() ?? '')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
      else reject(new Error(`업로드 실패 (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('업로드 중 네트워크 오류'))
    xhr.send(file)
  })
}

/** URL that forces a download with the original file name (server files only). */
export const downloadUrl = (url: string) => (url.startsWith('/api/files/') ? `${url}?download=1` : url)
