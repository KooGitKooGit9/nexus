import { useEffect, useState } from 'react'
import { ImagePlus, Link2 } from 'lucide-react'
import { Button, Input, Modal } from '@/components/ui'
import { cn } from '@/lib/utils'

const SAMPLES = [
  'https://picsum.photos/seed/aurora-lab/720/480',
  'https://picsum.photos/seed/nexus-team/720/480',
  'https://picsum.photos/seed/q4-roadmap/720/480',
  'https://picsum.photos/seed/user-journey/720/480',
]

export function ImageDialog({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (url: string) => void }) {
  const [url, setUrl] = useState('')
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => { if (open) { setUrl(''); setOk(null) } }, [open])
  useEffect(() => {
    if (!/^https?:\/\//.test(url)) { setOk(null); return }
    // ignore results for URLs the user has already typed past (stale probe would flip the preview)
    let alive = true
    const img = new Image()
    img.onload = () => { if (alive) setOk(true) }
    img.onerror = () => { if (alive) setOk(false) }
    img.src = url
    return () => { alive = false; img.onload = null; img.onerror = null }
  }, [url])
  const submit = (u = url) => {
    u = u.trim()
    if (!/^https?:\/\//.test(u)) return
    onAdd(u)
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="이미지 추가"
      description="이미지 URL을 붙여넣으면 캔버스 중앙에 추가돼요."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" leftIcon={<ImagePlus className="h-4 w-4" />} disabled={!/^https?:\/\//.test(url)} onClick={() => submit()}>추가</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input icon={<Link2 />} autoFocus placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit() }} />
        {url && ok !== null && (
          <div className={cn('overflow-hidden rounded-xl border', ok ? 'border-line/10' : 'border-danger/40')}>
            {ok ? <img src={url} alt="" className="max-h-48 w-full object-cover" /> : <p className="p-3 text-xs text-danger">이미지를 불러올 수 없어요. URL을 확인해 주세요.</p>}
          </div>
        )}
        <div>
          <div className="mb-2 text-xs font-medium text-muted">샘플 이미지</div>
          <div className="grid grid-cols-4 gap-2">
            {SAMPLES.map((s) => (
              <button key={s} onClick={() => submit(s)} className="aspect-[3/2] overflow-hidden rounded-lg border border-line/10 transition hover:scale-[1.03] hover:border-accent/50">
                <img src={s} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
