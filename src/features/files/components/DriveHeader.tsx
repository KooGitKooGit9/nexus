import { Fragment, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronRight, FolderPlus, LayoutGrid, List, PanelLeft, Search, Trash2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Menu, Tabs } from '@/components/ui'
import { pathOf, useFiles } from '../store'
import { useDriveUI } from '../uiStore'
import { uploadFiles } from '../hooks'
import { TYPE_FILTERS } from '../fileTypes'
import type { DriveSection, SortKey } from '../types'
import { SECTIONS } from './DriveNav'

const SORT_LABEL: Record<SortKey, string> = { name: '이름', updatedAt: '수정한 날짜', size: '파일 크기', owner: '소유자' }

export function DriveHeader({ section, folderId, uploadTarget }: { section: DriveSection; folderId: string | null; uploadTarget: string | null }) {
  const navigate = useNavigate()
  const files = useFiles((s) => s.files)
  const view = useFiles((s) => s.view)
  const setView = useFiles((s) => s.setView)
  const sortKey = useFiles((s) => s.sortKey)
  const sortDir = useFiles((s) => s.sortDir)
  const setSort = useFiles((s) => s.setSort)
  const query = useDriveUI((s) => s.query)
  const setQuery = useDriveUI((s) => s.setQuery)
  const typeFilter = useDriveUI((s) => s.typeFilter)
  const setTypeFilter = useDriveUI((s) => s.setTypeFilter)
  const inputRef = useRef<HTMLInputElement>(null)
  const compact = useDriveUI((s) => s.compact)
  const chain = section === 'my' ? pathOf(files, folderId) : []
  const sectionMeta = SECTIONS.find((s) => s.id === section)!
  const trashCount = files.filter((f) => f.trashed).length

  return (
    <div className="shrink-0 px-6 pt-5">
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) uploadFiles(e.target.files, uploadTarget); e.target.value = '' }} />
      <div className="flex flex-wrap items-center gap-3">
        {/* breadcrumbs */}
        {/* basis keeps the title from being squeezed under the actions (they wrap to a 2nd line instead) */}
        <nav className="flex min-w-0 flex-[1_1_300px] items-center gap-0.5 overflow-hidden">
          {compact && (
            <button
              onClick={() => useDriveUI.getState().setNavOpen(true)}
              title="드라이브 메뉴 열기"
              className="mr-1 shrink-0 rounded-lg p-1.5 text-subtle hover:bg-line/10 hover:text-fg"
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={() => navigate(sectionMeta.path)}
            className={cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-2 py-1 font-display text-[22px] font-bold tracking-tight transition hover:bg-line/[0.05]', chain.length ? 'text-muted' : 'text-fg')}
          >
            <sectionMeta.icon className="h-5 w-5 text-accent" />
            {sectionMeta.label}
          </button>
          {chain.map((f, i) => (
            <Fragment key={f.id}>
              <ChevronRight className="h-5 w-5 shrink-0 text-subtle" />
              <button
                onClick={() => navigate(`/files/${f.id}`)}
                className={cn('min-w-0 truncate rounded-xl px-2 py-1 font-display text-[22px] font-bold tracking-tight transition hover:bg-line/[0.05]', i === chain.length - 1 ? 'text-fg' : 'max-w-[180px] text-muted')}
              >
                {f.name}
              </button>
            </Fragment>
          ))}
        </nav>

        {/* actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="드라이브에서 검색"
              className="h-9 w-48 rounded-xl border border-line/10 bg-line/[0.04] pl-9 pr-8 text-[13px] outline-none transition placeholder:text-subtle focus:w-64 focus:border-accent/50 focus:ring-4 focus:ring-accent/10"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle hover:text-fg"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>

          <Menu
            placement="bottom-end"
            className="w-48"
            trigger={<Button size="sm" variant="ghost" leftIcon={<ArrowUpDown className="h-3.5 w-3.5" />}>{SORT_LABEL[sortKey]}</Button>}
            items={[
              ...(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
                label: SORT_LABEL[k],
                icon: sortKey === k ? <Check /> : <span />,
                onClick: () => setSort(k, sortKey === k ? sortDir : undefined),
              })),
              { label: '', divider: true },
              { label: '오름차순', icon: sortDir === 'asc' ? <ArrowUp className="text-accent" /> : <ArrowUp />, onClick: () => setSort(sortKey, 'asc') },
              { label: '내림차순', icon: sortDir === 'desc' ? <ArrowDown className="text-accent" /> : <ArrowDown />, onClick: () => setSort(sortKey, 'desc') },
            ]}
          />

          <Tabs
            size="sm"
            value={view}
            onChange={setView}
            items={[
              { value: 'grid', label: '', icon: <LayoutGrid /> },
              { value: 'list', label: '', icon: <List /> },
            ]}
          />

          {section === 'trash' ? (
            <Button size="sm" variant="danger" disabled={!trashCount} leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => useDriveUI.getState().setDeleteIds(files.filter((f) => f.trashed).map((f) => f.id))}>
              휴지통 비우기
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" leftIcon={<FolderPlus className="h-3.5 w-3.5" />} onClick={() => useDriveUI.getState().setNewFolderOpen(true)}>
                새 폴더
              </Button>
              <Button size="sm" variant="primary" leftIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => inputRef.current?.click()}>
                업로드
              </Button>
            </>
          )}
        </div>
      </div>

      {/* type filters */}
      {section !== 'trash' && (
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTypeFilter(t.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition',
                typeFilter === t.id ? 'border-accent/40 bg-accent/15 text-accent shadow-glow-sm' : 'border-line/10 text-muted hover:border-line/20 hover:text-fg',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {section === 'trash' && (
        <div className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.07] px-3.5 py-2 text-[12.5px] text-muted">
          🗑️ 휴지통의 항목은 30일 후 자동으로 영구 삭제됩니다.
        </div>
      )}
    </div>
  )
}
