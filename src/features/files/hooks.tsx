import { useNavigate } from 'react-router-dom'
import { Download, Eye, FolderInput, FolderOpen, Link2, Pencil, RotateCcw, Star, StarOff, Trash2, UserPlus, X } from 'lucide-react'
import { formatBytes, uid } from '@/lib/utils'
import { getUser, toast } from '@/store/core'
import { uploadFile, downloadUrl } from '@/lib/upload'
import type { MenuItem } from '@/components/ui'
import { descendantsOf, useFiles } from './store'
import { useDriveUI, type UploadJob } from './uiStore'
import { KIND_META, baseName, kindOf } from './fileTypes'
import type { FileItem } from './types'

/* ───────────── upload ───────────── */

async function makeThumbnail(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || file.size > 40 * 1024 * 1024) return undefined
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 420 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.78)
  } catch {
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}

const TEXT_PREVIEW_LIMIT = 6000

async function readTextPreview(file: File): Promise<string | undefined> {
  const kind = kindOf({ kind: 'file', name: file.name, mime: file.type })
  if (kind !== 'text' && kind !== 'code') return undefined
  try {
    const text = await file.slice(0, TEXT_PREVIEW_LIMIT).text()
    return text.replace(/\r\n?/g, '\n')
  } catch {
    return undefined
  }
}

/**
 * Real <input type=file> / drop upload: the bytes go to the server (`/api/upload`, shared with
 * everyone; offline → a local object URL) with real progress in the upload panel. A small
 * thumbnail / text excerpt is stored alongside for fast grid rendering.
 */
export function uploadFiles(list: FileList | File[], parentId: string | null) {
  const files = Array.from(list)
  if (!files.length) return
  let remaining = files.length
  let ok = 0
  const finish = () => {
    remaining--
    if (remaining > 0) return
    if (ok) toast(ok > 1 ? `${ok}개 파일 업로드 완료` : '업로드 완료', { emoji: '☁️', variant: 'success', description: ok > 1 ? undefined : files[0].name })
  }
  files.forEach((file) => {
    const job: UploadJob = { id: uid('up'), name: file.name, size: file.size, progress: 0, kind: kindOf({ kind: 'file', name: file.name, mime: file.type }), done: false }
    useDriveUI.getState().upsertUpload(job)
    const extras = Promise.all([makeThumbnail(file), readTextPreview(file)])
    const still = () => useDriveUI.getState().uploads.some((u) => u.id === job.id)
    uploadFile(file, (pct) => { useDriveUI.getState().updateUpload({ ...job, progress: Math.min(99, pct) }) })
      .then(async (res) => {
        const [thumbnail, textPreview] = await extras
        // the upload panel was cleared mid-flight → treat as cancelled
        if (!still()) { if (res.url.startsWith('blob:')) URL.revokeObjectURL(res.url); finish(); return }
        useFiles.getState().addFile({
          name: file.name,
          parentId,
          mime: res.mime || file.type || undefined,
          size: res.size ?? file.size,
          url: res.url,
          thumbnail,
          textPreview,
          lastOpenedAt: new Date().toISOString(),
        })
        useDriveUI.getState().updateUpload({ ...job, progress: 100, done: true })
        ok++
        finish()
        setTimeout(() => useDriveUI.getState().removeUpload(job.id), 4500)
      })
      .catch((e: unknown) => {
        useDriveUI.getState().updateUpload({ ...job, error: e instanceof Error ? e.message : '업로드 실패' })
        toast('업로드에 실패했어요', { variant: 'error', description: file.name })
        finish()
      })
  })
}

/* ───────────── download / link ───────────── */

/** Uploaded (real) file — has bytes on the server (or a local object URL offline). */
export const isRealFile = (f: FileItem) => f.kind === 'file' && !!f.url

function clickDownload(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Seed (mock) files have no bytes — produce a small generated placeholder so "download" still does something honest. */
async function samplePlaceholder(item: FileItem): Promise<{ blob: Blob; name: string }> {
  const kind = kindOf(item)
  if (kind === 'image') {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 800
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 1200, 800)
      g.addColorStop(0, '#8b5cf6')
      g.addColorStop(0.5, '#22d3ee')
      g.addColorStop(1, '#f472b6')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 1200, 800)
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.font = 'bold 56px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(item.name, 600, 390, 1100)
      ctx.font = '28px sans-serif'
      ctx.fillText('Nexus 샘플 파일 · 실제 내용이 없는 데모 이미지입니다', 600, 450, 1100)
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (blob) return { blob, name: `${baseName(item.name)}.png` }
  }
  const owner = getUser(item.ownerId)?.name ?? ''
  const lines = [
    `Nexus 샘플 파일`,
    ``,
    `이 파일("${item.name}")은 데모용 시드 데이터라 실제 내용이 없습니다.`,
    `직접 업로드한 파일은 원본 그대로 다운로드됩니다.`,
    ``,
    `유형: ${KIND_META[kind].label}`,
    item.size ? `표시 크기: ${formatBytes(item.size)}` : '',
    owner ? `소유자: ${owner}` : '',
    `생성: ${new Date(item.createdAt).toLocaleString('ko-KR')}`,
  ].filter((l, i) => l || i === 1 || i === 4)
  return { blob: new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }), name: `${baseName(item.name)} (샘플).txt` }
}

async function downloadOne(item: FileItem) {
  if (item.url) {
    clickDownload(downloadUrl(item.url), item.name)
    return
  }
  const { blob, name } = await samplePlaceholder(item)
  const href = URL.createObjectURL(blob)
  clickDownload(href, name)
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
}

