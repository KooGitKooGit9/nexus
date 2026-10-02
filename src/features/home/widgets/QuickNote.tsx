import { useEffect, useRef, useState } from 'react'
import { Check, StickyNote, Trash2 } from 'lucide-react'
import { timeAgo } from '@/lib/utils'
import { useHome } from '../store'
import { Widget } from '../components/Widget'

export function QuickNote({ className, delay }: { className?: string; delay?: number }) {
  const note = useHome((s) => s.note)
  const updatedAt = useHome((s) => s.noteUpdatedAt)
  const setNote = useHome((s) => s.setNote)
  const [draft, setDraft] = useState(note)
  const [saving, setSaving] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<string | null>(null)

  // pick up changes from other tabs
  useEffect(() => {
    if (!saving) setDraft(note)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note])

  const onChange = (v: string) => {
    setDraft(v)
    setSaving(true)
    pending.current = v
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      pending.current = null
      setNote(v)
      setSaving(false)
    }, 500)
  }

  // flush an unsaved draft when navigating away (unmount) or reloading/closing the tab mid-typing
  useEffect(() => {
    const flush = () => {
      window.clearTimeout(timer.current)
      if (pending.current !== null) {
        const v = pending.current
        pending.current = null
        setNote(v)
        setSaving(false)
      }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [setNote])

  return (
    <Widget
      className={className}
      delay={delay}
      title="빠른 메모"
      subtitle={saving ? '저장 중…' : updatedAt ? `${timeAgo(updatedAt)} 저장됨` : '자동 저장'}
      icon={<StickyNote />}
      gradient="from-amber-300 to-yellow-500"
      action={
        <div className="flex items-center gap-1">
          {!saving && <Check className="h-3.5 w-3.5 text-success" />}
          <button onClick={() => onChange('')} disabled={!draft} title="지우기" aria-label="메모 지우기" className="rounded-lg p-1 text-subtle transition hover:bg-line/10 hover:text-danger disabled:pointer-events-none disabled:opacity-40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      <div className="relative h-full min-h-[170px] overflow-hidden rounded-xl border border-warning/20 bg-warning/[0.07]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgb(var(--warning) / 0.14) 24px)', backgroundPosition: '0 10px' }}
        />
        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder="떠오르는 생각을 적어두세요…"
          className="relative h-full min-h-[170px] w-full resize-none bg-transparent px-3.5 py-2.5 text-[13px] leading-6 text-fg/90 outline-none placeholder:text-subtle"
        />
      </div>
    </Widget>
  )
}
