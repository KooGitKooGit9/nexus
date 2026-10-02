import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, CornerDownRight, Search, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Input, Modal } from '@/components/ui'
import { toast } from '@/store/core'
import { descendantIds, useDocs } from '../store'
import { useDocsUI } from '../uiStore'
import { useChildrenMap } from '../hooks'
import type { Doc } from '../types'

export function DeleteDocModal() {
  const navigate = useNavigate()
  const activeId = useParams()['*']?.split('/')[0]
  const deleteId = useDocsUI((s) => s.deleteId)
  const setDeleteId = useDocsUI((s) => s.setDeleteId)
  const docs = useDocs((s) => s.docs)
  const deleteDoc = useDocs((s) => s.deleteDoc)
  const doc = docs.find((d) => d.id === deleteId)
  const descendants = useMemo(() => (deleteId ? descendantIds(docs, deleteId) : []), [docs, deleteId])

  const confirm = () => {
    if (!doc) return
    const affected = new Set([doc.id, ...descendants])
    deleteDoc(doc.id)
    setDeleteId(null)
    toast('페이지를 삭제했어요', { emoji: '🗑️', description: doc.title || '제목 없음' })
    if (activeId && affected.has(activeId)) navigate(doc.parentId ? `/docs/${doc.parentId}` : '/docs')
  }

  return (
    <Modal
      open={!!doc}
      onClose={() => setDeleteId(null)}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setDeleteId(null)}>취소</Button>
          <Button variant="danger" onClick={confirm}>영구 삭제</Button>
        </>
      }
    >
      {doc && (
        <div className="flex flex-col items-center pt-2 text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-2xl bg-danger/40 blur-xl" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/15 text-danger ring-1 ring-danger/30">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">페이지를 삭제할까요?</h3>
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-fg">{doc.emoji} {doc.title || '제목 없음'}</span>
            {descendants.length > 0 ? <>와(과) 하위 페이지 <b className="text-danger">{descendants.length}개</b>가</> : ' 페이지가'} 영구적으로 삭제됩니다.
            <br />이 작업은 되돌릴 수 없어요.
          </p>
        </div>
      )}
    </Modal>
  )
}

export function MoveDocModal() {
  const moveId = useDocsUI((s) => s.moveId)
  const setMoveId = useDocsUI((s) => s.setMoveId)
  const docs = useDocs((s) => s.docs)
  const moveDoc = useDocs((s) => s.moveDoc)
  const childrenMap = useChildrenMap(docs)
  const [q, setQ] = useState('')
  const doc = docs.find((d) => d.id === moveId)
  const blocked = useMemo(() => new Set(moveId ? [moveId, ...descendantIds(docs, moveId)] : []), [docs, moveId])

  const flat = useMemo(() => {
    const out: { doc: Doc; depth: number }[] = []
    const walk = (pid: string | null, depth: number) => {
      ;(childrenMap.get(pid) ?? []).forEach((d) => {
        if (blocked.has(d.id)) return
        out.push({ doc: d, depth })
        walk(d.id, depth + 1)
      })
    }
    walk(null, 0)
    return out
  }, [childrenMap, blocked])

  const visible = q.trim() ? flat.filter((f) => (f.doc.title || '제목 없음').toLowerCase().includes(q.trim().toLowerCase())) : flat

  const go = (parentId: string | null) => {
    if (!doc) return
    moveDoc(doc.id, parentId)
    setMoveId(null)
    setQ('')
    const target = parentId ? docs.find((d) => d.id === parentId) : null
    toast('페이지를 옮겼어요', { emoji: '📂', variant: 'success', description: `${doc.title || '제목 없음'} → ${target ? target.title : '워크스페이스 최상위'}` })
  }

  return (
    <Modal open={!!doc} onClose={() => { setMoveId(null); setQ('') }} title="페이지 옮기기" description={doc ? `${doc.emoji} ${doc.title || '제목 없음'} 을(를) 어디로 옮길까요?` : undefined} size="md">
      <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="페이지 검색…" autoFocus />
      <div className="mt-3 max-h-[380px] overflow-y-auto rounded-xl border border-line/10 p-1.5">
        <button
          onClick={() => go(null)}
          disabled={doc?.parentId === null}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-accent/10 disabled:opacity-40"
        >
          <Layers className="h-4 w-4 text-accent" /> 워크스페이스 최상위
          {doc?.parentId === null && <span className="ml-auto text-[11px] text-subtle">현재 위치</span>}
        </button>
        {visible.map(({ doc: d, depth }) => (
          <button
            key={d.id}
            onClick={() => go(d.id)}
            disabled={doc?.parentId === d.id}
            className={cn('flex w-full items-center gap-2 rounded-lg py-1.5 pr-2.5 text-left text-[13px] transition hover:bg-accent/10 disabled:opacity-40')}
            style={{ paddingLeft: 10 + (q ? 0 : depth * 16) }}
          >
            {depth > 0 && !q && <CornerDownRight className="h-3 w-3 text-subtle" />}
            <span>{d.emoji || '📄'}</span>
            <span className="truncate">{d.title || '제목 없음'}</span>
            {doc?.parentId === d.id && <span className="ml-auto text-[11px] text-subtle">현재 위치</span>}
          </button>
        ))}
      </div>
    </Modal>
  )
}
