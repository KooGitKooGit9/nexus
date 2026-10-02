import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Command } from 'cmdk'
import { ArrowDown, ArrowUp, CornerDownLeft, Search, Sparkles, Clock, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCore, useUI } from '@/store/core'
import { Avatar, Kbd, PRESENCE_COLOR, useLivePresence } from '@/components/ui'
import { buildCommands, groupEmoji, loadRecent, pushRecent, searchAll, type PaletteItem, type RecentEntry } from './palette/catalog'
import { scoreMatch } from './palette/match'

interface Section {
  key: string
  heading: ReactNode
  items: PaletteItem[]
}

export function CommandPalette() {
  const open = useUI((s) => s.commandOpen)
  const setOpen = useUI((s) => s.setCommandOpen)
  return createPortal(
    <AnimatePresence>{open && <PaletteDialog key="palette" onClose={() => setOpen(false)} />}</AnimatePresence>,
    document.body,
  )
}

function Heading({ emoji, label, count }: { emoji?: string; label: string; count?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {emoji && <span className="text-[12px] leading-none">{emoji}</span>}
      {label}
      {count !== undefined && <span className="rounded-full bg-line/[0.07] px-1.5 text-[10px] font-medium text-subtle">{count}</span>}
    </span>
  )
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const [selected, setSelected] = useState('')
  const [recent] = useState<RecentEntry[]>(() => loadRecent())
  // subscribe so dynamic subtitles (theme / accent / sidebar) stay current
  const theme = useCore((s) => s.theme)
  const accent = useCore((s) => s.accent)
  const collapsed = useCore((s) => s.sidebarCollapsed)
  const users = useCore((s) => s.users)

  const cmds = useMemo(() => buildCommands(navigate), [navigate, theme, accent, collapsed])
  const allCmds = useMemo(() => [...cmds.go, ...cmds.create, ...cmds.settings], [cmds])

  const sections = useMemo<Section[]>(() => {
    const askItem = (prompt: string, title = `AI에게 묻기: "${prompt}"`, subtitle = 'Nexus AI가 워크스페이스 데이터를 분석해 답해요'): PaletteItem => ({
      id: `ai:${prompt}`, title, subtitle, icon: Sparkles, tile: 'ai', run: () => useUI.getState().askAI(prompt),
    })

    if (!q) {
      const out: Section[] = []
      const rec = recent
        .map<PaletteItem | null>((r) => {
          const c = allCmds.find((x) => x.id === r.id)
          if (c) return c
          if (r.href) return { id: r.id, title: r.title, subtitle: r.subtitle, emoji: r.emoji, userId: r.userId, href: r.href, run: () => navigate(r.href!) }
          if (r.id.startsWith('ai:')) return askItem(r.id.slice(3))
          return null
        })
        .filter((x): x is PaletteItem => !!x)
      if (rec.length) out.push({ key: 'recent', heading: <Heading emoji="🕘" label="최근" />, items: rec })
      const pick = (id: string) => allCmds.find((c) => c.id === id)
      out.push({
        key: 'suggest',
        heading: <Heading emoji="✨" label="추천" />,
        items: [
          askItem('오늘 브리핑', '오늘 하루 브리핑 받기', 'AI가 일정 · 태스크 · 결재를 한눈에 정리해요'),
          pick('new:task'), pick('new:event'), pick('go:/messages'),
        ].filter((x): x is PaletteItem => !!x),
      })
      out.push({ key: 'go', heading: <Heading emoji="🧭" label="이동" />, items: cmds.go })
      out.push({ key: 'create', heading: <Heading emoji="➕" label="만들기" />, items: cmds.create })
      out.push({ key: 'settings', heading: <Heading emoji="⚙️" label="설정" />, items: cmds.settings })
      return out
    }

    const rank = (items: PaletteItem[], limit: number) =>
      items
        .map((it) => ({ it, s: scoreMatch(q, it.title, it.subtitle, ...(it.keywords ?? [])) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, limit)
        .map((x) => x.it)

    const out: Section[] = []
    const go = rank(cmds.go, 5)
    const create = rank(cmds.create, 4)
    const settings = rank(cmds.settings, 5)

    const people = users
      .map((u) => ({ u, s: scoreMatch(q, u.name, u.nameEn, u.title, u.department, u.email.split('@')[0]) }))
      .filter((x) => x.s >= 40)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map<PaletteItem>(({ u }) => ({
        id: `person:${u.id}`, title: u.name, subtitle: `${u.title} · ${u.department}`, userId: u.id, href: `/people/${u.id}`,
        run: () => navigate(`/people/${u.id}`),
      }))
    const peopleHrefs = new Set(people.map((p) => p.href))

    const results = searchAll(q).filter((r) => !peopleHrefs.has(r.href))
    const groups = new Map<string, PaletteItem[]>()
    for (const r of results) {
      const arr = groups.get(r.group) ?? []
      if (arr.length >= 6) continue
      arr.push({ id: `res:${r.group}:${r.id}`, title: r.title, subtitle: r.subtitle, emoji: r.emoji ?? groupEmoji(r.group), href: r.href, run: () => navigate(r.href) })
      groups.set(r.group, arr)
    }

    // Strong command matches first (e.g. "테마"), then content.
    const strongCmd = [...go, ...create, ...settings].some((c) => scoreMatch(q, c.title) >= 50)
    const cmdSections = ([
      go.length ? { key: 'go', heading: <Heading emoji="🧭" label="이동" />, items: go } : null,
      create.length ? { key: 'create', heading: <Heading emoji="➕" label="만들기" />, items: create } : null,
      settings.length ? { key: 'settings', heading: <Heading emoji="⚙️" label="설정" />, items: settings } : null,
    ] as (Section | null)[]).filter((x): x is Section => !!x)
    const contentSections: Section[] = [
      ...(people.length ? [{ key: 'people', heading: <Heading emoji="👤" label="사람" count={people.length} />, items: people }] : []),
      ...[...groups.entries()].map(([g, items]) => ({ key: `g:${g}`, heading: <Heading emoji={groupEmoji(g)} label={g} count={items.length} />, items })),
    ]
    if (strongCmd) out.push(...cmdSections, ...contentSections)
    else out.push(...contentSections, ...cmdSections)
    out.push({ key: 'ai', heading: <Heading emoji="🤖" label="Nexus AI" />, items: [askItem(q)] })
    return out
  }, [q, cmds, allCmds, users, recent, navigate])

  const onlyAi = sections.length === 1 && sections[0].key === 'ai'

  const choose = (item: PaletteItem) => {
    pushRecent({ id: item.id, title: item.title, subtitle: item.subtitle, emoji: item.emoji, href: item.href, userId: item.userId })
    onClose()
    // let the palette start closing before heavy route transitions
    requestAnimationFrame(() => item.run())
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[11vh]">
      <motion.div
        className="absolute inset-0 bg-black/45 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label="커맨드 팔레트"
        className="relative w-full max-w-[680px]"
        initial={{ opacity: 0, scale: 0.96, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -6, transition: { duration: 0.14 } }}
        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
      >
        {/* glow halo */}
        <div className="pointer-events-none absolute -inset-px rounded-[26px] bg-accent-gradient-3 opacity-40 blur-xl" />
        <div className="pointer-events-none absolute -inset-px rounded-[26px] bg-gradient-to-b from-accent/40 via-line/10 to-accent-2/20" />
        <Command
          label="커맨드 팔레트"
          shouldFilter={false}
          loop
          value={selected}
          onValueChange={setSelected}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              // don't let window-level Esc handlers (AI panel, modals) also close underneath the palette
              e.stopPropagation()
              if (query) setQuery('')
              else onClose()
            }
            if (e.key === 'Tab' && query.trim()) {
              e.preventDefault()
              const p = query.trim()
              pushRecent({ id: `ai:${p}`, title: `AI에게 묻기: "${p}"` })
              onClose()
              useUI.getState().askAI(p)
            }
          }}
          className="relative overflow-hidden rounded-[25px] glass-strong shadow-float"
        >
          {/* input */}
          <div className="relative flex items-center gap-3 px-5">
            <Search className="h-5 w-5 shrink-0 text-accent" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="무엇이든 검색하거나 명령을 입력하세요…"
              className="h-[60px] flex-1 bg-transparent text-[17px] text-fg outline-none placeholder:text-subtle"
            />
            {query && (
              <button onClick={() => setQuery('')} className="rounded-md px-1.5 py-0.5 text-[11px] text-subtle hover:bg-line/10 hover:text-fg">
                지우기
              </button>
            )}
            <Kbd className="h-6 px-2 text-[11px]">esc</Kbd>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

          <Command.List
            className={cn(
              'max-h-[min(58vh,520px)] overflow-y-auto overscroll-contain px-2 py-2 scroll-py-2',
              '[&_[cmdk-group]]:pb-1.5',
              '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-subtle',
            )}
          >
            {onlyAi && (
              <div className="flex flex-col items-center gap-1.5 px-6 pb-3 pt-5 text-center">
                <div className="text-2xl">🔭</div>
                <div className="text-sm font-medium">"{q}"에 대한 결과가 없어요</div>
                <div className="text-xs text-muted">다른 키워드를 시도하거나, Nexus AI에게 물어보세요.</div>
              </div>
            )}
            {sections.map((sec) => (
              <Command.Group key={sec.key} heading={sec.heading}>
                {sec.items.map((item) => {
                  const value = `${sec.key}|${item.id}`
                  return <Row key={value} value={value} item={item} active={selected === value} onSelect={() => choose(item)} recent={sec.key === 'recent'} />
                })}
              </Command.Group>
            ))}
          </Command.List>

          {/* footer */}
          <div className="flex items-center gap-4 border-t border-line/[0.08] bg-line/[0.025] px-4 py-2.5 text-[11px] text-subtle">
            <span className="flex items-center gap-1.5"><Kbd><ArrowUp className="h-3 w-3" /></Kbd><Kbd><ArrowDown className="h-3 w-3" /></Kbd>이동</span>
            <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="h-3 w-3" /></Kbd>선택</span>
            <span className="hidden items-center gap-1.5 sm:flex"><Kbd>tab</Kbd>AI에게 묻기</span>
            <span className="ml-auto hidden items-center gap-1.5 sm:flex">
              <Wand2 className="h-3.5 w-3.5 text-accent" />
              <span className="font-medium text-muted">Nexus</span>
              <Kbd>⌘</Kbd><Kbd>K</Kbd>
            </span>
          </div>
        </Command>
      </motion.div>
    </div>
  )
}

