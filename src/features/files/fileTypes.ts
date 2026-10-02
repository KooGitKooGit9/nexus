import {
  Archive, Braces, File, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, PenTool, Presentation, ScrollText,
  type LucideIcon,
} from 'lucide-react'
import { hashIndex, PALETTE } from '@/lib/utils'
import type { FileItem } from './types'

export type FileKind = 'folder' | 'pdf' | 'doc' | 'sheet' | 'slide' | 'image' | 'video' | 'audio' | 'zip' | 'design' | 'code' | 'text' | 'other'

export interface KindMeta {
  label: string
  icon: LucideIcon
  /** primary hex color */
  color: string
  /** secondary hex color for gradients */
  color2: string
}

export const KIND_META: Record<FileKind, KindMeta> = {
  folder: { label: '폴더', icon: Folder, color: '#8b5cf6', color2: '#6366f1' },
  pdf: { label: 'PDF 문서', icon: FileText, color: '#ef4444', color2: '#f97316' },
  doc: { label: '문서', icon: ScrollText, color: '#3b82f6', color2: '#6366f1' },
  sheet: { label: '스프레드시트', icon: FileSpreadsheet, color: '#10b981', color2: '#22c55e' },
  slide: { label: '프레젠테이션', icon: Presentation, color: '#f97316', color2: '#f59e0b' },
  image: { label: '이미지', icon: FileImage, color: '#06b6d4', color2: '#3b82f6' },
  video: { label: '동영상', icon: FileVideo, color: '#f43f5e', color2: '#ec4899' },
  audio: { label: '오디오', icon: FileAudio, color: '#f59e0b', color2: '#eab308' },
  zip: { label: '압축 파일', icon: Archive, color: '#a16207', color2: '#ca8a04' },
  design: { label: 'Figma 디자인', icon: PenTool, color: '#a855f7', color2: '#ec4899' },
  code: { label: '코드', icon: Braces, color: '#6366f1', color2: '#22d3ee' },
  text: { label: '텍스트', icon: FileText, color: '#94a3b8', color2: '#64748b' },
  other: { label: '파일', icon: File, color: '#94a3b8', color2: '#64748b' },
}

const EXT_KIND: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', hwp: 'doc', pages: 'doc', rtf: 'doc',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', numbers: 'sheet',
  ppt: 'slide', pptx: 'slide', key: 'slide',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image', avif: 'image',
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video', mkv: 'video',
  mp3: 'audio', m4a: 'audio', wav: 'audio', aac: 'audio', ogg: 'audio',
  zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip',
  fig: 'design', sketch: 'design', xd: 'design',
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code', json: 'code', yml: 'code', yaml: 'code', sql: 'code', py: 'code', go: 'code', kt: 'code', sh: 'code', html: 'code', css: 'code',
  txt: 'text', md: 'text', log: 'text',
}

export function extOf(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function baseName(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

export function kindOf(item: Pick<FileItem, 'kind' | 'name' | 'mime'>): FileKind {
  if (item.kind === 'folder') return 'folder'
  const byExt = EXT_KIND[extOf(item.name)]
  if (byExt) return byExt
  const m = item.mime ?? ''
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'application/pdf') return 'pdf'
  if (m.startsWith('text/')) return 'text'
  return 'other'
}

/** Decorative mesh-gradient "artwork" used as thumbnail for seeded images / videos without real data. */
export function artFor(id: string) {
  const a = PALETTE[hashIndex(id, PALETTE.length)]
  const b = PALETTE[hashIndex(id + 'b', PALETTE.length)]
  const c = PALETTE[hashIndex(id + 'c', PALETTE.length)]
  const x = 15 + hashIndex(id + 'x', 50)
  const y = 15 + hashIndex(id + 'y', 50)
  return `radial-gradient(circle at ${x}% ${y}%, ${a} 0, transparent 55%), radial-gradient(circle at ${100 - x}% ${90 - y / 2}%, ${b} 0, transparent 50%), radial-gradient(circle at 50% 110%, ${c} 0, transparent 60%), linear-gradient(135deg, #1e1b4b, #0f172a)`
}

export const TYPE_FILTERS: { id: FileKind | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'doc', label: '문서' },
  { id: 'sheet', label: '스프레드시트' },
  { id: 'slide', label: '프레젠테이션' },
  { id: 'pdf', label: 'PDF' },
  { id: 'image', label: '이미지' },
  { id: 'video', label: '동영상' },
  { id: 'design', label: '디자인' },
]

export const FOLDER_COLORS = ['#8b5cf6', '#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#60a5fa', '#fb7185', '#a3e635']
