import { memo, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, Copy, CopyPlus, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox, Menu, Popover, type MenuItem } from '@/components/ui'
import type { Block, BlockType } from '../markdown'
import { CALLOUT_EMOJIS, calloutTone } from '../constants'
import { AutoTextarea } from './AutoTextarea'
import { SlashMenu } from './SlashMenu'
import { SLASH_ITEMS, type SlashItem } from './slashItems'
import { TableBlock } from './TableBlock'
import { ImageBlock } from './ImageBlock'

export interface RemoteCursor {
  id: string
  name: string
  color: string
  /** a real, connected member (vs. a simulated demo co-editor) */
  live?: boolean
}

export interface BlockHandlers {
  onText: (b: Block, text: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>, b: Block) => void
  onPaste: (e: ClipboardEvent<HTMLTextAreaElement>, b: Block) => void
  onPatch: (id: string, patch: Partial<Block>) => void
  register: (id: string, el: HTMLTextAreaElement | null) => void
  onAdd: (b: Block) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onTurnInto: (b: Block, item: SlashItem) => void
  onBlur: (id: string) => void
}

export interface SlashState {
  items: SlashItem[]
  index: number
  query: string
  onSelect: (item: SlashItem) => void
  onHover: (i: number) => void
}

interface Props {
  block: Block
  number: number
  h: BlockHandlers
  slash?: SlashState
  remotes?: RemoteCursor[]
}

const WRAP_SPACING: Partial<Record<BlockType, string>> = {
  h1: 'mt-7 mb-1',
  h2: 'mt-6 mb-0.5',
  h3: 'mt-4',
  callout: 'my-2',
  code: 'my-2',
  quote: 'my-1',
}

const GUTTER_TOP: Partial<Record<BlockType, string>> = {
  h1: 'top-[8px]',
  h2: 'top-[4px]',
  h3: 'top-[2px]',
  callout: 'top-[14px]',
  code: 'top-[10px]',
  divider: 'top-[6px]',
  image: 'top-[10px]',
  table: 'top-[10px]',
}

const TEXT_STYLE: Partial<Record<BlockType, string>> = {
  paragraph: 'text-[16px] leading-7 text-fg/90',
  h1: 'font-display text-[32px] font-bold leading-tight tracking-tight text-fg',
  h2: 'font-display text-[24px] font-semibold leading-snug tracking-tight text-fg',
  h3: 'text-[19px] font-semibold leading-7 text-fg',
  bullet: 'text-[16px] leading-7 text-fg/90',
  numbered: 'text-[16px] leading-7 text-fg/90',
  todo: 'text-[16px] leading-7 text-fg/90',
  quote: 'text-[17px] leading-7 text-fg/80',
  callout: 'text-[15px] leading-7 text-fg/90',
  code: 'font-mono text-[13px] leading-6 text-fg/90',
}

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  paragraph: "글을 쓰거나 '/'를 입력해 명령어 사용",
  h1: '제목 1',
  h2: '제목 2',
  h3: '제목 3',
  bullet: '목록',
  numbered: '목록',
  todo: '할 일',
  quote: '인용문을 입력하세요',
  callout: '내용을 입력하세요',
  code: '// 코드를 입력하세요',
}

const ALWAYS_PLACEHOLDER: BlockType[] = ['h1', 'h2', 'h3']

const BULLETS = ['•', '◦', '▪']