/** Downloads files (folders expand to their live descendant files), one browser download per file. */
export function downloadItems(items: FileItem[]) {
  const all = useFiles.getState().files
  const targets: FileItem[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const list = it.kind === 'folder' ? descendantsOf(all, it.id).map((id) => all.find((f) => f.id === id)!).filter((f) => f && f.kind === 'file' && !f.trashed) : [it]
    for (const f of list) if (!seen.has(f.id)) { seen.add(f.id); targets.push(f) }
  }
  if (!targets.length) {
    toast('다운로드할 파일이 없어요', { emoji: '📭', description: items.length === 1 ? `"${items[0].name}" 폴더가 비어 있어요` : undefined })
    return
  }
  const capped = targets.slice(0, 20)
  capped.forEach((f, i) => setTimeout(() => { void downloadOne(f) }, i * 350))
  const samples = capped.filter((f) => !f.url).length
  toast(capped.length > 1 ? `${capped.length}개 파일 다운로드를 시작했어요` : '다운로드를 시작했어요', {
    emoji: '⬇️',
    variant: 'success',
    description:
      capped.length === 1
        ? `${capped[0].name}${samples ? ' · 샘플 파일이라 안내 파일로 받아요' : capped[0].size ? ` · ${formatBytes(capped[0].size)}` : ''}`
        : [targets.length > capped.length ? `최대 ${capped.length}개까지 받아요` : '', samples ? `샘플 ${samples}개는 안내 파일로 받아요` : ''].filter(Boolean).join(' · ') || undefined,
  })
}

export function copyFileLink(item: FileItem) {
  const url = item.kind === 'folder' ? `${location.origin}/files/${item.id}` : `${location.origin}/files/${item.parentId ?? ''}?file=${item.id}`
  navigator.clipboard?.writeText(url)
  toast('링크를 복사했어요', { emoji: '🔗', variant: 'success' })
}

/* ───────────── item actions ───────────── */

export function useItemActions() {
  const navigate = useNavigate()

  const open = (item: FileItem) => {
    if (item.trashed) {
      toast('휴지통에 있는 항목은 열 수 없어요', { emoji: '🗑️', description: '먼저 복원해주세요.' })
      return
    }
    if (item.kind === 'folder') {
      useDriveUI.getState().clearSelection()
      navigate(`/files/${item.id}`)
    } else {
      useFiles.getState().markOpened(item.id)
      useDriveUI.getState().setPreviewId(item.id)
    }
  }

  /** Items affected by an action on `item`: the whole selection if it contains the item. */
  const targetsFor = (item: FileItem) => {
    const { selected } = useDriveUI.getState()
    const ids = selected.includes(item.id) && selected.length > 1 ? selected : [item.id]
    return useFiles.getState().files.filter((f) => ids.includes(f.id))
  }

  const trash = (items: FileItem[]) => {
    useFiles.getState().trashItems(items.map((i) => i.id))
    useDriveUI.getState().clearSelection()
    const ids = items.map((i) => i.id)
    toast(items.length > 1 ? `${items.length}개 항목을 휴지통으로 이동했어요` : `"${items[0].name}"을(를) 휴지통으로 이동했어요`, {
      emoji: '🗑️',
      description: '휴지통에서 30일 동안 보관됩니다.',
    })
    return ids
  }

  const restore = (items: FileItem[]) => {
    useFiles.getState().restoreItems(items.map((i) => i.id))
    useDriveUI.getState().clearSelection()
    toast(items.length > 1 ? `${items.length}개 항목을 복원했어요` : `"${items[0].name}"을(를) 복원했어요`, { emoji: '♻️', variant: 'success' })
  }

  const menuItems = (item: FileItem): MenuItem[] => {
    const targets = targetsFor(item)
    const multi = targets.length > 1
    const ui = useDriveUI.getState()
    if (item.trashed) {
      return [
        { label: multi ? `${targets.length}개 항목 복원` : '복원', icon: <RotateCcw />, onClick: () => restore(targets) },
        { label: '', divider: true },
        { label: multi ? `${targets.length}개 항목 영구 삭제` : '영구 삭제', icon: <X />, danger: true, onClick: () => ui.setDeleteIds(targets.map((t) => t.id)) },
      ]
    }
    const allStarred = targets.every((t) => t.starred)
    return [
      { label: '열기', icon: item.kind === 'folder' ? <FolderOpen /> : <Eye />, shortcut: '↵', disabled: multi, onClick: () => open(item) },
      { label: '이름 바꾸기', icon: <Pencil />, shortcut: 'F2', disabled: multi, onClick: () => ui.setRenamingId(item.id) },
      { label: '이동', icon: <FolderInput />, onClick: () => ui.setMoveIds(targets.map((t) => t.id)) },
      { label: '공유', icon: <UserPlus />, disabled: multi, onClick: () => ui.setShareId(item.id) },
      { label: allStarred ? '중요 표시 해제' : '중요 문서함에 추가', icon: allStarred ? <StarOff /> : <Star />, onClick: () => useFiles.getState().toggleStar(targets.map((t) => t.id)) },
      { label: '링크 복사', icon: <Link2 />, disabled: multi, onClick: () => copyFileLink(item) },
      { label: '다운로드', icon: <Download />, onClick: () => downloadItems(targets) },
      { label: '', divider: true },
      { label: multi ? `${targets.length}개 항목 휴지통으로` : '휴지통으로 이동', icon: <Trash2 />, danger: true, shortcut: '⌫', onClick: () => trash(targets) },
    ]
  }

  return { open, menuItems, trash, restore, targetsFor }
}
