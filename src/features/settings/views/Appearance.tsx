import { motion } from 'framer-motion'
import { Check, Moon, Sun, Palette, Sparkles, PanelLeft, Monitor } from 'lucide-react'
import { useCore, toast, type Theme } from '@/store/core'
import { Badge, Button, Progress, Switch, Tabs, ProgressRing } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ACCENTS, accentGradient } from '../constants'
import { useSettings } from '../store'
import type { Density } from '../types'
import { SettingsSection, SettingRow } from '../components/Section'

const THEME_PREVIEW: Record<Theme, { bg: string; side: string; card: string; line: string; text: string; sub: string }> = {
  dark: { bg: '#070810', side: '#11131f', card: '#181b2d', line: 'rgba(255,255,255,0.08)', text: 'rgba(236,238,248,0.9)', sub: 'rgba(152,158,186,0.5)' },
  light: { bg: '#f6f7fb', side: '#ffffff', card: '#ffffff', line: 'rgba(15,23,42,0.08)', text: 'rgba(15,18,34,0.85)', sub: 'rgba(88,96,122,0.35)' },
}

function ThemeMock({ theme }: { theme: Theme }) {
  const c = THEME_PREVIEW[theme]
  return (
    <div className="relative h-36 overflow-hidden rounded-xl" style={{ background: c.bg, border: `1px solid ${c.line}` }}>
      <div className="absolute -right-6 -top-10 h-28 w-28 rounded-full opacity-50 blur-2xl" style={{ background: 'rgb(var(--accent))' }} />
      <div className="absolute -bottom-12 left-10 h-24 w-24 rounded-full opacity-40 blur-2xl" style={{ background: 'rgb(var(--accent-2))' }} />
      <div className="absolute bottom-0 left-0 top-0 w-14 p-2" style={{ background: c.side, borderRight: `1px solid ${c.line}` }}>
        <div className="mb-2 h-4 w-4 rounded-md bg-accent-gradient" />
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="mb-1.5 h-1.5 rounded-full" style={{ background: i === 1 ? 'rgb(var(--accent))' : c.sub, width: `${[80, 70, 60, 75, 50][i]}%` }} />)}
      </div>
      <div className="absolute left-16 right-2 top-2 h-4 rounded-md" style={{ background: c.card, border: `1px solid ${c.line}` }} />
      <div className="absolute left-16 right-2 top-8 grid grid-cols-3 gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-lg p-1.5" style={{ background: c.card, border: `1px solid ${c.line}` }}>
            <div className="mb-1 h-1.5 w-2/3 rounded-full" style={{ background: c.text }} />
            <div className="h-1 w-1/2 rounded-full" style={{ background: c.sub }} />
            <div className="mt-2 h-1 rounded-full bg-accent-gradient" style={{ width: `${[70, 45, 85][i]}%` }} />
          </div>
        ))}
      </div>
      <div className="absolute bottom-2 left-16 right-2 h-12 rounded-lg" style={{ background: c.card, border: `1px solid ${c.line}` }}>
        <div className="flex h-full items-end gap-1 p-2">
          {[40, 65, 35, 80, 55, 90, 60].map((h, i) => <div key={i} className="flex-1 rounded-sm bg-accent-gradient opacity-80" style={{ height: `${h}%` }} />)}
        </div>
      </div>
    </div>
  )
}

const DENSITY: { id: Density; label: string; gap: number }[] = [
  { id: 'compact', label: '촘촘하게', gap: 3 },
  { id: 'comfortable', label: '기본', gap: 6 },
  { id: 'spacious', label: '넉넉하게', gap: 9 },
]

