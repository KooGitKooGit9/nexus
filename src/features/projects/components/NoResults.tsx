import type { ReactNode } from 'react'
import { Plus, RotateCcw } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { activeFilterCount, useProjectPrefs } from '../prefs'
import { useTaskParams } from '../hooks'

/** Empty state for filtered views: offers "reset filters" when filters are active, otherwise "new task". */
export function NoResults({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  const filters = useProjectPrefs((s) => s.filters)
  const reset = useProjectPrefs((s) => s.resetFilters)
  const { openNew } = useTaskParams()
  const n = activeFilterCount(filters)
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description ?? (n ? `적용된 필터 ${n}개와 일치하는 태스크가 없습니다.` : '첫 태스크를 만들어 프로젝트를 시작해 보세요.')}
      action={
        n ? (
          <Button variant="secondary" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={reset}>필터 초기화</Button>
        ) : (
          <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />} onClick={openNew}>새 태스크</Button>
        )
      }
    />
  )
}
