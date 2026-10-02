import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from './modifiers'
import { isList, isTextBlock, newBlock, numberAt, parseMarkdown, serializeBlocks, type Block, type BlockType } from '../markdown'
import { BlockView, type BlockHandlers, type RemoteCursor } from './BlockView'
import { SHORTCUTS, filterSlash, type SlashItem } from './slashItems'
import { caretEdge } from './caret'

interface Props {
  initial: string
  onChange: (markdown: string) => void
  /** Simulated co-editors whose cursors wander between blocks. */
  coEditors?: RemoteCursor[]
  /** Called when the caret leaves the first block upwards (e.g. to focus the page title). */
  onExitTop?: () => void
}

type FocusPos = number | 'start' | 'end'

const ensure = (bs: Block[]) => (bs.length ? bs : [newBlock()])

/** Notion-style block editor built from auto-growing textareas (no contenteditable). */
export function BlockEditor({ initial, onChange, coEditors = [], onExitTop }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => ensure(parseMarkdown(initial)))
  const [slash, setSlash] = useState<{ id: string; index: number } | null>(null)
  const [, rerender] = useReducer((x: number) => x + 1, 0)

  const refs = useRef(new Map<string, HTMLTextAreaElement>())
  const pendingFocus = useRef<{ id: string; pos: FocusPos } | null>(null)
  const blocksRef = useRef(blocks)
  const slashRef = useRef(slash)
  const dirty = useRef(false)
  const onChangeRef = useRef(onChange)
  const onExitTopRef = useRef(onExitTop)

  useLayoutEffect(() => {
    blocksRef.current = blocks
    slashRef.current = slash
    onChangeRef.current = onChange
    onExitTopRef.current = onExitTop
  })

  /* ── autosave (debounced) + flush on unmount ── */
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => {
      dirty.current = false
      onChangeRef.current(serializeBlocks(blocksRef.current))
    }, 350)
    return () => clearTimeout(t)
  }, [blocks])
  useEffect(
    () => () => {
      if (dirty.current) onChangeRef.current(serializeBlocks(blocksRef.current))
    },
    [],
  )

  /* ── focus management ── */
  useLayoutEffect(() => {
    const f = pendingFocus.current
    if (!f) return
    const el = refs.current.get(f.id)
    if (!el) return
    pendingFocus.current = null
    el.focus()
    const len = el.value.length
    const p = f.pos === 'start' ? 0 : f.pos === 'end' ? len : Math.min(f.pos, len)
    el.setSelectionRange(p, p)
  })

  /* ── slash menu derived state ── */
  const slashBlock = slash ? blocks.find((b) => b.id === slash.id) : undefined
  const slashQuery = slashBlock?.text.startsWith('/') ? slashBlock.text.slice(1) : ''
  const slashItems = useMemo(() => filterSlash(slashQuery), [slashQuery])
  const slashItemsRef = useRef(slashItems)
  useLayoutEffect(() => { slashItemsRef.current = slashItems })

  /* ── simulated remote cursors ── */
  const [remoteAt, setRemoteAt] = useState<Record<string, string>>({})
  const coKey = coEditors.map((c) => c.id).join(',')
  useEffect(() => {
    if (!coKey) return
    const move = () => {
      const candidates = blocksRef.current.filter((b) => isTextBlock(b) && b.text.trim())
      if (!candidates.length) return
      setRemoteAt((prev) => {
        const next = { ...prev }
        coKey.split(',').forEach((id) => {
          if (!prev[id] || Math.random() < 0.55) next[id] = candidates[Math.floor(Math.random() * candidates.length)].id
        })
        return next
      })
    }
    move()
    const t = setInterval(move, 3800)
    return () => clearInterval(t)
  }, [coKey])

  /* ── handlers (stable: read latest state via refs) ── */
  const h = useMemo<BlockHandlers & { applySlash: (b: Block, item: SlashItem) => void }>(() => {
    const commit = (fn: (bs: Block[]) => Block[], focus?: { id: string; pos: FocusPos }) => {
      dirty.current = true
      if (focus) pendingFocus.current = focus
      setBlocks((bs) => ensure(fn(bs)))
    }
    const focusBlock = (id: string, pos: FocusPos) => {
      pendingFocus.current = { id, pos }
      rerender()
    }
    const patch = (id: string, p: Partial<Block>, focus?: { id: string; pos: FocusPos }) =>
      commit((bs) => bs.map((x) => (x.id === id ? { ...x, ...p } : x)), focus)
    const indexOf = (id: string) => blocksRef.current.findIndex((b) => b.id === id)
    const prevText = (idx: number) => {
      for (let i = idx - 1; i >= 0; i--) if (isTextBlock(blocksRef.current[i])) return blocksRef.current[i]
      return undefined
    }
    const nextText = (idx: number) => {
      for (let i = idx + 1; i < blocksRef.current.length; i++) if (isTextBlock(blocksRef.current[i])) return blocksRef.current[i]
      return undefined
    }
    const insertAfter = (id: string, nb: Block[], focus?: { id: string; pos: FocusPos }) =>
      commit((bs) => {
        const i = bs.findIndex((x) => x.id === id)
        const out = [...bs]
        out.splice(i + 1, 0, ...nb)
        return out
      }, focus)
    const replaceWith = (id: string, nb: Block[], focus?: { id: string; pos: FocusPos }) =>
      commit((bs) => {
        const i = bs.findIndex((x) => x.id === id)
        const out = [...bs]
        out.splice(i, 1, ...nb)
        return out
      }, focus)
    const move = (id: string, dir: -1 | 1) =>
      commit((bs) => {
        const i = bs.findIndex((x) => x.id === id)
        const j = i + dir
        if (j < 0 || j >= bs.length) return bs
        return arrayMove(bs, i, j)
      })

    const turnInto = (b: Block, type: BlockType, extra: Partial<Block> = {}, text = b.text) => {
      if (type === 'divider' || type === 'image' || type === 'table') {
        const after = newBlock('paragraph', { text })
        const created = newBlock(type, extra)
        replaceWith(b.id, [created, after], type === 'divider' ? { id: after.id, pos: 'start' } : undefined)
        if (type === 'table') setTimeout(() => document.querySelector<HTMLInputElement>(`#blk-${created.id} input`)?.focus(), 0)
        return
      }
      patch(
        b.id,
        { type, text, checked: type === 'todo' ? !!extra.checked : undefined, indent: isList({ ...b, type }) ? b.indent : undefined, emoji: type === 'callout' ? b.emoji ?? '💡' : undefined, ...extra },
        { id: b.id, pos: 'end' },
      )
    }

    const applySlash = (b: Block, item: SlashItem) => {
      setSlash(null)
      const current = blocksRef.current.find((x) => x.id === b.id) ?? b
      const rest = current.text.replace(/^\/\S*\s?/, '')
      turnInto(current, item.type, item.patch, rest)
    }

    return {
      applySlash,
      register: (id, el) => {
        if (el) refs.current.set(id, el)
        else refs.current.delete(id)
      },
      onPatch: (id, p) => patch(id, p),
      onBlur: (id) => {
        // close the slash menu shortly after leaving (allows menu clicks)
        setTimeout(() => {
          if (slashRef.current?.id === id && document.activeElement !== refs.current.get(id)) setSlash(null)
        }, 150)
      },
      onRemove: (id) => {
        const idx = indexOf(id)
        const target = prevText(idx) ?? nextText(idx)
        commit((bs) => bs.filter((x) => x.id !== id), target ? { id: target.id, pos: 'end' } : undefined)
      },
      onDuplicate: (id) => {
        const src = blocksRef.current.find((x) => x.id === id)
        if (src) insertAfter(id, [{ ...newBlock(src.type), ...src, id: newBlock().id, rows: src.rows?.map((r) => [...r]) }])
      },
      onMove: move,
      onTurnInto: (b, item) => turnInto(b, item.type, item.patch),
      onAdd: (b) => {
        if (b.type === 'paragraph' && !b.text) {
          patch(b.id, { text: '/' }, { id: b.id, pos: 'end' })
          setSlash({ id: b.id, index: 0 })
          return
        }
        const nb = newBlock('paragraph', { text: '/' })
        insertAfter(b.id, [nb], { id: nb.id, pos: 'end' })
        setSlash({ id: nb.id, index: 0 })
      },

      onText: (b, text) => {
        const s = slashRef.current
        if (b.type !== 'code') {
          // slash menu
          // only an empty block opens the menu (typing "/" in front of existing text must not eat it on apply)
          if (text === '/' && !b.text) setSlash({ id: b.id, index: 0 })
          else if (s?.id === b.id) {
            const q = text.slice(1)
            if (!text.startsWith('/') || (/\s$/.test(q) && filterSlash(q).length === 0)) setSlash(null)
            else setSlash({ id: b.id, index: 0 })
          }
          // markdown shortcuts
          if (b.type === 'paragraph') {
            if (/^(---|\*\*\*|___)$/.test(text)) {
              setSlash(null)
              turnInto(b, 'divider', {}, '')
              return
            }
            for (const [re, type, extra] of SHORTCUTS) {
              if (re.test(text)) {
                setSlash(null)
                turnInto(b, type, extra ?? {}, text.replace(re, ''))
                return
              }
            }
          }
          if (b.type === 'bullet' && /^\[ ?\]\s/.test(text)) {
            turnInto(b, 'todo', { checked: false }, text.replace(/^\[ ?\]\s/, ''))
            return
          }
        }
        patch(b.id, { text })
      },

      onPaste: (e: ClipboardEvent<HTMLTextAreaElement>, b) => {
        if (b.type === 'code') return
        const text = e.clipboardData.getData('text/plain')
        if (!text.includes('\n')) return
        const parsed = parseMarkdown(text)
        if (parsed.length < 2) return
        e.preventDefault()
        const last = [...parsed].reverse().find(isTextBlock)
        const focus = last ? { id: last.id, pos: 'end' as const } : undefined
        if (!e.currentTarget.value.trim()) replaceWith(b.id, parsed, focus)
        else insertAfter(b.id, parsed, focus)
      },

      onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>, b) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return
        const el = e.currentTarget
        const s = slashRef.current
        const items = slashItemsRef.current

        // slash menu navigation
        if (s?.id === b.id) {
          if (e.key === 'Escape') { e.preventDefault(); setSlash(null); return }
          if (items.length) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSlash({ ...s, index: (s.index + 1) % items.length }); return }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSlash({ ...s, index: (s.index - 1 + items.length) % items.length }); return }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySlash(b, items[Math.min(s.index, items.length - 1)]); return }
          }
        }

        const idx = indexOf(b.id)
        const start = el.selectionStart
        const end = el.selectionEnd
        const collapsed = start === end
        const mod = e.metaKey || e.ctrlKey

        // reorder: ⌘⇧↑ / ⌘⇧↓
        if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault()
          const dir = e.key === 'ArrowUp' ? -1 : 1
          const j = idx + dir
          // only schedule a refocus when the move actually happens (a no-op commit wouldn't re-render,
          // leaving a stale pending focus that would steal focus on some later render)
          if (j < 0 || j >= blocksRef.current.length) return
          pendingFocus.current = { id: b.id, pos: start }
          move(b.id, dir)
          return
        }

        // headings & list items are single markdown lines → no soft line breaks
        if (e.key === 'Enter' && e.shiftKey && (isList(b) || b.type === 'h1' || b.type === 'h2' || b.type === 'h3')) {
          e.preventDefault()
          return
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          if (b.type === 'code') {
            if (mod) {
              e.preventDefault()
              const nb = newBlock()
              insertAfter(b.id, [nb], { id: nb.id, pos: 'start' })
            }
            return
          }
          e.preventDefault()
          const value = el.value
          if (isList(b) && !value) {
            if (b.indent) patch(b.id, { indent: b.indent - 1 || undefined }, { id: b.id, pos: 'start' })
            else turnInto(b, 'paragraph', {}, '')
            return
          }
          if ((b.type === 'quote' || b.type === 'callout') && !value) { turnInto(b, 'paragraph', {}, ''); return }
          const nextType: BlockType = isList(b) ? b.type : 'paragraph'
          const nb = newBlock(nextType, isList(b) ? { indent: b.indent } : {})
          if (collapsed && start === 0 && value) {
            commit((bs) => {
              const i = bs.findIndex((x) => x.id === b.id)
              const out = [...bs]
              out.splice(i, 0, nb)
              return out
            }, { id: b.id, pos: 'start' })
            return
          }
          nb.text = value.slice(end)
          commit((bs) => {
            const i = bs.findIndex((x) => x.id === b.id)
            const out = bs.map((x) => (x.id === b.id ? { ...x, text: value.slice(0, start) } : x))
            out.splice(i + 1, 0, nb)
            return out
          }, { id: nb.id, pos: 'start' })
          return
        }

        if (e.key === 'Backspace' && collapsed && start === 0) {
          if (b.type !== 'paragraph') {
            e.preventDefault()
            if (isList(b) && b.indent) patch(b.id, { indent: b.indent - 1 || undefined }, { id: b.id, pos: 'start' })
            else patch(b.id, { type: 'paragraph', checked: undefined, indent: undefined, emoji: undefined, lang: undefined }, { id: b.id, pos: 'start' })
            return
          }
          const prev = blocksRef.current[idx - 1]
          if (!prev) return
          e.preventDefault()
          const value = el.value
          if (!value) {
            const target = prevText(idx)
            commit((bs) => bs.filter((x) => x.id !== b.id), target ? { id: target.id, pos: 'end' } : undefined)
            return
          }
          if (isTextBlock(prev)) {
            commit(
              (bs) => bs.filter((x) => x.id !== b.id).map((x) => (x.id === prev.id ? { ...x, text: x.text + value } : x)),
              { id: prev.id, pos: prev.text.length },
            )
          } else if (prev.type === 'divider') {
            commit((bs) => bs.filter((x) => x.id !== prev.id), { id: b.id, pos: 'start' })
          }
          return
        }

        if (e.key === 'Delete' && collapsed && start === el.value.length) {
          const next = blocksRef.current[idx + 1]
          if (next && isTextBlock(next) && next.type !== 'code') {
            e.preventDefault()
            const value = el.value
            commit((bs) => bs.filter((x) => x.id !== next.id).map((x) => (x.id === b.id ? { ...x, text: value + next.text } : x)), { id: b.id, pos: start })
          }
          return
        }

        if (e.key === 'Tab') {
          e.preventDefault()
          if (b.type === 'code') {
            el.setRangeText('  ', start, end, 'end')
            patch(b.id, { text: el.value })
            pendingFocus.current = { id: b.id, pos: start + 2 }
            return
          }
          if (isList(b)) {
            const indent = Math.max(0, Math.min(2, (b.indent ?? 0) + (e.shiftKey ? -1 : 1)))
            patch(b.id, { indent: indent || undefined }, { id: b.id, pos: start })
          }
          return
        }

        if (e.key === 'Escape') { el.blur(); return }

        if (!collapsed || e.shiftKey || mod || e.altKey) return
        if (e.key === 'ArrowUp' && (start === 0 || caretEdge(el, start).first)) {
          const p = prevText(idx)
          if (p) { e.preventDefault(); focusBlock(p.id, 'end') }
          else if (onExitTopRef.current) { e.preventDefault(); onExitTopRef.current() }
        } else if (e.key === 'ArrowDown' && (start === el.value.length || caretEdge(el, start).last)) {
          const n = nextText(idx)
          if (n) { e.preventDefault(); focusBlock(n.id, 'start') }
        } else if (e.key === 'ArrowLeft' && start === 0) {
          const p = prevText(idx)
          if (p) { e.preventDefault(); focusBlock(p.id, 'end') }
        } else if (e.key === 'ArrowRight' && start === el.value.length) {
          const n = nextText(idx)
          if (n) { e.preventDefault(); focusBlock(n.id, 'start') }
        }
      },
    }
  }, [])

  /* ── drag & drop ── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    dirty.current = true
    setBlocks((bs) => arrayMove(bs, bs.findIndex((b) => b.id === active.id), bs.findIndex((b) => b.id === over.id)))
  }

  const appendAtEnd = () => {
    const last = blocks[blocks.length - 1]
    if (last && last.type === 'paragraph' && !last.text) {
      pendingFocus.current = { id: last.id, pos: 'end' }
      rerender()
      return
    }
    const nb = newBlock()
    dirty.current = true
    pendingFocus.current = { id: nb.id, pos: 'start' }
    setBlocks((bs) => [...bs, nb])
  }

  const remotesByBlock = useMemo(() => {
    const map: Record<string, RemoteCursor[]> = {}
    coEditors.forEach((c) => {
      const bid = remoteAt[c.id]
      if (bid) (map[bid] ??= []).push(c)
    })
    return map
  }, [coEditors, remoteAt])

  const slashState = slash && {
    items: slashItems,
    index: Math.min(slash.index, Math.max(0, slashItems.length - 1)),
    query: slashQuery,
    onSelect: (item: SlashItem) => slashBlock && h.applySlash(slashBlock, item),
    onHover: (i: number) => setSlash((s) => (s ? { ...s, index: i } : s)),
  }

  return (
    <div className="relative pb-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-[2px]">
            {blocks.map((b, i) => (
              <BlockView
                key={b.id}
                block={b}
                number={b.type === 'numbered' ? numberAt(blocks, i) : 0}
                h={h}
                slash={slash?.id === b.id ? slashState ?? undefined : undefined}
                remotes={remotesByBlock[b.id]}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div onClick={appendAtEnd} className="h-40 cursor-text" />
    </div>
  )
}
