/**
 * Tiny pure helpers for showing people. Members of real workspaces often have empty profile fields
 * (title, department, location…) — never render dangling separators like " · 온라인".
 * No imports on purpose: safe to use from any feature.
 */

/** Joins the non-empty parts with " · ". */
export function joinMeta(...parts: (string | number | null | undefined | false)[]): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== false && String(p).trim() !== '').join(' · ')
}

/** The Nexus bot can live in `core.users` of real workspaces — it is not a person / team member. */
export const BOT_ID = 'u_bot'
export function isHuman(u: { id: string } | null | undefined): boolean {
  return !!u && u.id !== BOT_ID
}

/** "김하늘" → "하늘", "Jane Doe" → "Jane" — for friendly greetings ("하늘님"). */
export function givenName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  if (/^[가-힣]{2,4}$/.test(n)) return n.slice(1)
  return n.split(/\s+/)[0] ?? ''
}
