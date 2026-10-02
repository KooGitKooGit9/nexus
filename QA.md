# Nexus — QA & Fix loop brief (round 2, LOW-RESOURCE MODE)

The user's machine ran out of memory (80GB swap) when 8 agents each drove browser tabs and ran full type-checks in parallel. New hard rules:

## Hard rules (resource limits)
- **Do NOT use any browser tools** (`mcp__Claude_Browser__*`, Chrome tools). The orchestrator alone does visual/browser QA, sequentially.
- **Do NOT run `tsc`, `vite`, `npm run *`, `oxlint`, or start any server.** The orchestrator runs one type-check + build per wave. Write carefully-typed code (read the types you use).
- Lightweight logic checks are OK: small throwaway `node` scripts in the scratchpad that exercise pure functions (no bundlers, no heavy deps), kept short-lived. Prefer reasoning + careful code review.
- Only edit files you own (see your task). No `npm install`.

## How to QA without a browser
1. Read every component/view/store in your module end to end, as a reviewer would. Trace each user flow (click → handler → store action → re-render) and every query param / keyboard shortcut.
2. Look for: logic bugs, wrong state updates, missing persistence, stale closures, effect loops, React key issues, hook-order risks, missing null guards, layout overflow at narrow widths (~820px pane with collapsed 76px sidebar ⇒ ~740px content width; check fixed widths, `min-w-*`, grids without responsive breakpoints, `whitespace-nowrap` rows, absolute panels), light-mode contrast (hardcoded white/black text on token backgrounds), Korean copy/grammar, date/time edge cases, z-index (popovers vs modals vs drawers), unhandled empty states.
3. Fix, then re-trace the flow mentally/with a tiny node script for pure logic.

## Report (final message, concise)
- Bugs found → fix (file) table
- Anything needing a change outside your dirs (exact file + diff)
- Things the orchestrator should verify visually in the browser (specific routes/steps)

## Local test accounts (dev DB only — `server/data`, never production)
Created by the orchestrator during browser QA on localhost:
- owner: `qa-owner@example.test` / `nexus-qa-Owner1!` (workspace "QA 팀")
- member: `qa-member@example.test` / `nexus-qa-Member1!`
