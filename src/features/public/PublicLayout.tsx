import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { BRAND } from '@/config/brand'
import { useMe } from '@/lib/workspace'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Logo } from './components/Logo'
import { ThemeToggle } from './components/ThemeToggle'
import { useReduce, useThemeSync } from './lib'

const NAV: { label: string; section?: string; to?: string }[] = [
  { label: '기능', section: 'features' },
  { label: 'AI 비서', section: 'ai' },
  { label: '보안', section: 'security' },
  { label: '요금제', to: '/pricing' },
]

/** Scroll the landing page to a section (navigates home first when needed). */
export function useGoSection() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const reduce = useReduce()
  return (id: string) => {
    if (pathname !== '/') {
      navigate('/', { state: { scrollTo: id } })
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }
}

function Header({ scrolled }: { scrolled: boolean }) {
  const me = useMe()
  const loggedIn = !!me?.account
  const go = useGoSection()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  return (
    <header className={cn('sticky top-0 z-50 transition-all duration-300', scrolled ? 'border-b border-line/[0.08] bg-bg/70 backdrop-blur-xl' : 'border-b border-transparent')}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="focus-ring rounded-xl" aria-label={`${BRAND.name} 홈`}>
          <Logo />
        </Link>
        <nav aria-label="주요 메뉴" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) =>
            n.to ? (
              <Link key={n.label} to={n.to} className={cn('focus-ring rounded-lg px-3 py-2 text-[14px] font-medium transition hover:text-fg', pathname === n.to ? 'text-fg' : 'text-muted')}>
                {n.label}
              </Link>
            ) : (
              <button key={n.label} type="button" onClick={() => go(n.section!)} className="focus-ring rounded-lg px-3 py-2 text-[14px] font-medium text-muted transition hover:text-fg">
                {n.label}
              </button>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          {loggedIn ? (
            <Button variant="primary" size="sm" className="h-9 px-4" rightIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => location.assign('/')}>
              <span className="hidden sm:inline">워크스페이스로&nbsp;</span>이동
            </Button>
          ) : (
            <>
              <Link to="/login" className="focus-ring hidden rounded-xl px-3 py-2 text-[14px] font-medium text-muted transition hover:text-fg sm:inline-flex">
                로그인
              </Link>
              <Link to="/signup" className="focus-ring hidden sm:inline-flex">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-accent-gradient px-4 text-[13.5px] font-semibold text-white shadow-glow-sm transition hover:shadow-glow hover:brightness-110">
                  무료로 시작하기
                </span>
              </Link>
            </>
          )}
          <button
            type="button"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-line/[0.06] hover:text-fg md:hidden"
            aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            aria-label="모바일 메뉴"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong mx-3 mb-3 rounded-2xl p-2 shadow-float md:hidden"
          >
            {NAV.map((n) =>
              n.to ? (
                <Link key={n.label} to={n.to} className="block rounded-xl px-4 py-3 text-[15px] font-medium hover:bg-line/[0.05]">{n.label}</Link>
              ) : (
                <button key={n.label} type="button" onClick={() => { setOpen(false); go(n.section!) }} className="block w-full rounded-xl px-4 py-3 text-left text-[15px] font-medium hover:bg-line/[0.05]">
                  {n.label}
                </button>
              ),
            )}
            {!loggedIn && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line/[0.08] pt-3">
                <Link to="/login" className="flex h-11 items-center justify-center rounded-xl border border-line/15 text-[14px] font-medium">로그인</Link>
                <Link to="/signup" className="flex h-11 items-center justify-center rounded-xl bg-accent-gradient text-[14px] font-semibold text-white shadow-glow-sm">무료로 시작하기</Link>
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

export function Footer() {
  const c = BRAND.company
  const go = useGoSection()
  const year = new Date().getFullYear()
  return (
    <footer className="relative border-t border-line/[0.08] bg-surface/40 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed text-muted break-keep">{BRAND.tagline}. 한국 팀을 위한 올인원 워크스페이스.</p>
          </div>
          <div>
            <h2 className="text-[12px] font-semibold tracking-wide text-subtle">제품</h2>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li><button type="button" onClick={() => go('features')} className="text-muted hover:text-fg">기능</button></li>
              <li><button type="button" onClick={() => go('ai')} className="text-muted hover:text-fg">Nexus AI</button></li>
              <li><Link to="/pricing" className="text-muted hover:text-fg">요금제</Link></li>
              <li><Link to="/signup" className="text-muted hover:text-fg">무료로 시작하기</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-[12px] font-semibold tracking-wide text-subtle">지원</h2>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li><a href={`mailto:${BRAND.supportEmail}`} className="break-all text-muted hover:text-fg">{BRAND.supportEmail}</a></li>
              <li><Link to="/forgot" className="text-muted hover:text-fg">비밀번호 찾기</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-[12px] font-semibold tracking-wide text-subtle">정책</h2>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li><Link to="/legal/terms" className="text-muted hover:text-fg">이용약관</Link></li>
              <li><Link to="/legal/privacy" className="font-bold text-fg hover:text-accent">개인정보처리방침</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-line/[0.08] pt-6 text-[12px] leading-relaxed text-subtle">
          <p className="break-keep">
            상호 {c.legalName} <span className="mx-1.5 opacity-40">|</span> 대표자 {c.ceo} <span className="mx-1.5 opacity-40">|</span> 사업자등록번호 {c.bizNo}
            <span className="mx-1.5 opacity-40">|</span> 통신판매업 신고번호 {c.mailOrderNo}
          </p>
          <p className="mt-1 break-keep">
            주소 {c.address} <span className="mx-1.5 opacity-40">|</span> 개인정보 보호책임자 {c.privacyOfficer} <span className="mx-1.5 opacity-40">|</span> 문의 {BRAND.supportEmail}
          </p>
          <p className="mt-3">© {year} {BRAND.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

/** Header + scroll container + footer for the marketing pages. */
export function PublicLayout() {
  useThemeSync()
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)} className="relative isolate h-full overflow-y-auto overflow-x-hidden">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">본문으로 건너뛰기</a>
        <Header scrolled={scrolled} />
        <main id="main">
          <Outlet />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  )
}
