import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'text-white bg-accent-gradient shadow-glow-sm hover:shadow-glow hover:brightness-110 active:brightness-95 border border-white/10',
  secondary: 'glass text-fg hover:bg-surface-2/90 hover:border-line/20',
  ghost: 'text-muted hover:text-fg hover:bg-line/[0.06]',
  outline: 'border border-line/15 text-fg hover:border-accent/50 hover:bg-accent/5',
  danger: 'text-white bg-danger/90 hover:bg-danger shadow-[0_8px_24px_-8px_rgb(var(--danger)/0.6)]',
  success: 'text-white bg-success/90 hover:bg-success shadow-[0_8px_24px_-8px_rgb(var(--success)/0.6)]',
}

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-lg',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-2xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-all duration-200 focus-ring',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  )
})
