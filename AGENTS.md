# Nexus — Team Workspace (agent brief)

Nexus is a frontend-only team workspace (Slack + Linear + Notion + Google Calendar + Drive + Zapier-like automation + e-approval + OKR + HR directory) for a fictional company **Aurora Labs (오로라랩스)**. All UI copy is **Korean**. Data is seeded and persisted in localStorage via zustand. No backend.

**Design goal: the most dazzling, polished UI possible** — dark-first glassmorphism, aurora gradients, glow, smooth framer-motion micro-interactions, rich empty states, hover states everywhere. Think Linear × Arc × Raycast. It must also look good in light mode (use tokens, never hardcode `bg-black`/`text-white` for surfaces).

## Stack
React 19 + TypeScript + Vite 8 + Tailwind 3 + zustand 5 + framer-motion + lucide-react + recharts + @dnd-kit + date-fns (use `ko` locale) + cmdk + @xyflow/react + nanoid + canvas-confetti. **Do NOT run `npm install`** — if you think you need a package, implement it yourself instead.

## Ground rules
- **Only edit files inside your own feature directories** (listed in your task). Never edit shared files (`src/components/ui/*`, `src/store/*`, `src/lib/*`, `src/app/*`, other features). If a shared change is truly needed, describe it in your final report instead — the orchestrator will apply it.
- You MAY read anything. You MAY import other features' stores/types read-only (e.g. `useProjects` from `@/features/projects/store`) — but those may still be empty skeletons while others work; code against the types.
- Path alias `@/` → `src/`.
- **Verify with type-check filtered to your dirs**: `cd /Users/koomac/Desktop/agent/nexus && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "src/features/(<yourdirs>)"` — must print nothing. Other agents are editing concurrently, so ignore errors outside your dirs. Do NOT start dev servers or use a browser (the orchestrator does visual QA).
- Keep files reasonably sized: split big features into components (`components/`, `views/`, etc.).
- The page is mounted at `/<route>/*` and fills the area right of the sidebar and below the topbar (`absolute inset-0`). Scrollable standard pages wrap in `<Page>` from `@/app/Page`; full-bleed apps (chat, board, canvas) use `h-full flex` themselves.
- Support `?new=1` query param on your main route to open your primary "create" dialog (the command palette uses it).

## Shared building blocks (read these files before starting)
- `src/components/ui/index.ts` — Button (variants primary/secondary/ghost/outline/danger/success; sizes xs/sm/md/lg/icon/icon-sm; leftIcon), Avatar/AvatarStack/PresenceDot (pass `userId`), Badge/CountBadge (tones), Card/CardHeader (`hover`, `spotlight`), Modal/Drawer, Popover/Menu, Tooltip, Input/Textarea/Select/Field/Switch/Checkbox, Tabs/UnderlineTabs (animated), Kbd, EmptyState, PageHeader (gradient icon tile), Progress/ProgressRing, Skeleton, Divider, FadeIn.
- `src/index.css` — utility classes: `glass`, `glass-strong`, `gradient-border`, `gradient-text`, `card-hover`, `shimmer`, `grid-bg`, `dot-bg`, `input-base`, `prose-nexus` (markdown content), `scrollbar-none`, `focus-ring`.
- Tailwind tokens (all support `/opacity`): `bg`, `surface`, `surface-2`, `surface-3`, `line` (borders: use `border-line/10`), `fg`, `muted`, `subtle`, `accent`, `accent-2`, `accent-3`, `success`, `warning`, `danger`, `info`. Gradients: `bg-accent-gradient`, `bg-accent-gradient-3`. Shadows: `shadow-glow`, `shadow-glow-sm`, `shadow-float`, `shadow-card`. Fonts: `font-display` (Space Grotesk, for big numbers/headings), `font-mono`. Animations: `animate-float`, `animate-gradient-x`, `animate-pulse-ring`, `animate-typing-dot`, `animate-shimmer`.
- `src/lib/utils.ts` — `cn`, `uid(prefix)`, `daysFromNow(days, hour?, min?)`, `minutesAgo(n)` (use these in seed data so the demo always looks "fresh" relative to today), `timeAgo`, `formatTime`, `formatDayLabel`, `formatDate`, `gradientFor(key)`, `PALETTE`, `initials`, `formatBytes`, `pick`, `sleep`.
- `src/lib/persist.ts` — `persisted<State>('name', (set, get) => ({...}))` wraps zustand `persist` (key `nexus:<name>`); call `syncAcrossTabs(useStore)` after create. Always pass the explicit `<State>` generic.
- `src/store/core.ts` — `useCore` (users, currentUserId, notifications, theme…), `useCurrentUser()`, `useUser(id)`, `getUser(id)`, `getCurrentUserId()`, `useUI` (commandOpen, aiOpen, `askAI(prompt)`, toasts, `call`/`startCall({title, participantIds, video, channelId?})`/`endCall`), `toast(title, {description, variant, emoji, actorId})`, `notify({type, title, body, link, actorId})` (adds to bell inbox + toast).
- `src/store/seed-users.ts` — 14 users (`u_me` = current user 김하늘 프로덕트 리드, `u_ceo`, `u_cto`, `u_fe`, `u_be`, `u_ml`, `u_devops`, `u_design`, `u_design2`, `u_pm`, `u_mkt`, `u_sales`, `u_hr`, `u_global`) + `BOT_USER` (`u_bot`), `COMPANY`.
- `src/lib/search.ts` — `SearchResult` / `SearchFn`. Implement `src/features/<you>/search.ts` exporting `search: SearchFn` over your store (max ~6 results).
- Feature domain types live in `src/features/<name>/types.ts`; store skeletons in `src/features/<name>/store.ts`. You own yours: extend the state with actions and **rich, realistic Korean seed data** (put seed in `seed.ts`). Keep the existing top-level field names stable — other modules read them. You may add optional fields to your own types.
