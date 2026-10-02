// Plans, limits and prices — keep in sync with LAUNCH.md and the pricing page.
const GB = 1024 ** 3

export const PLAN_LIMITS = {
  free: { members: 10, storageBytes: 5 * GB, aiPerDay: 30, workflows: 5 },
  pro: { members: null, storageBytes: 100 * GB, aiPerDay: 500, workflows: null },
  business: { members: null, storageBytes: 1024 * GB, aiPerDay: 3000, workflows: null },
}

/** KRW per member per month, VAT 별도. `yearly` = monthly-equivalent price when billed yearly. */
export const PRICES = {
  pro: { monthly: 8900, yearly: 7900 },
  business: { monthly: 15900, yearly: 13900 },
}

export const PLAN_LABEL = { free: 'Free', pro: 'Pro', business: 'Business' }
export const VAT_RATE = 0.1
export const TRIAL_DAYS = 14

export const isPlan = (p) => p === 'free' || p === 'pro' || p === 'business'
export const isPaidPlan = (p) => p === 'pro' || p === 'business'
export const isCycle = (c) => c === 'monthly' || c === 'yearly'

/** Prepaid quote: price × members × months, plus 10% VAT. */
export function quote(plan, cycle, members) {
  const months = cycle === 'yearly' ? 12 : 1
  const seats = Math.max(1, members)
  const supplyAmount = PRICES[plan][cycle] * seats * months
  const vat = Math.round(supplyAmount * VAT_RATE)
  const amount = supplyAmount + vat
  const orderName = `Nexus ${PLAN_LABEL[plan]} ${cycle === 'yearly' ? '연간(12개월)' : '월간(1개월)'} · ${seats}명 (VAT 10% 포함)`
  return { months, seats, supplyAmount, vat, amount, orderName }
}

/** Add calendar months (clamped to month end, e.g. Jan 31 + 1 → Feb 28/29). */
export function addMonths(ms, n) {
  const d = new Date(ms)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.getTime()
}

/** Today's date in Korea (UTC+9, no DST) as YYYY-MM-DD. */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10)
