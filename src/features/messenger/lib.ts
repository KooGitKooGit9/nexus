import { create } from 'zustand'
import { getCurrentUserId, getUser, useCore } from '@/store/core'
import type { Channel, Message } from './types'
import { useMessenger } from './store'

/* ───────────── Channel helpers ───────────── */

export function isDirect(c: Channel) {
  return (c.kind === 'dm' || c.kind === 'group') && !c.isApp
}

/** The "other" members of a DM / group DM (excluding the current user). */
export function otherMembers(c: Channel, me = getCurrentUserId()) {
  const others = c.memberIds.filter((id) => id !== me)
  return others.length ? others : [me]
}

export function channelTitle(c: Channel, me = getCurrentUserId()): string {
  if (c.isApp) return c.name
  if (c.kind === 'dm') {
    const other = otherMembers(c, me)[0]
    const u = getUser(other)
    return other === me ? `${u?.name ?? ''} (나)` : u?.name ?? '알 수 없음'
  }
  if (c.kind === 'group') {
    if (c.name) return c.name
    return otherMembers(c, me).map((id) => getUser(id)?.name ?? '').join(', ')
  }
  return c.name
}

/** Prefix glyph used in inline text, e.g. "#engineering" */
export function channelLabel(c: Channel) {
  return isDirect(c) || c.isApp ? channelTitle(c) : `#${c.name}`
}

export function channelPath(channelId: string, opts: { thread?: string; message?: string } = {}) {
  let p = `/messages/${channelId}`
  if (opts.thread) p += `/thread/${opts.thread}`
  if (opts.message) p += `?m=${opts.message}`
  return p
}

export function threadReplies(messages: Message[], rootId: string) {
  return messages.filter((m) => m.threadId === rootId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
}

export function myName() {
  return getUser(useCore.getState().currentUserId)?.name ?? ''
}

export function getChannel(id: string) {
  return useMessenger.getState().channels.find((c) => c.id === id)
}

/** Turn arbitrary input into a slack-ish channel slug. */
export function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣_-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

/* ───────────── Ephemeral chat UI state ───────────── */

interface ChatUIState {
  /** typing user ids per key (channelId or `thread:<rootId>`) */
  typing: Record<string, string[]>
  editingId: string | null
  highlightId: string | null
  infoOpen: boolean
  searchQuery: string
  searchOpen: boolean
  /** messenger container is narrower than ~900px → sidebar becomes an overlay, side panels float */
  narrow: boolean
  /** overlay sidebar visibility (narrow mode only) */
  sidebarOpen: boolean
  setNarrow: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  setTyping: (key: string, userId: string, on: boolean) => void
  setEditing: (id: string | null) => void
  flash: (id: string) => void
  setInfoOpen: (v: boolean) => void
  setSearch: (q: string, open?: boolean) => void
  setSearchOpen: (v: boolean) => void
}

export const useChatUI = create<ChatUIState>()((set, get) => ({
  typing: {},
  editingId: null,
  highlightId: null,
  infoOpen: false,
  searchQuery: '',
  searchOpen: false,
  narrow: false,
  sidebarOpen: false,
  setNarrow: (narrow) => {
    if (get().narrow !== narrow) set({ narrow, sidebarOpen: false })
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setTyping: (key, userId, on) =>
    set((s) => {
      const cur = s.typing[key] ?? []
      const next = on ? (cur.includes(userId) ? cur : [...cur, userId]) : cur.filter((u) => u !== userId)
      return { typing: { ...s.typing, [key]: next } }
    }),
  setEditing: (editingId) => set({ editingId }),
  flash: (id) => {
    set({ highlightId: id })
    setTimeout(() => get().highlightId === id && set({ highlightId: null }), 2200)
  },
  setInfoOpen: (infoOpen) => set({ infoOpen }),
  setSearch: (searchQuery, open) => set((s) => ({ searchQuery, searchOpen: open ?? s.searchOpen })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
}))

const EMPTY: string[] = []
export function useTyping(key: string) {
  return useChatUI((s) => s.typing[key] ?? EMPTY)
}

/* ───────────── Files ───────────── */

export function fileKind(mime: string, name: string): 'image' | 'pdf' | 'sheet' | 'doc' | 'slide' | 'figma' | 'zip' | 'video' | 'audio' | 'code' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(ext)) return 'sheet'
  if (['doc', 'docx', 'txt', 'md', 'pages', 'hwp'].includes(ext)) return 'doc'
  if (['ppt', 'pptx', 'key'].includes(ext)) return 'slide'
  if (ext === 'fig') return 'figma'
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return 'zip'
  if (['ts', 'tsx', 'js', 'json', 'py', 'go', 'kt', 'sql', 'yml', 'yaml', 'sh'].includes(ext)) return 'code'
  return 'file'
}
