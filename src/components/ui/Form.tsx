import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }>(function Input({ className, icon, ...props }, ref) {
  if (!icon) return <input ref={ref} className={cn('input-base', className)} {...props} />
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <input ref={ref} className={cn('input-base pl-9', className)} {...props} />
    </div>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn('input-base min-h-[90px] resize-y leading-relaxed', className)} {...props} />
})

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('input-base appearance-none cursor-pointer pr-8 bg-[length:16px] bg-[right_10px_center] bg-no-repeat', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-subtle">{hint}</span>}
    </label>
  )
}

export function Switch({ checked, onChange, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 'w-8 h-[18px]' : 'w-11 h-6'
  const k = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors focus-ring', w, checked ? 'bg-accent-gradient shadow-glow-sm justify-end' : 'bg-line/15 justify-start')}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={cn('rounded-full bg-white shadow', k)} />
    </button>
  )
}

export function Checkbox({ checked, onChange, className }: { checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
      className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all',
        checked ? 'bg-accent-gradient border-transparent shadow-glow-sm' : 'border-line/25 hover:border-accent/60', className)}
    >
      {checked && (
        <motion.svg initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 12l5 5L20 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
        </motion.svg>
      )}
    </button>
  )
}
