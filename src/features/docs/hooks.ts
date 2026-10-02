import { useEffect, useMemo, useState } from 'react'
import { emitSyncEvent, onSyncEvent, useSyncStatus } from '@/lib/sync'
import { useNavigate } from 'react-router-dom'
import { toast, useCore, useUI } from '@/store/core'
import { hashIndex, pick } from '@/lib/utils'
import { useDocs } from './store'
import { useDocsUI } from './uiStore'
import type { DocTemplate } from './templates'
import type { Doc } from './types'
import { COVERS, PRESENCE_RINGS } from './constants'
import { plainText } from './markdown'

/** Returns a function that creates a page (optionally from a template) and opens it. */
export function useCreateDoc() {
  const navigate = useNavigate()
  return (opts: { parentId?: string | null; template?: DocTemplate } = {}) => {
    const { template, parentId = null } = opts
    const doc = useDocs.getState().createDoc({
      parentId,
      title: template ? template.title : '',
      emoji: template ? template.emoji : '📄',
      cover: template ? template.cover : pick(COVERS).css,
      content: template ? template.content() : '',
    })
    useDocsUI.getState().closeTemplates()
    navigate(`/docs/${doc.id}`)
    if (template) toast(`"${template.title}" 템플릿으로 페이지를 만들었어요`, { emoji: template.emoji, variant: 'success' })
    return doc
  }
}

/** Map parentId → children (array order). Use with the full `docs` array. */
export function useChildrenMap(docs: Doc[]) {
  return useMemo(() => {
    const map = new Map<string | null, Doc[]>()
    docs.forEach((d) => {
      const list = map.get(d.parentId) ?? []
      list.push(d)
      map.set(d.parentId, list)
    })
    return map
  }, [docs])
}

/**
 * Who else has this doc open. With the sync server: real members (ephemeral `doc-view` heartbeats),
 * `live: true`. Offline demo: deterministic simulated co-editors.
 */
export function useCoEditors(docId: string): { id: string; name: string; color: string; live?: boolean }[] {
  const users = useCore((s) => s.users)
  const me = useCore((s) => s.currentUserId)
  const serverMode = useSyncStatus((s) => s.mode === 'server')
  const online = useSyncStatus((s) => s.online)
  const [viewers, setViewers] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!serverMode) return
    setViewers({})
    const beat = () => { if (!document.hidden) emitSyncEvent('doc-view', { docId }) }
    beat()
    const iv = setInterval(beat, 5_000)
    const off = onSyncEvent('doc-view', (msg) => {
      const from = String(msg.from ?? '')
      if (!from || from === me) return
      if (msg.docId === docId && !msg.leave) setViewers((v) => ({ ...v, [from]: Date.now() }))
      else setViewers((v) => (from in v ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== from)) : v))
    })
    const sweep = setInterval(() => setViewers((v) => {
      const now = Date.now()
      const keep = Object.entries(v).filter(([, t]) => now - t < 12_000)
      return keep.length === Object.keys(v).length ? v : Object.fromEntries(keep)
    }), 3_000)
    return () => {
      clearInterval(iv)
      clearInterval(sweep)
      off()
      emitSyncEvent('doc-view', { docId, leave: true })
    }
  }, [docId, serverMode, me])

  const simulated = useMemo(() => {
    const pool = users.filter((u) => u.id !== me && u.presence !== 'offline')
    if (!pool.length) return []
    const count = 1 + hashIndex(docId, 3) // 1..3
    const start = hashIndex(docId + 'x', pool.length)
    return Array.from({ length: Math.min(count, pool.length) }, (_, i) => {
      const u = pool[(start + i * 3) % pool.length]
      return { id: u.id, name: u.name, color: PRESENCE_RINGS[(hashIndex(u.id, PRESENCE_RINGS.length) + i) % PRESENCE_RINGS.length] }
    })
  }, [users, me, docId])

  const real = useMemo(
    () =>
      Object.keys(viewers)
        .filter((id) => online.includes(id))
        .map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? '동료', color: PRESENCE_RINGS[hashIndex(id, PRESENCE_RINGS.length)], live: true })),
    [viewers, online, users],
  )
  return serverMode ? real : simulated
}

export function askAIAboutDoc(doc: Doc, action: 'summary' | 'translate' | 'polish' | 'actions') {
  const body = `# ${doc.title || '제목 없음'}\n\n${doc.content}`
  const prompts = {
    summary: `다음 문서를 핵심 위주로 5줄 이내로 요약해줘.\n\n${body}`,
    translate: `다음 문서를 자연스러운 영어로 번역해줘. 마크다운 서식은 유지해줘.\n\n${body}`,
    polish: `다음 문서의 문장을 더 명확하고 읽기 쉽게 다듬어줘. 의미는 바꾸지 말고, 수정한 부분을 알려줘.\n\n${body}`,
    actions: `다음 문서에서 액션 아이템을 추출해서 담당자와 기한이 있으면 함께 체크리스트로 정리해줘.\n\n${body}`,
  }
  useUI.getState().askAI(prompts[action])
}

export function exportMarkdown(doc: Doc) {
  const md = `# ${doc.emoji ? doc.emoji + ' ' : ''}${doc.title || '제목 없음'}\n\n${doc.content}`
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(doc.title || '제목 없음').replace(/[\\/:*?"<>|]/g, '_')}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast('마크다운으로 내보냈어요', { emoji: '📥', variant: 'success', description: a.download })
}

export function copyDocLink(docId: string) {
  const url = `${location.origin}/docs/${docId}`
  navigator.clipboard?.writeText(url)
  toast('링크를 복사했어요', { emoji: '🔗', variant: 'success', description: url })
}

export function docMatches(doc: Doc, q: string) {
  const t = q.toLowerCase()
  return (doc.title || '제목 없음').toLowerCase().includes(t) || plainText(doc.content).toLowerCase().includes(t)
}
