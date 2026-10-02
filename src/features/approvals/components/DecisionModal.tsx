import { useEffect, useState } from 'react'
import { Check, X, Undo2 } from 'lucide-react'
import { Button, Modal, Textarea } from '@/components/ui'

export type Decision = 'approve' | 'reject' | 'cancel'

const QUICK: Record<Decision, string[]> = {
  approve: ['확인했습니다. 승인합니다.', '수고 많으셨어요 👍', '좋습니다! 진행해 주세요 🚀'],
  reject: ['증빙 자료를 첨부해 주세요.', '금액 재검토 후 다시 상신 부탁드려요.', '일정 조율이 필요해요. 이야기 나눠요.'],
  cancel: [],
}

const COPY: Record<Decision, { title: string; desc: string; cta: string; placeholder: string }> = {
  approve: { title: '결재 승인', desc: '승인 의견을 남길 수 있어요 (선택).', cta: '승인하기', placeholder: '승인 의견 (선택)' },
  reject: { title: '결재 반려', desc: '반려 사유는 기안자에게 전달됩니다.', cta: '반려하기', placeholder: '반려 사유를 입력하세요 (필수)' },
  cancel: { title: '결재 회수', desc: '회수하면 결재 진행이 중단되고 결재자에게서 사라져요. 필요하면 다시 상신할 수 있어요.', cta: '회수하기', placeholder: '' },
}

export function DecisionModal({ decision, docTitle, onClose, onConfirm }: { decision: Decision | null; docTitle?: string; onClose: () => void; onConfirm: (comment: string) => void }) {
  const [comment, setComment] = useState('')
  useEffect(() => {
    if (decision) setComment('')
  }, [decision])
  const d = decision ?? 'approve'
  const c = COPY[d]
  const invalid = d === 'reject' && !comment.trim()
  return (
    <Modal
      open={!!decision}
      onClose={onClose}
      size="sm"
      title={c.title}
      description={<>{docTitle && <span className="font-medium text-fg">“{docTitle}”</span>} {c.desc}</>}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant={d === 'approve' ? 'success' : d === 'reject' ? 'danger' : 'secondary'}
            disabled={invalid}
            leftIcon={d === 'approve' ? <Check className="h-4 w-4" /> : d === 'reject' ? <X className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
            onClick={() => onConfirm(comment)}
          >
            {c.cta}
          </Button>
        </>
      }
    >
      {d !== 'cancel' && (
        <div className="space-y-2.5">
          <Textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={c.placeholder}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !invalid) onConfirm(comment)
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK[d].map((q) => (
              <button key={q} type="button" onClick={() => setComment(q)} className="rounded-full border border-line/10 bg-line/[0.04] px-2.5 py-1 text-[11.5px] text-muted transition hover:border-accent/40 hover:text-fg">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