function Row({ value, item, active, onSelect, recent }: { value: string; item: PaletteItem; active: boolean; onSelect: () => void; recent?: boolean }) {
  const Icon = item.icon
  const isAi = item.tile === 'ai'
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg/90 outline-none data-[selected=true]:text-fg"
    >
      {active && (
        <motion.div
          layoutId="palette-active"
          className="absolute inset-0 rounded-xl border border-accent/25 bg-gradient-to-r from-accent/[0.16] via-accent-2/[0.07] to-transparent"
          transition={{ type: 'spring', stiffness: 700, damping: 45 }}
        >
          <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent-gradient shadow-glow-sm" />
        </motion.div>
      )}

      {/* icon tile */}
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        {item.userId ? (
          <Avatar userId={item.userId} size="sm" showPresence />
        ) : (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-[10px] border border-line/10 transition-colors',
              isAi ? 'bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x text-white border-transparent'
                : item.tile ? 'border-transparent text-white'
                  : active ? 'bg-accent-gradient text-white border-transparent shadow-glow-sm' : 'bg-line/[0.05] text-muted',
            )}
            style={item.tile && !isAi ? { background: item.tile } : undefined}
          >
            {item.emoji ? <span className="text-[15px] leading-none">{item.emoji}</span> : Icon ? <Icon className="h-4 w-4" /> : null}
          </span>
        )}
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="block truncate font-medium">{item.title}</span>
        {item.subtitle && <span className="block truncate text-[11.5px] text-muted">{item.subtitle}</span>}
      </span>

      <span className="relative flex shrink-0 items-center gap-1.5 text-[11px] text-subtle">
        {recent && <Clock className="h-3.5 w-3.5" />}
        {item.hotkey && (
          <span className="flex items-center gap-1">
            <Kbd>G</Kbd><span className="text-[10px]">then</span><Kbd>{item.hotkey.toUpperCase()}</Kbd>
          </span>
        )}
        {item.shortcut && <span className="flex items-center gap-1">{item.shortcut.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
        {item.userId && <UserPresence userId={item.userId} />}
        {active && (
          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="ml-1 flex h-5 w-5 items-center justify-center rounded-md bg-accent/20 text-accent">
            <CornerDownLeft className="h-3 w-3" />
          </motion.span>
        )}
      </span>
    </Command.Item>
  )
}

function UserPresence({ userId }: { userId: string }) {
  const u = useCore((s) => s.users.find((x) => x.id === userId))
  const presence = useLivePresence(u)
  if (!u) return null
  return (
    <span className="flex items-center gap-1.5">
      {u.statusEmoji && <span>{u.statusEmoji}</span>}
      <span className={cn('h-1.5 w-1.5 rounded-full', PRESENCE_COLOR[presence])} />
    </span>
  )
}
