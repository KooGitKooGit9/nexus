# Nexus — Launch brief (round 4: make it a sellable SaaS)

Nexus is currently a polished single-workspace demo ("Aurora Labs", 14 seeded fake people, pick-a-person login).
Goal of this round: turn it into a product real teams can **sign up for, use with their own colleagues, and pay for**.

Read `AGENTS.md` (conventions, design system), `BACKEND.md` (current backend), `QA.md` (resource rules) first.

## Product principles (non-negotiable)
- **Honest product.** No fake reviews/testimonials, no invented customer logos or user counts, no fake scarcity/countdowns,
  no pre-checked consent boxes, no hidden charges, cancellation as easy as signup. Features that are not built yet are
  labelled "곧 제공" — never claimed as available.
- **Real workspaces contain only real people.** The 14 Aurora Labs personas and AI-simulated teammate replies exist
  **only in demo workspaces** (`kind: 'demo'`). A blank workspace starts with just its members + the Nexus bot.
- **Security by default.** Passwords hashed with `crypto.scrypt` (+ per-user salt, `timingSafeEqual`), httpOnly session
  cookies, every API call and WebSocket scoped to the caller's workspace membership, rate-limited auth, no secrets in the client.
- **Korean market first.** All copy Korean, KRW pricing (VAT 별도 표기), 개인정보 처리방침/이용약관 drafts, 회원 탈퇴.
- Brand/company identity lives in ONE place (`src/config/brand.ts` client, env on server) so the owner can rename/fill in
  business info (상호, 대표자, 사업자등록번호, 주소, 문의 이메일) before launch.

## Plans (enforced on the server; displayed by the pricing page — keep these numbers in sync)
| plan | price (KRW, per member / month, VAT 별도) | members | storage (workspace total) | AI requests / workspace / day | workflows |
|---|---|---|---|---|---|
| `free` | 0 | 10 | 5 GB | 30 | 5 |
| `pro` | 8,900 monthly · 7,900 billed yearly | unlimited | 100 GB | 500 | unlimited |
| `business` | 15,900 monthly · 13,900 billed yearly | unlimited | 1 TB | 3,000 | unlimited |
`business` extras shown as "곧 제공": SSO(SAML), 감사 로그 export, 전담 지원. New paid upgrades get a 14-day trial (no card stored by us).

## Server API contract (cookie `nexus_sid`; JSON; errors `{ error: CODE, message: '한국어 메시지' }`)
Auth
- `POST /api/auth/signup {name, email, password}` → `{ me }` (password ≥ 8 chars; email unique, lowercased)
- `POST /api/auth/login {email, password}` → `{ me }` · `POST /api/auth/logout` → `{ ok }`
- `GET /api/auth/me` → `Me` (200 always; `account: null` when logged out)
- `POST /api/auth/password/forgot {email}` → `{ ok }` (always ok; reset link emailed if SMTP configured, else logged to server console)
- `POST /api/auth/password/reset {token, password}` → `{ me }`
- `PATCH /api/account {name?, currentPassword?, newPassword?}` → `{ me }` · `DELETE /api/account {password}` → `{ ok }` (refuses if sole owner of a workspace with other members)
- `POST /api/demo` → `{ me }` — creates a guest account + a fresh demo workspace (member id `u_me` = 김하늘), expires after 24h.

Workspaces (all require login + membership; role ∈ `owner|admin|member`)
- `POST /api/workspaces {name, kind: 'blank'|'demo'}` → `{ me }` (creator = owner, becomes current)
- `POST /api/workspaces/:id/switch` → `{ me }`
- `PATCH /api/workspaces/:id {name?, iconColor?}` (owner/admin) · `DELETE /api/workspaces/:id {confirmName}` (owner)
- `GET /api/workspaces/:id/members` → `{ members: Member[], invites: Invite[] }`
- `PATCH /api/workspaces/:id/members/:memberId {role}` (owner/admin) · `DELETE /api/workspaces/:id/members/:memberId` (admin, or self = leave)
- `POST /api/workspaces/:id/invites {emails?: string[], role}` → `{ invites: Invite[] }` (link-only invite when no emails); `DELETE /api/workspaces/:id/invites/:token`
- `GET /api/invites/:token` (public) → `{ workspace: {name, memberCount}, inviter: {name}, email?, expired }`
- `POST /api/invites/:token/accept` (login required) → `{ me }`

Billing / usage (current workspace)
- `GET /api/billing` → `{ plan, cycle, status: 'active'|'trialing'|'canceled', trialEndsAt?, renewsAt?, limits, usage: {members, storageBytes, aiToday, workflows?}, provider: 'toss'|'none' }`
- `POST /api/billing/checkout {plan, cycle}` → `{ provider: 'none' }` when no payment keys (UI then offers "14일 무료 체험 시작"), or `{ provider:'toss', clientKey, orderId, amount, orderName, customerKey }`
- `POST /api/billing/trial {plan}` · `POST /api/billing/confirm {paymentKey, orderId, amount}` (Toss success redirect) · `POST /api/billing/cancel`
- Limit violations → `402 { error: 'PLAN_LIMIT', limit: 'members'|'storage'|'ai'|'workflows', message }`.

Existing endpoints become workspace-scoped by the session (no `?user=` params any more): `/api/bootstrap`, `/api/seed`,
`/api/user-state`, `/api/ops`, `/api/upload`, `/api/files/:id` (only members of the owning workspace), `/api/ai/*` (quota),
`/api/reset` (owner of a demo workspace only — resets that workspace). WebSocket `/ws` authenticates by cookie; presence,
ops, events and signals are fanned out **only within the same workspace**.

Bootstrap additionally returns `workspace: {id, name, kind, plan}` and `memberId`.
For **blank** workspaces the server owns `core/users`: it seeds the members as `User` objects at creation and
upserts/removes them on join/leave/profile change (broadcasting `ops`).

Types
```ts
type Me = { account: { id: string; name: string; email: string; guest: boolean } | null;
  workspaces: { id: string; name: string; kind: 'blank'|'demo'; role: 'owner'|'admin'|'member'; plan: Plan; memberId: string; iconColor?: string }[];
  currentWorkspaceId: string | null }
type Member = { memberId: string; accountId: string; name: string; email: string; role: Role; joinedAt: string; online: boolean }
type Invite = { token: string; url: string; email?: string; role: Role; createdAt: string; expiresAt: string }
```
The canonical client for this contract is `src/lib/api.ts` (owned by the orchestrator).

## Ownership this round
- Backend agent: `server/**`, `Dockerfile`, `.dockerignore`, `DEPLOY.md`, `package.json` (scripts only).
- Public/account UI agent: `src/features/public/**` (new), `src/features/settings/**`, `src/config/brand.ts` (new), `public/**`, `index.html` (meta/OG only).
- Orchestrator: `src/lib/**`, `src/app/**`, `src/store/**`, `src/main.tsx`, `src/App.tsx`, other features.
