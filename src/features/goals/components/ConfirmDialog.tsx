import type { ReactNode } from 'react'
import { Button, Modal } from '@/components/ui'

/** Small destructive-action confirmation (used by goals & announcements). */
export function ConfirmDialog({
  open, title, description, confirmLabel = '삭제', onConfirm, onClose,
}: { open: boolean; title: ReactNode; description?: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            variant="danger"
            autoFocus
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
