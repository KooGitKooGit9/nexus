import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, FolderSearch, FolderOpen, Search, Star, Trash2, Upload, Users } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { useCore } from '@/store/core'
import { isFileStarred, useFiles } from './store'
import { useDriveUI } from './uiStore'
import { kindOf } from './fileTypes'
import { uploadFiles, useItemActions } from './hooks'
import type { DriveSection, FileItem } from './types'
import { DriveNav } from './components/DriveNav'
import { DriveHeader } from './components/DriveHeader'
import { FileCard, FolderCard, type ItemHandlers } from './components/ItemCards'
import { ListView } from './components/ListView'
import { ContextMenu, DropOverlay, SelectionBar, UploadToasts } from './components/Overlays'
import { PreviewModal } from './components/PreviewModal'
import { DeleteForeverModal, MoveModal, NewFolderModal, ShareModal } from './components/DriveModals'

const SPECIAL: DriveSection[] = ['shared', 'recent', 'starred', 'trash']
/** Below this page width the drive nav turns into an overlay. */
const COMPACT_BELOW = 960

export default function FilesPage() {
  const navigate = useNavigate()
  const seg = useParams()['*']?.split('/')[0] ?? ''
  const section: DriveSection = (SPECIAL as string[]).includes(seg) ? (seg as DriveSection) : 'my'
  const folderId = section === 'my' && seg ? seg : null
  const [params, setParams] = useSearchParams()

  const files = useFiles((s) => s.files)
  const view = useFiles((s) => s.view)
  const sortKey = useFiles((s) => s.sortKey)
  const sortDir = useFiles((s) => s.sortDir)
  const me = useCore((s) => s.currentUserId)
  const users = useCore((s) => s.users)
  const selected = useDriveUI((s) => s.selected)
  const renamingId = useDriveUI((s) => s.renamingId)
  const query = useDriveUI((s) => s.query)
  const typeFilter = useDriveUI((s) => s.typeFilter)
  const contextMenu = useDriveUI((s) => s.contextMenu)
  const compact = useDriveUI((s) => s.compact)
  const navOpen = useDriveUI((s) => s.navOpen)
  const rootRef = useRef<HTMLDivElement>(null)

  // Narrow pane → the nav floats over the content instead of squeezing the grid
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const narrow = el.clientWidth < COMPACT_BELOW
      if (narrow !== useDriveUI.getState().compact) useDriveUI.getState().setCompact(narrow)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { open, menuItems, trash, restore } = useItemActions()

  const folder = folderId ? files.find((f) => f.id === folderId && f.kind === 'folder') : undefined
  const folderMissing = !!folderId && (!folder || folder.trashed)
  const uploadTarget = section === 'my' && folder && !folder.trashed ? folder.id : null
  const searching = !!query.trim()

  /* ── derived listing ── */
  const { items, counts } = useMemo(() => {
    const byId = new Map(files.map((f) => [f.id, f]))
    const hiddenByAncestor = (f: FileItem) => {
      let p = f.parentId ? byId.get(f.parentId) : undefined
      let guard = 0
      while (p && guard++ < 50) {
        if (p.trashed) return true
        p = p.parentId ? byId.get(p.parentId) : undefined
      }
      return false
    }
    const live = files.filter((f) => !f.trashed && !hiddenByAncestor(f))
    const counts = new Map<string, number>()
    live.forEach((f) => { if (f.parentId) counts.set(f.parentId, (counts.get(f.parentId) ?? 0) + 1) })

    let list: FileItem[]
    const q = query.trim().toLowerCase()
    if (q) list = (section === 'trash' ? files.filter((f) => f.trashed) : live).filter((f) => f.name.toLowerCase().includes(q))
    else if (section === 'shared') list = live.filter((f) => f.ownerId !== me && f.sharedWith?.includes(me))
    else if (section === 'recent') list = live.filter((f) => f.kind === 'file')
    else if (section === 'starred') list = live.filter((f) => isFileStarred(f))
    else if (section === 'trash') list = files.filter((f) => f.trashed)
    else list = live.filter((f) => f.parentId === folderId)

    if (typeFilter !== 'all' && section !== 'trash') list = list.filter((f) => f.kind === 'file' && kindOf(f) === typeFilter)

    const ownerName = (id: string) => users.find((u) => u.id === id)?.name ?? ''
    const recentTime = (f: FileItem) => Math.max(+new Date(f.updatedAt), f.lastOpenedAt ? +new Date(f.lastOpenedAt) : 0)
    const dir = sortDir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
      if (section === 'recent' && sortKey === 'updatedAt') return (recentTime(a) - recentTime(b)) * dir
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name, 'ko') * dir
        case 'size': return ((a.size ?? 0) - (b.size ?? 0)) * dir
        case 'owner': return ownerName(a.ownerId).localeCompare(ownerName(b.ownerId), 'ko') * dir
        default: return (+new Date(a.updatedAt) - +new Date(b.updatedAt)) * dir
      }
    })
    if (section === 'recent' && !q) list = list.slice(0, 30)
    return { items: list, counts }
  }, [files, query, section, folderId, typeFilter, sortKey, sortDir, me, users])

  const folders = items.filter((f) => f.kind === 'folder')
  const fileItems = items.filter((f) => f.kind === 'file')
  const ordered = useMemo(() => [...items.filter((f) => f.kind === 'folder'), ...items.filter((f) => f.kind === 'file')].map((f) => f.id), [items])

  /* ── reset on navigation ── */
  useEffect(() => {
    useDriveUI.getState().clearSelection()
    useDriveUI.getState().setQuery('')
    useDriveUI.getState().closeContextMenu()
    useDriveUI.getState().setNavOpen(false)
  }, [seg])
  // the type filter is per-section (it hides folders, so carrying it over would strand the user)
  useEffect(() => { useDriveUI.getState().setTypeFilter('all') }, [section])

  /* ── query params: ?file=<id> opens preview, ?new=1 opens new-folder dialog ── */
  useEffect(() => {
    const fileId = params.get('file')
    const isNew = params.get('new') === '1'
    if (!fileId && !isNew) return
    if (fileId) {
      const f = useFiles.getState().files.find((x) => x.id === fileId)
      if (f?.kind === 'folder') {
        // navigating to the folder path already drops the query string; a setParams() afterwards would
        // resolve against the old location and undo the navigation
        navigate(`/files/${f.id}`, { replace: true })
        return
      }
      if (f) {
        useDriveUI.getState().setSelected([f.id], f.id)
        useFiles.getState().markOpened(f.id)
        useDriveUI.getState().setPreviewId(f.id)
        // open the file's own folder so ←/→ in the preview walks its siblings
        const parent = f.parentId ? useFiles.getState().files.find((x) => x.id === f.parentId) : undefined
        const parentLive = !f.parentId || (parent && !parent.trashed)
        if (!f.trashed && parentLive && section === 'my' && (f.parentId ?? null) !== folderId) {
          navigate(`/files/${f.parentId ?? ''}`, { replace: true })
          return
        }
      }
    }
    if (isNew) useDriveUI.getState().setNewFolderOpen(true)
    const next = new URLSearchParams(params)
    next.delete('file')
    next.delete('new')
    setParams(next, { replace: true })
  }, [params, setParams, navigate, section, folderId])

  /* ── selection ── */
  const h: ItemHandlers = {
    onClick: (e: MouseEvent, item) => {
      e.stopPropagation()
      const ui = useDriveUI.getState()
      if (e.metaKey || e.ctrlKey) {
        ui.setSelected(ui.selected.includes(item.id) ? ui.selected.filter((x) => x !== item.id) : [...ui.selected, item.id], item.id)
      } else if (e.shiftKey && ui.anchor && ordered.includes(ui.anchor)) {
        const a = ordered.indexOf(ui.anchor)
        const b = ordered.indexOf(item.id)
        ui.setSelected(ordered.slice(Math.min(a, b), Math.max(a, b) + 1))
      } else {
        ui.setSelected([item.id], item.id)
      }
    },
    onOpen: open,
    onContext: (e: MouseEvent, item) => {
      e.preventDefault()
      e.stopPropagation()
      const ui = useDriveUI.getState()
      if (!ui.selected.includes(item.id)) ui.setSelected([item.id], item.id)
      ui.openContextMenu(e.clientX, e.clientY, item.id)
    },
    menuItems,
  }

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      const ui = useDriveUI.getState()
      if (e.key === 'Escape' && ui.navOpen) { ui.setNavOpen(false); return }
      if (ui.previewId || ui.moveIds || ui.shareId || ui.deleteIds || ui.newFolderOpen || ui.renamingId) return
      if (document.querySelector('[role="dialog"]')) return
      const sel = useFiles.getState().files.filter((f) => ui.selected.includes(f.id))
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); ui.setSelected(ordered); return }
      if (e.key === 'Escape') { ui.clearSelection(); return }
      if (!sel.length) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (section === 'trash') ui.setDeleteIds(sel.map((f) => f.id))
        else trash(sel)
      } else if (e.key === 'Enter' && sel.length === 1) {
        open(sel[0])
      } else if (e.key === 'F2' && sel.length === 1 && section !== 'trash') {
        e.preventDefault()
        ui.setRenamingId(sel[0].id)
      } else if (e.key === ' ' && sel.length === 1 && sel[0].kind === 'file') {
        e.preventDefault()
        open(sel[0])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ordered, section, open, trash])

  /* ── drag & drop upload ── */
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files')
  const dropTargetName = section === 'my' && folder ? folder.name : '내 드라이브'

  const cmItem = contextMenu ? files.find((f) => f.id === contextMenu.id) : undefined

  const empty = (() => {
    if (searching) return <EmptyState icon={<Search />} title={`“${query}” 검색 결과가 없어요`} description="다른 키워드로 검색해보세요." />
    switch (section) {
      case 'shared': return <EmptyState icon={<Users />} title="공유받은 파일이 없어요" description="팀원이 파일을 공유하면 여기에 표시됩니다." />
      case 'recent': return <EmptyState icon={<Clock />} title="최근 항목이 없어요" />
      case 'starred': return <EmptyState icon={<Star />} title="중요 문서함이 비어 있어요" description="자주 쓰는 파일에 별표를 눌러 빠르게 찾아보세요." />
      case 'trash': return <EmptyState icon={<Trash2 />} title="휴지통이 비어 있어요" description="삭제한 항목은 30일 동안 이곳에 보관됩니다." />
      default:
        return (
          <EmptyState
            icon={<FolderOpen />}
            title={typeFilter !== 'all' ? '이 유형의 파일이 없어요' : '이 폴더가 비어 있어요'}
            description="파일을 이곳으로 끌어다 놓거나 업로드 버튼을 눌러 추가하세요."
            action={<Button variant="primary" leftIcon={<Upload className="h-4 w-4" />} onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()}>파일 업로드</Button>}
          />
        )
    }
  })()

  return (
    <div
      ref={rootRef}
      className="relative flex h-full"
      onDragEnter={(e) => { if (!hasFiles(e) || section === 'trash') return; e.preventDefault(); dragDepth.current++; setDragging(true) }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        // always cancel so a drop never makes the browser navigate to the file; the trash just refuses it
        e.preventDefault()
        if (section === 'trash') e.dataTransfer.dropEffect = 'none'
      }}
      onDragLeave={(e) => { if (!hasFiles(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false) }}
      onDrop={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (section !== 'trash') uploadFiles(e.dataTransfer.files, uploadTarget)
      }}
    >
      <DriveNav section={section} uploadTarget={uploadTarget} />
      <AnimatePresence>
        {compact && navOpen && (
          <motion.div
            key="drive-nav-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => useDriveUI.getState().setNavOpen(false)}
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          />
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <DriveHeader section={section} folderId={folder ? folder.id : null} uploadTarget={uploadTarget} />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28 pt-5" onClick={() => useDriveUI.getState().clearSelection()}>
          {folderMissing ? (
            <EmptyState
              icon={<FolderSearch />}
              title="폴더를 찾을 수 없어요"
              description="삭제되었거나 휴지통으로 이동된 폴더입니다."
              action={<Button variant="primary" onClick={() => navigate('/files')}>내 드라이브로</Button>}
            />
          ) : items.length === 0 ? (
            empty
          ) : view === 'list' ? (
            <ListView items={items} selected={selected} renamingId={renamingId} counts={counts} h={h} showLocation={searching || section !== 'my'} />
          ) : (
            <div className="space-y-7">
              {searching && <div className="text-[13px] text-muted">“{query}” 검색 결과 <span className="font-semibold text-fg">{items.length}</span>개</div>}
              {folders.length > 0 && (
                <section>
                  <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-subtle">폴더 <span className="ml-1 font-normal">{folders.length}</span></h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                    {folders.map((f, i) => (
                      <FolderCard key={f.id} item={f} index={i} count={counts.get(f.id) ?? 0} selected={selected.includes(f.id)} renaming={renamingId === f.id} h={h} />
                    ))}
                  </div>
                </section>
              )}
              {fileItems.length > 0 && (
                <section>
                  <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-subtle">파일 <span className="ml-1 font-normal">{fileItems.length}</span></h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {fileItems.map((f, i) => (
                      <FileCard key={f.id} item={f} index={i} selected={selected.includes(f.id)} renaming={renamingId === f.id} h={h} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <SelectionBar
          inTrash={section === 'trash'}
          onTrash={() => trash(files.filter((f) => selected.includes(f.id)))}
          onRestore={() => restore(files.filter((f) => selected.includes(f.id)))}
        />
      </div>

      <DropOverlay show={dragging} target={dropTargetName} />
      <ContextMenu items={cmItem ? menuItems(cmItem) : []} />
      <PreviewModal siblings={items} />
      <NewFolderModal parentId={uploadTarget} />
      <MoveModal />
      <ShareModal />
      <DeleteForeverModal />
      <UploadToasts />
    </div>
  )
}
