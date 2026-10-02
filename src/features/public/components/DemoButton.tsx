import { useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { reloadInto } from '@/lib/workspace'
import { Button, type ButtonProps } from '@/components/ui'
import { cn } from '@/lib/utils'
import { errorMessage } from '../lib'

/** Starts a throw-away guest demo (POST /api/demo) and enters the app. */
export function useStartDemo() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.startDemo()
      reloadInto('/')
    } catch (e) {
      setError(errorMessage(e))
      setLoading(false)
    }
  }
  return { start, loading, error }
}

export function DemoButton({ label = '로그인 없이 데모 체험', className, size = 'lg', variant = 'secondary', errorClassName }: { label?: string; className?: string; size?: ButtonProps['size']; variant?: ButtonProps['variant']; errorClassName?: string }) {
  const { start, loading, error } = useStartDemo()
  return (
    <span className="inline-flex flex-col items-stretch gap-1.5">
      <Button type="button" size={size} variant={variant} loading={loading} leftIcon={<PlayCircle className="h-4 w-4" />} onClick={() => void start()} className={className}>
        {loading ? '데모 준비 중…' : label}
      </Button>
      {error && <span role="alert" className={cn('max-w-xs text-[12px] text-danger', errorClassName)}>{error}</span>}
    </span>
  )
}