export const BlockView = memo(function BlockView({ block, number, h, slash, remotes }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const [copied, setCopied] = useState(false)
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }

  const textInput = (extra?: string) => (
    <AutoTextarea
      ref={(el) => h.register(block.id, el)}
      preview={block.type !== 'code'}
      value={block.text}
      onChange={(e) => h.onText(block, e.target.value)}
      onKeyDown={(e) => h.onKeyDown(e, block)}
      onPaste={(e) => h.onPaste(e, block)}
      onBlur={() => h.onBlur(block.id)}
      placeholder={PLACEHOLDER[block.type]}
      className={cn(
        TEXT_STYLE[block.type],
        ALWAYS_PLACEHOLDER.includes(block.type)
          ? 'placeholder:text-subtle/50'
          : 'placeholder:text-subtle/0 focus:placeholder:text-subtle/60',
        extra,
      )}
    />
  )

  const content = (() => {
    switch (block.type) {
      case 'bullet':
        return (
          <div className="flex items-start" style={{ paddingLeft: (block.indent ?? 0) * 26 }}>
            <span className="w-6 shrink-0 select-none text-center text-[16px] leading-7 text-accent">{BULLETS[(block.indent ?? 0) % 3]}</span>
            {textInput()}
          </div>
        )
      case 'numbered':
        return (
          <div className="flex items-start" style={{ paddingLeft: (block.indent ?? 0) * 26 }}>
            <span className="min-w-[24px] shrink-0 select-none pr-1.5 text-right text-[15px] font-medium tabular-nums leading-7 text-accent">{number}.</span>
            {textInput()}
          </div>
        )
      case 'todo':
        return (
          <div className="flex items-start gap-2" style={{ paddingLeft: (block.indent ?? 0) * 26 }}>
            <div className="flex h-7 w-6 shrink-0 items-center justify-center">
              <Checkbox checked={!!block.checked} onChange={(v) => h.onPatch(block.id, { checked: v })} />
            </div>
            {textInput(cn('transition-colors', block.checked && 'text-subtle line-through decoration-subtle/60'))}
          </div>
        )
      case 'quote':
        return (
          <div className="border-l-[3px] border-accent/70 pl-4">
            {textInput()}
          </div>
        )
      case 'callout':
        return (
          <div className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3.5', calloutTone(block.emoji))}>
            <Popover
              placement="bottom-start"
              className="w-[220px]"
              trigger={({ toggle }) => (
                <button onClick={toggle} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[20px] transition hover:bg-line/10">
                  {block.emoji || '💡'}
                </button>
              )}
            >
              {(close) => (
                <div className="grid grid-cols-6 gap-0.5 p-1">
                  {CALLOUT_EMOJIS.map((em) => (
                    <button key={em} onClick={() => { h.onPatch(block.id, { emoji: em }); close() }} className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-line/10">
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </Popover>
            {textInput()}
          </div>
        )
      case 'code':
        return (
          <div className="overflow-hidden rounded-2xl border border-line/10 bg-surface-3/60">
            <div className="flex items-center justify-between border-b border-line/[0.07] px-3 py-1.5">
              <input
                value={block.lang ?? ''}
                onChange={(e) => h.onPatch(block.id, { lang: e.target.value.replace(/[^\w+#.-]/g, '').slice(0, 24) || undefined })}
                placeholder="plain text"
                className="w-28 bg-transparent font-mono text-[11px] text-subtle outline-none placeholder:text-subtle/60 focus:text-fg"
              />
              <button
                onClick={() => { navigator.clipboard?.writeText(block.text); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-subtle transition hover:bg-line/10 hover:text-fg"
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied ? '복사됨' : '복사'}
              </button>
            </div>
            <div className="px-4 py-3">{textInput()}</div>
          </div>
        )
      case 'divider':
        return <div className="flex h-9 items-center"><div className="h-px w-full bg-gradient-to-r from-transparent via-line/20 to-transparent" /></div>
      case 'image':
        return <ImageBlock block={block} onPatch={(p) => h.onPatch(block.id, p)} onRemove={() => h.onRemove(block.id)} />
      case 'table':
        return <TableBlock block={block} onPatch={(p) => h.onPatch(block.id, p)} />
      default:
        return textInput()
    }
  })()

  const turnInto: MenuItem[] = SLASH_ITEMS.filter((i) => !['divider', 'image', 'table'].includes(i.type) && i.type !== block.type).map((i) => ({
    label: i.label,
    icon: <i.icon />,
    onClick: () => h.onTurnInto(block, i),
  }))

  const isHeading = (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') && block.text.trim()

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`blk-${block.id}`}
      data-doc-heading={isHeading ? block.type : undefined}
      className={cn('group/block relative scroll-mt-20 rounded-lg', WRAP_SPACING[block.type], isDragging && 'z-30 bg-surface/80 opacity-80 shadow-float ring-1 ring-accent/40 backdrop-blur')}
    >
      <div className="relative">
        {/* hover gutter */}
        <div className={cn('absolute right-full top-[2px] mr-1.5 flex items-center opacity-0 transition-opacity group-hover/block:opacity-100', GUTTER_TOP[block.type], isDragging && 'opacity-100')}>
          <button
            onClick={() => h.onAdd(block)}
            title="아래에 블록 추가"
            className="flex h-6 w-6 items-center justify-center rounded-md text-subtle transition hover:bg-line/10 hover:text-fg"
          >
            <Plus className="h-4 w-4" />
          </button>
          <Menu
            placement="bottom-start"
            className="max-h-[70vh] w-56 overflow-y-auto"
            trigger={
              <button
                {...attributes}
                {...listeners}
                title="드래그해서 이동 · 클릭해서 메뉴 열기"
                className="flex h-6 w-5 cursor-grab items-center justify-center rounded-md text-subtle transition hover:bg-line/10 hover:text-fg active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            }
            items={[
              { label: '삭제', icon: <Trash2 />, danger: true, shortcut: 'Del', onClick: () => h.onRemove(block.id) },
              { label: '복제', icon: <CopyPlus />, onClick: () => h.onDuplicate(block.id) },
              { label: '위로 이동', icon: <ArrowUp />, shortcut: '⌘⇧↑', onClick: () => h.onMove(block.id, -1) },
              { label: '아래로 이동', icon: <ArrowDown />, shortcut: '⌘⇧↓', onClick: () => h.onMove(block.id, 1) },
              { label: '', divider: true },
              ...turnInto,
            ]}
          />
        </div>

        {/* simulated co-editor cursors */}
        {remotes?.map((r, i) => (
          <motion.div
            key={r.id}
            layoutId={`remote-${r.id}`}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="pointer-events-none absolute -left-2.5 top-0.5 bottom-0.5 w-[2px] rounded-full"
            style={{ background: r.color, boxShadow: `0 0 10px ${r.color}` }}
          >
            <span
              className="absolute right-[3px] top-0 whitespace-nowrap rounded-md rounded-tr-none px-1.5 py-[1px] text-[10px] font-semibold text-black/80 shadow-sm transition-opacity group-hover/block:opacity-0"
              style={{ background: r.color, transform: `translateY(${i * 18}px)` }}
            >
              {r.name}
            </span>
          </motion.div>
        ))}

        {content}
      </div>
      {slash && <SlashMenu items={slash.items} index={slash.index} query={slash.query} onSelect={slash.onSelect} onHover={slash.onHover} />}
    </div>
  )
})
