import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Menu } from '@/components/ui'
import type { Block } from '../markdown'

/** "Table-lite": a grid of plain inputs; first row is the header. */
export function TableBlock({ block, onPatch }: { block: Block; onPatch: (patch: Partial<Block>) => void }) {
  const rows = block.rows?.length ? block.rows : [['', '']]
  const cols = rows[0].length

  const setCell = (r: number, c: number, v: string) => onPatch({ rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)) })
  const addRow = () => onPatch({ rows: [...rows, Array(cols).fill('')] })
  const addCol = () => onPatch({ rows: rows.map((r) => [...r, '']) })
  const removeRow = (r: number) => rows.length > 1 && onPatch({ rows: rows.filter((_, i) => i !== r) })
  const removeCol = (c: number) => cols > 1 && onPatch({ rows: rows.map((r) => r.filter((_, i) => i !== c)) })

  return (
    <div className="group/table relative my-2">
      <div className="overflow-x-auto rounded-xl border border-line/10">
        <table className="w-full border-collapse text-[14px]">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={cn('group/row', ri === 0 ? 'bg-surface-2/80' : 'hover:bg-line/[0.02]')}>
                {row.map((cell, ci) => (
                  <td key={ci} className="group/cell relative min-w-[120px] border-b border-r border-line/10 last:border-r-0">
                    <input
                      value={cell}
                      data-cell={`${ri}:${ci}`}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
                        e.preventDefault()
                        // Enter → cell below (adds a row at the end), Shift+Enter → cell above
                        const nr = ri + (e.shiftKey ? -1 : 1)
                        if (nr < 0) return
                        if (nr >= rows.length) addRow()
                        const root = e.currentTarget.closest('table')
                        setTimeout(() => root?.querySelector<HTMLInputElement>(`[data-cell="${nr}:${ci}"]`)?.focus(), 0)
                      }}
                      placeholder={ri === 0 ? `열 ${ci + 1}` : ''}
                      className={cn('w-full bg-transparent px-3 py-2 outline-none placeholder:text-subtle/60 focus:bg-accent/5', ri === 0 && 'font-semibold')}
                    />
                    {ri === 0 && cols > 1 && (
                      <button
                        onClick={() => removeCol(ci)}
                        title="열 삭제"
                        className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-md bg-surface-3 p-1 text-subtle shadow hover:text-danger group-hover/cell:block"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                ))}
                {rows.length > 1 && (
                  <td className="w-0 border-0 p-0">
                    <Menu
                      placement="bottom-start"
                      trigger={<button className="ml-1 hidden rounded p-0.5 text-subtle hover:text-danger group-hover/row:block"><Trash2 className="h-3 w-3" /></button>}
                      items={[{ label: '행 삭제', icon: <Trash2 />, danger: true, onClick: () => removeRow(ri) }]}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1 flex gap-1 opacity-0 transition group-hover/table:opacity-100">
        <button onClick={addRow} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-subtle hover:bg-line/[0.06] hover:text-fg">
          <Plus className="h-3 w-3" /> 행 추가
        </button>
        <button onClick={addCol} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-subtle hover:bg-line/[0.06] hover:text-fg">
          <Plus className="h-3 w-3" /> 열 추가
        </button>
      </div>
    </div>
  )
}
