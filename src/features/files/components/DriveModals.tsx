import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Folder, FolderPlus, HardDrive, Link2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Button, Checkbox, Input, Modal } from '@/components/ui'
import { toast, useCore } from '@/store/core'
import { notifyMembers } from '@/app/notifyMembers'
import { descendantsOf, useFiles } from '../store'
import { useDriveUI } from '../uiStore'
import { FOLDER_COLORS } from '../fileTypes'
import { copyFileLink } from '../hooks'
import type { FileItem } from '../types'
import { isHuman, joinMeta } from '@/features/people/format'

export function NewFolderModal({ parentId }: { parentId: string | null }) {
  const open = useDriveUI((s) => s.newFolderOpen)
  const setOpen = useDriveUI((s) => s.setNewFolderOpen)
  const [name, setName] = useState('')
  const [color, setColor] = useState(FOLDER_COLORS[0])
  const parent = useFiles((s) => s.files.find((f) => f.id === parentId))

  useEffect(() => { if (open) { setName(''); setColor(FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]) } }, [open])

  const create = () => {
    const f = useFiles.getState().createFolder(name || '새 폴더', parentId, color)
    setOpen(false)
    useDriveUI.getState().setSelected([f.id], f.id)
    toast('폴더를 만들었어요', { emoji: '📁', variant: 'success', description: f.name })
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      size="sm"
      title={<span className="flex items-center gap-2"><FolderPlus className="h-4 w-4 text-accent" /> 새 폴더</span>}
      description={`${parent ? parent.name : '내 드라이브'}에 만들어집니다`}
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
          <Button variant="primary" onClick={create}>만들기</Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors" style={{ background: `${color}2a`, boxShadow: `inset 0 0 0 1px ${color}55, 0 8px 24px -8px ${color}` }}>
          <Folder className="h-6 w-6" style={{ color }} fill={`${color}66`} />
        </div>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) create() }}
          placeholder="제목 없는 폴더"
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="mr-1 text-xs text-subtle">색상</span>
        {FOLDER_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={cn('flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-110', color === c && 'ring-2 ring-offset-2 ring-offset-surface')} style={{ background: c, ['--tw-ring-color' as string]: c }}>
            {color === c && <Check className="h-3 w-3 text-white" />}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function MoveModal() {
  const moveIds = useDriveUI((s) => s.moveIds)
  const setMoveIds = useDriveUI((s) => s.setMoveIds)
  const files = useFiles((s) => s.files)
  const [target, setTarget] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => { if (moveIds) { setTarget(null); setQ('') } }, [moveIds])

  const blocked = useMemo(() => new Set((moveIds ?? []).flatMap((id) => [id, ...descendantsOf(files, id)])), [moveIds, files])
  const folders = useMemo(() => {
    const out: { f: FileItem; depth: number }[] = []
    const walk = (pid: string | null, depth: number) =>
      files
        .filter((f) => f.kind === 'folder' && f.parentId === pid && !f.trashed && !blocked.has(f.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .forEach((f) => { out.push({ f, depth }); walk(f.id, depth + 1) })
    walk(null, 0)
    return out
  }, [files, blocked])
  const visible = q.trim() ? folders.filter(({ f }) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : folders
  const items = files.filter((f) => moveIds?.includes(f.id))

  const move = () => {
    if (!moveIds) return
    useFiles.getState().moveItems(moveIds, target)
    const dest = target ? files.find((f) => f.id === target)?.name : '내 드라이브'
    toast(items.length > 1 ? `${items.length}개 항목을 이동했어요` : `"${items[0]?.name}"을(를) 이동했어요`, { emoji: '📂', variant: 'success', description: `→ ${dest}` })
    setMoveIds(null)
    useDriveUI.getState().clearSelection()
  }

  return (
    <Modal
      open={!!moveIds}
      onClose={() => setMoveIds(null)}
      size="md"
      title="이동"
      description={items.length > 1 ? `${items.length}개 항목을 이동할 위치를 선택하세요` : `"${items[0]?.name ?? ''}"을(를) 이동할 위치를 선택하세요`}
      footer={
        <>
          <Button variant="ghost" onClick={() => setMoveIds(null)}>취소</Button>
          <Button variant="primary" onClick={move}>여기로 이동</Button>
        </>
      }
    >
      <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="폴더 검색" />
      <div className="mt-3 max-h-[340px] overflow-y-auto rounded-xl border border-line/10 p-1.5">
        <button onClick={() => setTarget(null)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition', target === null ? 'bg-accent/15 text-fg ring-1 ring-accent/30' : 'hover:bg-line/[0.05]')}>
          <HardDrive className="h-4 w-4 text-accent" /> 내 드라이브
          {target === null && <Check className="ml-auto h-4 w-4 text-accent" />}
        </button>
        {visible.map(({ f, depth }) => (
          <button
            key={f.id}
            onClick={() => setTarget(f.id)}
            className={cn('flex w-full items-center gap-2 rounded-lg py-2 pr-2.5 text-[13px] transition', target === f.id ? 'bg-accent/15 text-fg ring-1 ring-accent/30' : 'hover:bg-line/[0.05]')}
            style={{ paddingLeft: 10 + (q ? 0 : depth * 18) }}
          >
            {depth > 0 && !q && <ChevronRight className="h-3 w-3 text-subtle" />}
            <Folder className="h-4 w-4" style={{ color: f.color ?? '#8b5cf6' }} fill={`${f.color ?? '#8b5cf6'}55`} />
            <span className="truncate">{f.name}</span>
            {target === f.id && <Check className="ml-auto h-4 w-4 text-accent" />}
          </button>
        ))}
      </div>
    </Modal>
  )
}

export function ShareModal() {
  const shareId = useDriveUI((s) => s.shareId)
  const setShareId = useDriveUI((s) => s.setShareId)
  const item = useFiles((s) => s.files.find((f) => f.id === shareId))
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const [sel, setSel] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => { if (item) { setSel(item.sharedWith ?? []); setQ('') } }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = users.filter((u) => isHuman(u) && u.id !== item?.ownerId && (!q.trim() || u.name.includes(q.trim()) || u.department.includes(q.trim()) || u.nameEn.toLowerCase().includes(q.trim().toLowerCase())))
  const save = () => {
    if (!item) return
    useFiles.getState().shareItem(item.id, sel)
    const added = sel.filter((id) => !(item.sharedWith ?? []).includes(id))
    const meName = users.find((u) => u.id === me)?.name ?? '누군가'
    notifyMembers(added, {
      type: 'doc',
      title: `${meName}님이 ${item.kind === 'folder' ? '폴더' : '파일'}를 공유했습니다`,
      body: item.name,
      link: item.kind === 'folder' ? `/files/${item.id}` : `/files/${item.parentId ?? ''}?file=${item.id}`,
    })
    toast(added.length ? `${added.length}명에게 공유했어요` : '공유 설정을 저장했어요', { emoji: '🤝', variant: 'success', description: item.name })
    setShareId(null)
  }

  return (
    <Modal
      open={!!item}
      onClose={() => setShareId(null)}
      size="md"
      title={item ? `"${item.name}" 공유` : ''}
      description="함께 작업할 구성원을 선택하세요"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" leftIcon={<Link2 className="h-4 w-4" />} onClick={() => item && copyFileLink(item)}>링크 복사</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setShareId(null)}>취소</Button>
            <Button variant="primary" onClick={save}>저장</Button>
          </div>
        </div>
      }
    >
      {item && (
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-line/10 bg-line/[0.03] px-3 py-2">
          <Avatar userId={item.ownerId} size="sm" />
          <div className="flex-1 text-[13px]"><span className="font-medium">{users.find((u) => u.id === item.ownerId)?.name}</span>{item.ownerId === me && ' (나)'}</div>
          <span className="text-xs text-subtle">소유자</span>
        </div>
      )}
      <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 또는 부서 검색" />
      <div className="mt-3 max-h-[300px] space-y-0.5 overflow-y-auto">
        {list.map((u) => {
          const on = sel.includes(u.id)
          const toggle = () => setSel(on ? sel.filter((x) => x !== u.id) : [...sel, u.id])
          // a div (not <button>) because the Checkbox inside is itself a button
          return (
            <div
              key={u.id}
              role="button"
              tabIndex={0}
              onClick={toggle}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
              className={cn('flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent/40', on ? 'bg-accent/10' : 'hover:bg-line/[0.04]')}
            >
              <Avatar userId={u.id} size="sm" showPresence />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{u.name}{u.id === me && <span className="text-subtle"> (나)</span>}</div>
                <div className="truncate text-[11px] text-subtle">{joinMeta(u.department, u.title) || u.email}</div>
              </div>
              <Checkbox checked={on} onChange={toggle} />
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

export function DeleteForeverModal() {
  const ids = useDriveUI((s) => s.deleteIds)
  const setIds = useDriveUI((s) => s.setDeleteIds)
  const files = useFiles((s) => s.files)
  const items = files.filter((f) => ids?.includes(f.id))

  const confirm = () => {
    if (!ids) return
    useFiles.getState().deleteForever(ids)
    toast(items.length > 1 ? `${items.length}개 항목을 영구 삭제했어요` : '영구 삭제했어요', { emoji: '🔥', description: items.length === 1 ? items[0].name : undefined })
    setIds(null)
    useDriveUI.getState().clearSelection()
  }

  return (
    <Modal
      open={!!ids && items.length > 0}
      onClose={() => setIds(null)}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setIds(null)}>취소</Button>
          <Button variant="danger" onClick={confirm}>영구 삭제</Button>
        </>
      }
    >
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-2xl bg-danger/40 blur-xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/15 text-danger ring-1 ring-danger/30">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>
        <h3 className="text-lg font-semibold">{items.length > 1 ? `${items.length}개 항목을 영구 삭제할까요?` : '영구 삭제할까요?'}</h3>
        <p className="mt-2 text-sm text-muted">
          {items.length === 1 && <><span className="font-medium text-fg">{items[0].name}</span><br /></>}
          영구 삭제된 항목은 복구할 수 없어요.
        </p>
      </div>
    </Modal>
  )
}
