/**
 * Typed client for the Nexus server API (contract: LAUNCH.md). Session = httpOnly cookie, so every call
 * is implicitly scoped to the logged-in account and its current workspace.
 */
export type Role = 'owner' | 'admin' | 'member'
export type Plan = 'free' | 'pro' | 'business'
export type Cycle = 'monthly' | 'yearly'
export type WorkspaceKind = 'blank' | 'demo'

export interface WorkspaceSummary {
  id: string
  name: string
  kind: WorkspaceKind
  role: Role
  plan: Plan
  memberId: string
  iconColor?: string
}

export interface Me {
  account: { id: string; name: string; email: string; guest: boolean } | null
  workspaces: WorkspaceSummary[]
  currentWorkspaceId: string | null
}

export interface Member {
  memberId: string
  accountId: string
  name: string
  email: string
  role: Role
  joinedAt: string
  online: boolean
}

export interface Invite {
  token: string
  url: string
  email?: string
  role: Role
  createdAt: string
  expiresAt: string
}

export interface InvitePreview {
  workspace: { name: string; memberCount: number }
  inviter: { name: string }
  email?: string
  expired: boolean
}

export interface PlanLimits {
  members: number | null // null = unlimited
  storageBytes: number
  aiPerDay: number
  workflows: number | null
}

export interface Billing {
  plan: Plan
  cycle: Cycle
  status: 'active' | 'trialing' | 'canceled'
  trialEndsAt?: string
  renewsAt?: string
  limits: PlanLimits
  usage: { members: number; storageBytes: number; aiToday: number; workflows?: number }
  provider: 'toss' | 'none'
  trialUsed?: boolean
  /** prepaid periods — never renews automatically */
  autoRenew?: false
}

export type Checkout =
  | { provider: 'none' }
  | {
      provider: 'toss'
      clientKey: string
      orderId: string
      /** VAT included */
      amount: number
      orderName: string
      customerKey: string
      supplyAmount?: number
      vat?: number
      seats?: number
      months?: number
    }

export class ApiError extends Error {
  status: number
  code: string
  data: Record<string, unknown>
  constructor(status: number, code: string, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.data = data
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? 'ERROR'), String(data.message ?? '요청을 처리하지 못했어요.'), data)
  }
  return data as T
}

const enc = encodeURIComponent

export const api = {
  // auth
  me: () => call<Me>('GET', '/api/auth/me'),
  signup: (b: { name: string; email: string; password: string; marketingOptIn?: boolean }) => call<{ me: Me }>('POST', '/api/auth/signup', b),
  login: (b: { email: string; password: string }) => call<{ me: Me }>('POST', '/api/auth/login', b),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout'),
  forgotPassword: (email: string) => call<{ ok: true }>('POST', '/api/auth/password/forgot', { email }),
  resetPassword: (token: string, password: string) => call<{ me: Me }>('POST', '/api/auth/password/reset', { token, password }),
  updateAccount: (b: { name?: string; currentPassword?: string; newPassword?: string }) => call<{ me: Me }>('PATCH', '/api/account', b),
  deleteAccount: (password: string) => call<{ ok: true }>('DELETE', '/api/account', { password }),
  startDemo: () => call<{ me: Me }>('POST', '/api/demo'),

  // workspaces
  createWorkspace: (b: { name: string; kind: WorkspaceKind }) => call<{ me: Me }>('POST', '/api/workspaces', b),
  switchWorkspace: (id: string) => call<{ me: Me }>('POST', `/api/workspaces/${enc(id)}/switch`),
  updateWorkspace: (id: string, b: { name?: string; iconColor?: string }) => call<{ me: Me }>('PATCH', `/api/workspaces/${enc(id)}`, b),
  deleteWorkspace: (id: string, confirmName: string) => call<{ me: Me }>('DELETE', `/api/workspaces/${enc(id)}`, { confirmName }),
  members: (id: string) => call<{ members: Member[]; invites: Invite[] }>('GET', `/api/workspaces/${enc(id)}/members`),
  setMemberRole: (id: string, memberId: string, role: Role) => call<{ ok: true }>('PATCH', `/api/workspaces/${enc(id)}/members/${enc(memberId)}`, { role }),
  removeMember: (id: string, memberId: string) => call<{ ok: true }>('DELETE', `/api/workspaces/${enc(id)}/members/${enc(memberId)}`),
  createInvites: (id: string, b: { emails?: string[]; role: Role }) => call<{ invites: Invite[] }>('POST', `/api/workspaces/${enc(id)}/invites`, b),
  revokeInvite: (id: string, token: string) => call<{ ok: true }>('DELETE', `/api/workspaces/${enc(id)}/invites/${enc(token)}`),
  invitePreview: (token: string) => call<InvitePreview>('GET', `/api/invites/${enc(token)}`),
  acceptInvite: (token: string) => call<{ me: Me }>('POST', `/api/invites/${enc(token)}/accept`),

  // billing
  billing: () => call<Billing>('GET', '/api/billing'),
  checkout: (plan: Plan, cycle: Cycle) => call<Checkout>('POST', '/api/billing/checkout', { plan, cycle }),
  startTrial: (plan: Plan) => call<Billing>('POST', '/api/billing/trial', { plan }),
  confirmPayment: (b: { paymentKey: string; orderId: string; amount: number }) => call<Billing>('POST', '/api/billing/confirm', b),
  cancelPlan: () => call<Billing>('POST', '/api/billing/cancel'),
}
