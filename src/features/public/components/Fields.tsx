import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { passwordStrength } from '../lib'

/** Labelled input with inline error/hint — accessible (aria-invalid + aria-describedby). */
export function TextField({
  label,
  error,
  hint,
  right,
  className,
  inputClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string | null; hint?: ReactNode; right?: ReactNode; inputClassName?: string }) {
  const id = useId()
  const descId = `${id}-desc`
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium text-muted">{label}</label>
        {right}
      </div>
      <input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={error || hint ? descId : undefined}
        className={cn('input-base h-11', error && 'border-danger/60 focus:border-danger/70 focus:ring-danger/15', inputClassName)}
        {...props}
      />
      {error ? (
        <p id={descId} role="alert" className="flex items-center gap-1 text-[12px] text-danger"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>
      ) : hint ? (
        <p id={descId} className="text-[11.5px] text-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

/** Password input with show/hide toggle and optional strength meter. */
export function PasswordField({
  label = '비밀번호',
  value,
  onChange,
  onBlur,
  error,
  meter,
  autoComplete = 'current-password',
  placeholder,
  right,
  autoFocus,
  name,
}: {
  label?: ReactNode
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string | null
  meter?: boolean
  autoComplete?: string
  placeholder?: string
  right?: ReactNode
  autoFocus?: boolean
  name?: string
}) {
  const id = useId()
  const descId = `${id}-desc`
  const [show, setShow] = useState(false)
  const st = passwordStrength(value)
  const colors = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium text-muted">{label}</label>
        {right}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={descId}
          className={cn('input-base h-11 pr-11', error && 'border-danger/60 focus:border-danger/70 focus:ring-danger/15')}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
          aria-pressed={show}
          className="focus-ring absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-subtle transition hover:bg-line/10 hover:text-fg"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {meter && value && (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', st.score >= i ? colors[st.score] : 'bg-line/10')} />
            ))}
          </div>
          <span className={cn('w-16 text-right text-[11px] font-medium', st.score <= 1 ? 'text-danger' : st.score === 2 ? 'text-warning' : 'text-success')}>{st.label}</span>
        </div>
      )}
      <div id={descId}>
        {error ? (
          <p role="alert" className="flex items-center gap-1 text-[12px] text-danger"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>
        ) : meter ? (
          <p className="text-[11.5px] text-subtle">8자 이상 · 영문 대소문자, 숫자, 기호를 섞으면 더 안전해요.</p>
        ) : null}
      </div>
    </div>
  )
}

/** Native checkbox row (never pre-checked by default — callers own the state). */
export function ConsentCheck({
  checked,
  onChange,
  children,
  required,
  error,
  link,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  required?: boolean
  error?: boolean
  link?: { href: string; label: string }
}) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition', error && 'bg-danger/[0.06] ring-1 ring-danger/30')}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={error || undefined}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-accent"
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-[12.5px] leading-snug text-fg/85">
        <span className={cn('mr-1 font-semibold', required ? 'text-accent' : 'text-subtle')}>{required ? '[필수]' : '[선택]'}</span>
        {children}
      </label>
      {link && (
        <a href={link.href} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] font-medium text-muted underline underline-offset-2 hover:text-accent">
          {link.label}
        </a>
      )}
    </div>
  )
}

export function FormAlert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'success' | 'info' | 'warning' }) {
  const cls = {
    danger: 'border-danger/30 bg-danger/[0.07] text-danger',
    success: 'border-success/30 bg-success/[0.07] text-success',
    info: 'border-info/30 bg-info/[0.07] text-info',
    warning: 'border-warning/30 bg-warning/[0.07] text-warning',
  }[tone]
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] leading-snug', cls)}>
      <AlertCircle className="mt-px h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 text-fg/90">{children}</div>
    </div>
  )
}
