import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, FilePlus2, FileSignature, ListPlus, MessageSquarePlus, UploadCloud } from 'lucide-react'
import type { ReactNode } from 'react'

const ACTIONS: { label: string; hint: string; icon: ReactNode; to: string; gradient: string; glow: string }[] = [
  { label: '새 메시지', hint: '팀에게 바로 말 걸기', icon: <MessageSquarePlus />, to: '/messages?new=1', gradient: 'from-violet-500 to-fuchsia-500', glow: 'rgb(168 85 247 / .55)' },
  { label: '새 태스크', hint: '할 일 등록', icon: <ListPlus />, to: '/projects?new=1', gradient: 'from-cyan-400 to-blue-600', glow: 'rgb(34 211 238 / .5)' },
  { label: '일정 만들기', hint: '회의 · 포커스 타임', icon: <CalendarPlus />, to: '/calendar?new=1', gradient: 'from-emerald-400 to-teal-600', glow: 'rgb(52 211 153 / .5)' },
  { label: '새 문서', hint: '템플릿으로 시작', icon: <FilePlus2 />, to: '/docs?new=1', gradient: 'from-amber-400 to-orange-600', glow: 'rgb(251 191 36 / .5)' },
  { label: '결재 올리기', hint: '휴가 · 경비 · 구매', icon: <FileSignature />, to: '/approvals?new=1', gradient: 'from-pink-500 to-rose-600', glow: 'rgb(244 114 182 / .5)' },
  { label: '파일 업로드', hint: '드라이브에 저장', icon: <UploadCloud />, to: '/files', gradient: 'from-indigo-500 to-purple-600', glow: 'rgb(129 140 248 / .5)' },
]

export function QuickActions() {
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {ACTIONS.map((a, i) => (
        <motion.button
          key={a.label}
          onClick={() => navigate(a.to)}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.97 }}
          className="group glass relative flex items-center gap-3 overflow-hidden rounded-2xl p-3.5 text-left transition-[border-color,box-shadow] duration-300 hover:border-line/20 focus-ring"
          style={{ ['--qa-glow' as string]: a.glow }}
        >
          <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" style={{ background: a.glow }} />
          <span className="relative">
            <span className={`absolute inset-0 rounded-xl bg-gradient-to-br ${a.gradient} opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-80`} />
            <span className={`relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${a.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] [&>svg]:h-5 [&>svg]:w-5`}>
              {a.icon}
            </span>
          </span>
          <span className="relative min-w-0">
            <span className="block truncate text-[13px] font-semibold text-fg">{a.label}</span>
            <span className="block truncate text-[11px] text-subtle">{a.hint}</span>
          </span>
        </motion.button>
      ))}
    </div>
  )
}
