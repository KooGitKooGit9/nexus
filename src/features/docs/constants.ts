export interface CoverOption {
  id: string
  name: string
  css: string
}

/** Curated cover gradients (stored as raw CSS in `Doc.cover`). */
export const COVERS: CoverOption[] = [
  { id: 'aurora', name: '오로라', css: 'linear-gradient(135deg, #7c3aed 0%, #22d3ee 55%, #f472b6 100%)' },
  { id: 'nebula', name: '네뷸라', css: 'radial-gradient(circle at 18% 30%, #8b5cf6 0, transparent 42%), radial-gradient(circle at 82% 20%, #ec4899 0, transparent 38%), radial-gradient(circle at 55% 95%, #22d3ee 0, transparent 46%), linear-gradient(135deg, #0f0c29, #1e1b4b)' },
  { id: 'sunset', name: '선셋', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 52%, #8b5cf6 100%)' },
  { id: 'ocean', name: '딥 오션', css: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 58%, #312e81 100%)' },
  { id: 'mint', name: '민트', css: 'linear-gradient(135deg, #34d399 0%, #22d3ee 50%, #3b82f6 100%)' },
  { id: 'peach', name: '피치', css: 'linear-gradient(135deg, #fde68a 0%, #fca5a5 48%, #f472b6 100%)' },
  { id: 'forest', name: '포레스트', css: 'linear-gradient(135deg, #064e3b 0%, #10b981 55%, #a3e635 100%)' },
  { id: 'rose', name: '로즈', css: 'linear-gradient(120deg, #fb7185 0%, #e879f9 50%, #a855f7 100%)' },
  { id: 'ember', name: '엠버', css: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 55%, #7c3aed 100%)' },
  { id: 'ice', name: '아이스', css: 'linear-gradient(135deg, #e0f2fe 0%, #a5b4fc 50%, #c4b5fd 100%)' },
  { id: 'lagoon', name: '라군', css: 'radial-gradient(circle at 80% 80%, #22d3ee 0, transparent 45%), radial-gradient(circle at 15% 20%, #a3e635 0, transparent 40%), linear-gradient(135deg, #0f766e, #1e3a8a)' },
  { id: 'graphite', name: '그라파이트', css: 'linear-gradient(135deg, #111827 0%, #374151 50%, #0f172a 100%)' },
]

export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: '자주 사용', emojis: ['📝', '📄', '📘', '📚', '🗂️', '📌', '✨', '🚀', '🎯', '💡', '🔥', '⭐', '✅', '📊', '📈', '🧭'] },
  { label: '업무', emojis: ['💼', '🏢', '🗓️', '⏰', '📅', '🧾', '📦', '🛠️', '⚙️', '🔍', '🔒', '🧪', '🧩', '🏗️', '🚨', '📣', '🤝', '💬', '🗺️', '🎨', '🖌️', '🧠', '💻', '🖥️'] },
  { label: '자연', emojis: ['🌌', '🌊', '🌱', '🌿', '🌸', '🌻', '🍀', '🌈', '☀️', '🌙', '⚡', '❄️', '🔮', '🪐', '🌍', '🌴'] },
  { label: '사람 & 감정', emojis: ['😀', '😎', '🤩', '🥳', '🤔', '🙌', '👏', '💪', '👀', '❤️', '💜', '💙', '🫶', '🎉', '🏆', '🎁'] },
  { label: '사물', emojis: ['📷', '🎧', '🎬', '🎮', '☕', '🍕', '🧁', '🚲', '✈️', '🏝️', '🔑', '🧲', '💎', '🪄', '🔔', '🧰'] },
]

export const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.emojis)

export const CALLOUT_EMOJIS = ['💡', '⚠️', '✅', '📌', '🔥', '❗', 'ℹ️', '🚀', '🧠', '🎯', '📣', '🔒']

/** Simulated co-editor ring colors. */
export const PRESENCE_RINGS = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#a78bfa']

export const PERMISSION_LABEL = {
  full: '전체 허용',
  edit: '편집 허용',
  comment: '댓글 허용',
  view: '읽기 허용',
} as const

/** Tinted box classes for a callout, chosen by its emoji. */
export function calloutTone(emoji?: string) {
  switch (emoji) {
    case '⚠️': case '❗': return 'bg-warning/10 border-warning/25'
    case '🚨': return 'bg-danger/10 border-danger/25'
    case '✅': return 'bg-success/10 border-success/25'
    case 'ℹ️': case '🧭': case '🗓️': case '📅': return 'bg-info/10 border-info/25'
    case '🔥': case '📣': return 'bg-accent-3/10 border-accent-3/25'
    default: return 'bg-accent/[0.08] border-accent/20'
  }
}
