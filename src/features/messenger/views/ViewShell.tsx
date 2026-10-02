import type { ReactNode } from 'react'
import { SidebarToggle } from '../components/SidebarToggle'

export function ViewShell({ icon, title, subtitle, actions, children }: { icon: ReactNode; title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-line/[0.07] bg-surface/25 px-5 backdrop-blur-xl">
        <SidebarToggle />
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-accent-gradient opacity-50 blur-md" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-glow-sm [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] font-bold tracking-tight">{title}</div>
          {subtitle && <div className="truncate text-[12px] text-muted">{subtitle}</div>}
        </div>
        {actions}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 py-5">{children}</div>
      </div>
    </div>
  )
}
