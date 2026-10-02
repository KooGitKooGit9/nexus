/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        line: v('line'),
        fg: v('fg'),
        muted: v('muted'),
        subtle: v('subtle'),
        accent: v('accent'),
        'accent-2': v('accent-2'),
        'accent-3': v('accent-3'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Pretendard Variable"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--accent) / 0.35), 0 8px 32px -4px rgb(var(--accent) / 0.45)',
        'glow-sm': '0 0 0 1px rgb(var(--accent) / 0.25), 0 4px 16px -4px rgb(var(--accent) / 0.35)',
        float: '0 24px 64px -12px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(var(--line) / 0.08)',
        card: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px -12px rgb(0 0 0 / 0.5)',
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent-2)) 100%)',
        'accent-gradient-3': 'linear-gradient(135deg, rgb(var(--accent)) 0%, rgb(var(--accent-2)) 50%, rgb(var(--accent-3)) 100%)',
      },
      keyframes: {
        'aurora-1': { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '50%': { transform: 'translate(8%, 6%) scale(1.15)' } },
        'aurora-2': { '0%,100%': { transform: 'translate(0,0) scale(1.1)' }, '50%': { transform: 'translate(-10%, -4%) scale(0.95)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'pulse-ring': { '0%': { transform: 'scale(.9)', opacity: '.8' }, '100%': { transform: 'scale(1.8)', opacity: '0' } },
        'gradient-x': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        'typing-dot': { '0%,80%,100%': { opacity: '.25', transform: 'translateY(0)' }, '40%': { opacity: '1', transform: 'translateY(-3px)' } },
      },
      animation: {
        'aurora-1': 'aurora-1 18s ease-in-out infinite',
        'aurora-2': 'aurora-2 22s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(.2,.6,.4,1) infinite',
        'gradient-x': 'gradient-x 6s ease infinite',
        float: 'float 4s ease-in-out infinite',
        'typing-dot': 'typing-dot 1.2s infinite',
      },
    },
  },
  plugins: [],
}
