import { Moon, Sun } from 'lucide-react'
import { useCore } from '@/store/core'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useCore((s) => s.theme)
  const toggle = useCore((s) => s.toggleTheme)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className={cn('focus-ring flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-line/[0.06] hover:text-fg', className)}
    >
      {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}