export function AppearanceSettings() {
  const theme = useCore((s) => s.theme)
  const setTheme = useCore((s) => s.setTheme)
  const accent = useCore((s) => s.accent)
  const setAccent = useCore((s) => s.setAccent)
  const reduceMotion = useCore((s) => s.reduceMotion)
  const setReduceMotion = useCore((s) => s.setReduceMotion)
  const collapsed = useCore((s) => s.sidebarCollapsed)
  const toggleSidebar = useCore((s) => s.toggleSidebar)
  const density = useSettings((s) => s.density)
  const setDensity = useSettings((s) => s.setDensity)

  return (
    <>
      <SettingsSection title="테마" description="Nexus의 전체 색상 모드를 선택하세요." icon={<Moon />}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['dark', 'light'] as Theme[]).map((t) => {
            const on = theme === t
            return (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn('group relative rounded-2xl border p-2.5 text-left transition-all', on ? 'border-accent/60 bg-accent/[0.06] shadow-glow' : 'border-line/10 hover:-translate-y-0.5 hover:border-line/25')}
              >
                <ThemeMock theme={t} />
                <div className="flex items-center gap-2 px-1.5 pb-0.5 pt-3">
                  {t === 'dark' ? <Moon className="h-4 w-4 text-accent" /> : <Sun className="h-4 w-4 text-warning" />}
                  <span className="text-sm font-semibold">{t === 'dark' ? '다크' : '라이트'}</span>
                  <span className="text-xs text-muted">{t === 'dark' ? '눈이 편안한 기본 모드' : '밝고 선명한 화면'}</span>
                  {on && (
                    <motion.span layoutId="theme-check" className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent-gradient text-white">
                      <Check className="h-3 w-3" />
                    </motion.span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => {
            const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
            setTheme(dark ? 'dark' : 'light')
            toast(`시스템 설정에 맞춰 ${dark ? '다크' : '라이트'} 모드를 적용했어요`, { emoji: '🖥️' })
          }}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted transition hover:text-accent"
        >
          <Monitor className="h-3.5 w-3.5" />시스템 설정 따르기
        </button>
      </SettingsSection>

      <SettingsSection title="액센트 색상" description="버튼, 강조, 그라디언트에 쓰이는 색상이에요. 즉시 미리보기됩니다." icon={<Palette />} delay={0.05}>
        <div className="flex flex-wrap gap-4">
          {ACCENTS.map((a) => {
            const on = accent === a.id
            return (
              <button key={a.id} onClick={() => setAccent(a.id)} className="group flex flex-col items-center gap-2">
                <span className={cn('relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300', on ? 'scale-110' : 'group-hover:scale-105')} style={{ background: accentGradient(a), boxShadow: on ? `0 0 0 3px rgb(var(--bg)), 0 0 0 5px ${a.from}, 0 10px 30px -6px ${a.from}` : `0 8px 20px -10px ${a.from}` }}>
                  {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="h-6 w-6 text-white drop-shadow" /></motion.span>}
                </span>
                <span className={cn('text-xs', on ? 'font-semibold text-fg' : 'text-muted')}>{a.label}</span>
              </button>
            )
          })}
        </div>

        {/* live preview */}
        <div className="mt-6 grid gap-4 rounded-2xl border border-line/10 bg-line/[0.03] p-5 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-subtle"><Sparkles className="h-3.5 w-3.5 text-accent" />미리보기</div>
            <div className="font-display text-xl font-bold"><span className="gradient-text">Aurora Labs</span>에 오신 것을 환영해요</div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary">기본 버튼</Button>
              <Button size="sm" variant="outline">아웃라인</Button>
              <Badge tone="accent" dot>진행 중</Badge>
              <Badge tone="cyan">디자인</Badge>
              <Badge tone="pink">긴급</Badge>
              <Switch checked onChange={() => {}} size="sm" />
            </div>
            <Progress value={68} />
          </div>
          <ProgressRing value={72} size={88} stroke={8}><span className="font-display text-base">72%</span></ProgressRing>
        </div>
      </SettingsSection>

      <SettingsSection title="레이아웃 & 모션" icon={<PanelLeft />} delay={0.1}>
        <SettingRow label="사이드바 접기" description="아이콘만 보이도록 사이드바를 좁혀요. 단축키 [ · 화면 폭이 1024px 미만이면 자동으로 접혀요.">
          <Switch checked={collapsed} onChange={() => toggleSidebar()} />
        </SettingRow>
        <SettingRow label="사이드바 밀도" description="메뉴 항목 사이의 간격을 조절해요.">
          <Tabs<Density> size="sm" value={density} onChange={setDensity} items={DENSITY.map((d) => ({ value: d.id, label: d.label }))} />
        </SettingRow>
        <div className="grid grid-cols-3 gap-3 pb-4">
          {DENSITY.map((d) => (
            <button key={d.id} onClick={() => setDensity(d.id)} className={cn('rounded-xl border p-3 transition', density === d.id ? 'border-accent/50 bg-accent/[0.06]' : 'border-line/10 hover:border-line/25')}>
              <div className="flex flex-col" style={{ gap: d.gap }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-sm', i === 0 ? 'bg-accent' : 'bg-line/20')} />
                    <span className={cn('h-1.5 rounded-full', i === 0 ? 'bg-accent/60' : 'bg-line/15')} style={{ width: `${[70, 55, 62, 48][i]}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-muted">{d.label}</div>
            </button>
          ))}
        </div>
        <SettingRow label="모션 줄이기" description="화면 전환과 애니메이션 효과를 최소화해요.">
          <Switch checked={reduceMotion} onChange={setReduceMotion} />
        </SettingRow>
      </SettingsSection>
    </>
  )
}
