import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsNarrow } from '@/lib/useMediaQuery'
import { useCore, useUI, toggleSidebarResponsive } from '@/store/core'
import { useWorkspace } from '@/lib/workspace'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { Tooltip, CountBadge } from '@/components/ui'
import { NAV, SECTION_LABEL } from './nav'
import { useSidebarBadges } from './badges'
import { useSettings } from '@/features/settings/store'

const DENSITY_ROW = { compact: 'h-8', comfortable: 'h-10', spacious: 'h-11' } as const
export const RAIL_WIDTH = 72
export const SIDEBAR_WIDTH = 248
const SPRING = { type: 'spring', stiffness: 420, damping: 42 } as const

export function Sidebar() {
  const workspace = useWorkspace()
  const pref = useCore((s) => s.sidebarCollapsed)
  const narrow = useIsNarrow()
  const peek = useUI((s) => s.sidebarPeek)
  const setPeek = useUI((s) => s.setSidebarPeek)
  const openAI = useUI((s) => s.setAiOpen)
  const badges = useSidebarBadges()
  const loc = useLocation()
  const density = useSettings((s) => s.density)

  /** On narrow viewports the sidebar is a rail; `[` temporarily expands it over the content. */
  const collapsed = narrow ? !peek : pref
  const overlay = narrow && peek

  useEffect(() => { setPeek(false) }, [loc.pathname, setPeek])
  useEffect(() => { if (!narrow) setPeek(false) }, [narrow, setPeek])
  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPeek(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, setPeek])

  let lastSection = ''
  return (
    <div className="relative z-30 h-full shrink-0" style={narrow ? { width: RAIL_WIDTH } : undefined}>
      <AnimatePresence>
        {overlay && (
          <motion.div
            key="sidebar-scrim"
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPeek(false)}
          />
        )}
      </AnimatePresence>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH }}
        transition={SPRING}
        aria-label="주 메뉴"
        className={cn(
          'flex h-full flex-col overflow-hidden border-r border-line/[0.07] bg-surface/40 backdrop-blur-2xl',
          narrow ? 'absolute inset-y-0 left-0' : 'relative',
          overlay && 'bg-surface/95 shadow-float',
        )}
      >
        {/* Workspace header */}
        <div className={cn('flex h-16 shrink-0 items-center', collapsed ? 'justify-center' : 'gap-3 pl-4 pr-3')}>
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-accent-gradient blur-md opacity-70" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x text-white font-display font-bold text-lg shadow-glow">
              N
            </div>
          </div>
          {!collapsed && (
            <>
              <WorkspaceSwitcher>
                <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }} className="min-w-0 flex-1">
                  <div className="font-display font-bold text-[15px] leading-tight tracking-tight truncate">{workspace.name}</div>
                  <div className="text-[11px] text-muted truncate">{workspace.kind === 'demo' ? '데모 워크스페이스' : 'Nexus'}</div>
                </motion.div>
              </WorkspaceSwitcher>
              <Tooltip content={<span>사이드바 접기 <span className="ml-1 text-white/50">[</span></span>} side="bottom">
                <button
                  onClick={toggleSidebarResponsive}
                  aria-label="사이드바 접기"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle transition hover:bg-line/[0.08] hover:text-fg"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
              </Tooltip>
            </>
          )}
        </div>

        <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden pb-3 pt-1 scrollbar-none', collapsed ? 'px-4' : 'px-3')}>
          {NAV.map((item) => {
            const showSection = item.section !== lastSection && SECTION_LABEL[item.section]
            lastSection = item.section
            const active = item.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(item.path)
            const Icon = item.icon
            const count = badges[item.path] ?? 0
            const link = (
              <NavLink
                to={item.path}
                aria-label={collapsed ? item.label : undefined}
                className={cn(
                  'group relative flex items-center rounded-xl text-[13.5px] font-medium transition-colors focus-ring',
                  collapsed ? 'h-10 w-10 justify-center' : cn('w-full gap-3 px-3', DENSITY_ROW[density] ?? 'h-10'),
                  active ? 'text-fg' : 'text-muted hover:text-fg hover:bg-line/[0.05]',
                )}
              >
                {active && (
                  <motion.span
                    layoutId={collapsed ? 'nav-active-rail' : 'nav-active'}
                    style={{ borderRadius: 12 }}
                    className={cn(
                      'absolute inset-0 border border-accent/20',
                      collapsed ? 'bg-gradient-to-br from-accent/25 via-accent/[0.12] to-accent-2/10 shadow-glow-sm' : 'bg-gradient-to-r from-accent/20 via-accent/10 to-transparent',
                    )}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                {active && (
                  <motion.span
                    layoutId={collapsed ? 'nav-bar-rail' : 'nav-bar'}
                    className={cn('absolute w-[3px] rounded-r-full bg-accent-gradient shadow-glow-sm', collapsed ? '-left-4 top-2.5 bottom-2.5' : 'left-0 top-2 bottom-2')}
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon className={cn('relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110', active && 'text-accent')} />
                {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                {count > 0 &&
                  (collapsed ? (
                    <span className="pointer-events-none absolute right-[3px] top-[3px] flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-gradient px-1 text-[9px] font-bold leading-none text-white shadow-glow-sm ring-2 ring-surface">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : (
                    <CountBadge count={count} className="relative" />
                  ))}
              </NavLink>
            )
            const divider = <div className={cn('my-3 h-px bg-line/10', collapsed ? 'mx-auto w-6' : 'mx-3')} />
            return (
              <div key={item.path} className={cn(collapsed && 'py-0.5')}>
                {showSection && (collapsed ? divider : <div className="mt-5 mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-subtle">{SECTION_LABEL[item.section]}</div>)}
                {item.section === 'system' && !showSection && divider}
                {collapsed ? (
                  <Tooltip content={<span>{item.label}{count > 0 && <span className="ml-1.5 text-white/55">{count}</span>}</span>} side="right" className="flex w-10">
                    {link}
                  </Tooltip>
                ) : link}
              </div>
            )
          })}
        </nav>

        {/* Footer: AI promo + expand toggle */}
        <div className={cn('shrink-0 pb-3', collapsed ? 'flex flex-col items-center gap-2 px-4' : 'px-3')}>
          {collapsed ? (
            <>
              <Tooltip content="Nexus AI" side="right" className="flex w-10">
                <button onClick={() => openAI(true)} aria-label="Nexus AI" className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm transition hover:brightness-110">
                  <Sparkles className="h-4 w-4" />
                </button>
              </Tooltip>
              <Tooltip content={<span>사이드바 펼치기 <span className="ml-1 text-white/50">[</span></span>} side="right" className="flex w-10">
                <button onClick={toggleSidebarResponsive} aria-label="사이드바 펼치기" className="flex h-9 w-10 items-center justify-center rounded-xl text-subtle transition hover:bg-line/[0.08] hover:text-fg">
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </Tooltip>
            </>
          ) : (
            <button onClick={() => openAI(true)} className="group relative w-full overflow-hidden rounded-2xl p-[1px] text-left">
              <span className="absolute inset-0 bg-accent-gradient-3 bg-[length:200%_200%] animate-gradient-x opacity-80" />
              <span className="relative flex items-center gap-3 rounded-[15px] bg-surface/90 px-3.5 py-3 backdrop-blur-xl">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-gradient text-white"><Sparkles className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">Nexus AI</span>
                  <span className="block text-[11px] text-muted truncate">요약 · 작성 · 실행을 한 번에</span>
                </span>
              </span>
            </button>
          )}
        </div>
      </motion.aside>
    </div>
  )
}
