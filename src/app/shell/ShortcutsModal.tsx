import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Keyboard, Search, Globe, MessagesSquare, CalendarDays, KanbanSquare, type LucideIcon } from 'lucide-react'
import { useUI } from '@/store/core'
import { Kbd, Modal } from '@/components/ui'
import { NAV } from '@/app/nav'

interface Shortcut { keys: string[][]; label: string } // keys: sequence of combos, e.g. [['G'],['M']]
interface Group { title: string; icon: LucideIcon; tone: string; items: Shortcut[] }

const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
const MOD = isMac ? '⌘' : 'Ctrl'

function buildGroups(): Group[] {
  return [
    {
      title: '전역', icon: Globe, tone: 'from-violet-500 to-fuchsia-500',
      items: [
        { keys: [[MOD, 'K']], label: '커맨드 팔레트 열기' },
        { keys: [[MOD, 'J']], label: 'Nexus AI 열기' },
        { keys: [['[']], label: '사이드바 접기 / 펼치기' },
        { keys: [['?']], label: '단축키 도움말' },
        { keys: [['Esc']], label: '패널 / 대화상자 닫기' },
      ],
    },
    {
      title: '이동', icon: Search, tone: 'from-cyan-400 to-blue-600',
      items: NAV.filter((n) => n.hotkey).map((n) => ({ keys: [['G'], [n.hotkey!.toUpperCase()]], label: n.label })),
    },
    {
      title: '메신저', icon: MessagesSquare, tone: 'from-emerald-400 to-teal-600',
      items: [
        { keys: [['Enter']], label: '메시지 전송' },
        { keys: [['Shift', 'Enter']], label: '줄바꿈' },
        { keys: [['↑']], label: '마지막 메시지 편집' },
        { keys: [['@']], label: '멤버 멘션' },
        { keys: [[':']], label: '이모지 검색' },
      ],
    },
    {
      title: '캘린더', icon: CalendarDays, tone: 'from-amber-400 to-orange-600',
      items: [
        { keys: [['T']], label: '오늘로 이동' },
        { keys: [['D']], label: '일 보기' },
        { keys: [['W']], label: '주 보기' },
        { keys: [['M']], label: '월 보기' },
        { keys: [['N']], label: '새 일정' },
      ],
    },
    {
      title: '프로젝트', icon: KanbanSquare, tone: 'from-pink-500 to-rose-600',
      items: [
        { keys: [['C']], label: '새 태스크 만들기' },
        { keys: [['Esc']], label: '태스크 상세 닫기' },
      ],
    },
  ]
}

export function ShortcutsModal() {
  const open = useUI((s) => s.shortcutsOpen)
  const setOpen = useUI((s) => s.setShortcutsOpen)
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const all = buildGroups()
    const t = q.trim().toLowerCase()
    if (!t) return all
    return all
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(t) || i.keys.flat().join(' ').toLowerCase().includes(t) || g.title.includes(t)) }))
      .filter((g) => g.items.length)
  }, [q])

  return (
    <Modal
      open={open}
      onClose={() => { setOpen(false); setQ('') }}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm"><Keyboard className="h-4 w-4" /></span>
          키보드 단축키
        </span>
      }
      description="마우스 없이 Nexus를 빠르게 다뤄보세요."
    >
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="단축키 검색…" className="input-base pl-9" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g, gi) => (
          <motion.div
            key={g.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.04 }}
            className="rounded-2xl border border-line/10 bg-line/[0.03] p-3.5"
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br text-white ${g.tone}`}><g.icon className="h-3.5 w-3.5" /></span>
              <span className="text-[13px] font-semibold">{g.title}</span>
            </div>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <div key={it.label + it.keys.flat().join()} className="flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 text-[12.5px] hover:bg-line/[0.05]">
                  <span className="text-fg/85">{it.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {it.keys.map((combo, ci) => (
                      <span key={ci} className="flex items-center gap-1">
                        {ci > 0 && <span className="text-[10px] text-subtle">then</span>}
                        {combo.map((k) => <Kbd key={k}>{k}</Kbd>)}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
        {groups.length === 0 && <div className="col-span-full py-10 text-center text-sm text-muted">"{q}"에 해당하는 단축키가 없어요</div>}
      </div>
    </Modal>
  )
}
