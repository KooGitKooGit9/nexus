import { useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { FileQuestion } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { useDocs } from './store'
import { useDocsUI } from './uiStore'
import { PageTree } from './components/PageTree'
import { TemplatesModal } from './components/TemplatesModal'
import { DeleteDocModal, MoveDocModal } from './components/DocModals'
import { DocView } from './views/DocView'
import { DocsHome } from './views/DocsHome'

/** Below this content width the page tree turns into an overlay. */
const COMPACT_BELOW = 900

export default function DocsPage() {
  const navigate = useNavigate()
  const docId = useParams()['*']?.split('/')[0] || ''
  const doc = useDocs((s) => s.docs.find((d) => d.id === docId))
  const treeOpen = useDocsUI((s) => s.treeOpen)
  const compact = useDocsUI((s) => s.compact)
  const overlayOpen = useDocsUI((s) => s.overlayOpen)
  const rootRef = useRef<HTMLDivElement>(null)

  // Narrow pane → the tree floats over the content instead of squeezing the editor
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => {
      const narrow = el.clientWidth < COMPACT_BELOW
      if (narrow !== useDocsUI.getState().compact) useDocsUI.getState().setCompact(narrow)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Close the overlay tree after navigating
  useEffect(() => {
    if (useDocsUI.getState().overlayOpen) useDocsUI.getState().setOverlayOpen(false)
  }, [docId])
  const [params, setParams] = useSearchParams()

  // ?new=1 → template gallery
  useEffect(() => {
    if (params.get('new') === '1') {
      useDocsUI.getState().openTemplates(doc ? doc.id : null)
      const next = new URLSearchParams(params)
      next.delete('new')
      setParams(next, { replace: true })
    }
  }, [params, setParams, doc])

  // "N" → new page (ignored while typing or right after the global "g" prefix)
  useEffect(() => {
    let lastG = 0
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === 'Escape' && useDocsUI.getState().overlayOpen && !document.querySelector('[role="dialog"]')) {
        useDocsUI.getState().setOverlayOpen(false)
        return
      }
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'g') { lastG = Date.now(); return }
      if (e.key.toLowerCase() === 'n' && Date.now() - lastG > 1000) {
        e.preventDefault()
        useDocsUI.getState().openTemplates(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={rootRef} className="relative flex h-full">
      <AnimatePresence initial={false}>
        {(compact ? overlayOpen : treeOpen) && <PageTree key={compact ? 'tree-overlay' : 'tree'} activeId={doc?.id} />}
        {compact && overlayOpen && (
          <motion.div
            key="tree-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => useDocsUI.getState().setOverlayOpen(false)}
            className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          />
        )}
      </AnimatePresence>
      <main className="relative min-w-0 flex-1">
        {doc ? (
          <DocView doc={doc} />
        ) : docId ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<FileQuestion />}
              title="페이지를 찾을 수 없어요"
              description="삭제되었거나 접근 권한이 없는 페이지입니다."
              action={<Button variant="primary" onClick={() => navigate('/docs')}>위키 홈으로</Button>}
            />
          </div>
        ) : (
          <DocsHome />
        )}
      </main>
      <TemplatesModal />
      <DeleteDocModal />
      <MoveDocModal />
    </div>
  )
}
