import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PenTool } from 'lucide-react'
import { Page } from '@/app/Page'
import { Button, EmptyState } from '@/components/ui'
import { useWhiteboard } from './store'
import { BoardList } from './views/BoardList'
import { BoardEditor } from './views/BoardEditor'

/** Loads the handwriting font used by sticky notes (once). */
function useStickyFont() {
  useEffect(() => {
    if (document.getElementById('wb-font')) return
    const link = document.createElement('link')
    link.id = 'wb-font'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&display=swap'
    document.head.appendChild(link)
  }, [])
}

/** Mounted at `/whiteboard/*` — list at `/whiteboard`, editor at `/whiteboard/:boardId`. */
export default function WhiteboardPage() {
  useStickyFont()
  const rest = useParams()['*'] ?? ''
  const boardId = rest.split('/')[0]
  if (boardId) return <EditorRoute boardId={boardId} />
  return <BoardList />
}

function EditorRoute({ boardId }: { boardId: string }) {
  const board = useWhiteboard((s) => s.boards.find((b) => b.id === boardId))
  const navigate = useNavigate()
  if (!board) {
    return (
      <Page>
        <EmptyState
          icon={<PenTool />}
          title="보드를 찾을 수 없어요"
          description="삭제되었거나 접근 권한이 없는 보드입니다."
          action={<Button onClick={() => navigate('/whiteboard')}>보드 목록으로</Button>}
        />
      </Page>
    )
  }
  return <BoardEditor key={board.id} board={board} />
}
