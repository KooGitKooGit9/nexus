import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ApiError } from '@/lib/api'
import { useCore } from '@/store/core'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(v: string): string | null {
  const s = v.trim()
  if (!s) return '이메일을 입력해 주세요.'
  if (!EMAIL_RE.test(s)) return '이메일 형식이 올바르지 않아요.'
  return null
}

export function validatePassword(v: string): string | null {
  if (!v) return '비밀번호를 입력해 주세요.'
  if (v.length < 8) return '비밀번호는 8자 이상이어야 해요.'
  return null
}

export function validateName(v: string): string | null {
  const s = v.trim()
  if (!s) return '이름을 입력해 주세요.'
  if (s.length > 40) return '이름은 40자 이내로 입력해 주세요.'
  return null
}

/** 0–4 strength score (length, character variety). */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' }
  if (pw.length < 8) return { score: 0, label: '너무 짧아요' }
  let s = 1
  if (pw.length >= 12) s++
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length
  if (kinds >= 2) s++
  if (kinds >= 3 && pw.length >= 10) s++
  if (/^(.)\1+$/.test(pw) || /^(?:12345678|password|qwerty)/i.test(pw)) s = 1
  const score = Math.min(4, s) as 1 | 2 | 3 | 4
  return { score, label: ['너무 짧아요', '약함', '보통', '강함', '매우 강함'][score] }
}

/** Korean message for any thrown value (server messages are already Korean). */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  return '알 수 없는 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
}

/** Split a free-form list of emails (newline, comma, space, semicolon). */
export function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
  const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  const uniq = [...new Set(parts)]
  return { valid: uniq.filter((e) => EMAIL_RE.test(e)), invalid: uniq.filter((e) => !EMAIL_RE.test(e)) }
}

/** OS "reduce motion" OR the in-app setting. */
export function useReduce(): boolean {
  const os = useReducedMotion()
  const app = useCore((s) => s.reduceMotion)
  return !!os || app
}

/** Apply the persisted theme/accent outside the app shell (public pages, onboarding, invite). */
export function useThemeSync() {
  const theme = useCore((s) => s.theme)
  const accent = useCore((s) => s.accent)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.accent = accent
  }, [theme, accent])
}

/** Copy text; returns a `copied` flag that resets after 1.8 s. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 1800)
    return () => clearTimeout(t)
  }, [copied])
  const copy = async (text: string, key = text) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      ta.remove()
    }
    setCopied(key)
  }
  return { copied, copy }
}

/** Absolute invite URL (server may return a relative path). */
export const absoluteUrl = (url: string) => (/^https?:\/\//.test(url) ? url : `${location.origin}${url.startsWith('/') ? '' : '/'}${url}`)
