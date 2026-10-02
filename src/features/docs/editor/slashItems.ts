import {
  Code2, Heading1, Heading2, Heading3, Image, Lightbulb, List, ListOrdered, ListTodo, Minus, Quote, Table, Type,
  type LucideIcon,
} from 'lucide-react'
import type { Block, BlockType } from '../markdown'

export interface SlashItem {
  type: BlockType
  label: string
  desc: string
  icon: LucideIcon
  keywords: string
  /** markdown hint shown at right */
  hint?: string
  tint: string
  patch?: Partial<Block>
}

export const SLASH_ITEMS: SlashItem[] = [
  { type: 'paragraph', label: '텍스트', desc: '일반 텍스트로 작성합니다', icon: Type, keywords: 'text paragraph 텍스트 본문 p', tint: 'text-muted' },
  { type: 'h1', label: '제목 1', desc: '큰 섹션 제목', icon: Heading1, keywords: 'h1 heading title 제목 헤딩', hint: '#', tint: 'text-violet-600 dark:text-violet-400' },
  { type: 'h2', label: '제목 2', desc: '중간 섹션 제목', icon: Heading2, keywords: 'h2 heading subtitle 제목 헤딩', hint: '##', tint: 'text-violet-600 dark:text-violet-400' },
  { type: 'h3', label: '제목 3', desc: '작은 섹션 제목', icon: Heading3, keywords: 'h3 heading 제목 헤딩', hint: '###', tint: 'text-violet-600 dark:text-violet-400' },
  { type: 'bullet', label: '글머리 기호 목록', desc: '간단한 글머리 기호 목록', icon: List, keywords: 'bullet list ul 목록 리스트 글머리', hint: '-', tint: 'text-cyan-600 dark:text-cyan-400' },
  { type: 'numbered', label: '번호 매기기 목록', desc: '순서가 있는 목록', icon: ListOrdered, keywords: 'numbered ordered list ol 번호 목록', hint: '1.', tint: 'text-cyan-600 dark:text-cyan-400' },
  { type: 'todo', label: '할 일 목록', desc: '체크박스로 할 일을 추적', icon: ListTodo, keywords: 'todo task checkbox check 할일 체크', hint: '[]', tint: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'quote', label: '인용', desc: '인용문을 강조합니다', icon: Quote, keywords: 'quote blockquote 인용', hint: '>', tint: 'text-amber-600 dark:text-amber-400' },
  { type: 'callout', label: '콜아웃', desc: '눈에 띄는 안내 박스', icon: Lightbulb, keywords: 'callout note info tip 콜아웃 안내 강조', tint: 'text-yellow-600 dark:text-yellow-400' },
  { type: 'code', label: '코드', desc: '코드 스니펫을 작성합니다', icon: Code2, keywords: 'code snippet pre 코드', hint: '```', tint: 'text-pink-600 dark:text-pink-400' },
  { type: 'divider', label: '구분선', desc: '블록을 시각적으로 나눕니다', icon: Minus, keywords: 'divider hr line separator 구분선 선', hint: '---', tint: 'text-subtle' },
  { type: 'image', label: '이미지', desc: 'URL로 이미지를 삽입합니다', icon: Image, keywords: 'image picture photo img 이미지 사진 그림', tint: 'text-sky-600 dark:text-sky-400' },
  { type: 'table', label: '표', desc: '간단한 표를 추가합니다', icon: Table, keywords: 'table grid 표 테이블', tint: 'text-orange-600 dark:text-orange-400' },
]

export function filterSlash(query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_ITEMS
  return SLASH_ITEMS.filter((it) => it.label.toLowerCase().includes(q) || it.keywords.toLowerCase().includes(q))
}

/** `# ` style markdown shortcuts applied while typing in a paragraph. */
export const SHORTCUTS: [RegExp, BlockType, Partial<Block>?][] = [
  [/^###\s/, 'h3'],
  [/^##\s/, 'h2'],
  [/^#\s/, 'h1'],
  [/^\[[xX]\]\s/, 'todo', { checked: true }],
  [/^\[ ?\]\s/, 'todo', { checked: false }],
  [/^[-*+]\s\[ ?\]\s/, 'todo', { checked: false }],
  [/^[-*+]\s/, 'bullet'],
  [/^1[.)]\s/, 'numbered'],
  [/^>\s/, 'quote'],
  [/^!!\s/, 'callout', { emoji: '💡' }],
  [/^```$/, 'code'],
]

export const TYPE_LABEL: Record<BlockType, string> = Object.fromEntries(SLASH_ITEMS.map((i) => [i.type, i.label])) as Record<BlockType, string>
