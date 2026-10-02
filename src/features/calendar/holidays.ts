import { addDays, format, startOfDay, endOfDay } from 'date-fns'
import type { CalEvent } from './types'

/** Korean public holidays, computed per year (fixed-date + lunar lookup + 대체공휴일 rules). */
export interface Holiday {
  key: string // yyyy-MM-dd
  name: string
  substitute?: boolean
}

// Lunar-calendar holidays (solar date of the main day).
const LUNAR: Record<number, { seollal: string; chuseok: string; buddha: string }> = {
  2024: { seollal: '02-10', chuseok: '09-17', buddha: '05-15' },
  2025: { seollal: '01-29', chuseok: '10-06', buddha: '05-05' },
  2026: { seollal: '02-17', chuseok: '09-25', buddha: '05-24' },
  2027: { seollal: '02-07', chuseok: '09-15', buddha: '05-13' },
  2028: { seollal: '01-26', chuseok: '10-03', buddha: '05-02' },
  2029: { seollal: '02-13', chuseok: '09-22', buddha: '05-20' },
  2030: { seollal: '02-03', chuseok: '09-12', buddha: '05-09' },
}

// One-off national holidays (elections etc.)
const SPECIAL: Record<number, [string, string][]> = {
  2024: [['04-10', '국회의원선거'], ['10-01', '임시공휴일 (국군의 날)']],
  2025: [['01-27', '임시공휴일'], ['06-03', '대통령선거']],
  2026: [['06-03', '전국동시지방선거']],
  2028: [['04-12', '국회의원선거']],
}

type Rule = 'none' | 'weekend' | 'sunday'
interface Raw { date: Date; name: string; rule: Rule; group?: string }

const d = (y: number, md: string) => {
  const [m, day] = md.split('-').map(Number)
  return new Date(y, m - 1, day)
}
const keyOf = (date: Date) => format(date, 'yyyy-MM-dd')

const cache = new Map<number, Holiday[]>()

export function getHolidays(year: number): Holiday[] {
  const hit = cache.get(year)
  if (hit) return hit
  const raw: Raw[] = [
    { date: d(year, '01-01'), name: '신정', rule: 'none' },
    { date: d(year, '03-01'), name: '삼일절', rule: 'weekend' },
    { date: d(year, '05-05'), name: '어린이날', rule: 'weekend' },
    { date: d(year, '06-06'), name: '현충일', rule: 'none' },
    { date: d(year, '08-15'), name: '광복절', rule: 'weekend' },
    { date: d(year, '10-03'), name: '개천절', rule: 'weekend' },
    { date: d(year, '10-09'), name: '한글날', rule: 'weekend' },
    { date: d(year, '12-25'), name: '성탄절', rule: 'weekend' },
  ]
  // 2026년부터 노동절(5/1)·제헌절(7/17)이 관공서 공휴일로 지정 (대체공휴일 적용)
  if (year >= 2026) {
    raw.push(
      { date: d(year, '05-01'), name: '노동절', rule: 'weekend' },
      { date: d(year, '07-17'), name: '제헌절', rule: 'weekend' },
    )
  }
  const lunar = LUNAR[year]
  if (lunar) {
    const s = d(year, lunar.seollal)
    raw.push(
      { date: addDays(s, -1), name: '설날 연휴', rule: 'sunday', group: 'seollal' },
      { date: s, name: '설날', rule: 'sunday', group: 'seollal' },
      { date: addDays(s, 1), name: '설날 연휴', rule: 'sunday', group: 'seollal' },
    )
    const c = d(year, lunar.chuseok)
    raw.push(
      { date: addDays(c, -1), name: '추석 연휴', rule: 'sunday', group: 'chuseok' },
      { date: c, name: '추석', rule: 'sunday', group: 'chuseok' },
      { date: addDays(c, 1), name: '추석 연휴', rule: 'sunday', group: 'chuseok' },
    )
    raw.push({ date: d(year, lunar.buddha), name: '부처님 오신 날', rule: 'weekend' })
  }
  for (const [md, name] of SPECIAL[year] ?? []) raw.push({ date: d(year, md), name, rule: 'none' })

  const count = new Map<string, number>()
  raw.forEach((r) => count.set(keyOf(r.date), (count.get(keyOf(r.date)) ?? 0) + 1))
  const taken = new Set(count.keys())

  const subs: Holiday[] = []
  const handled = new Set<string>()
  const addSub = (after: Date, name: string) => {
    let x = addDays(after, 1)
    while (x.getDay() === 0 || x.getDay() === 6 || taken.has(keyOf(x))) x = addDays(x, 1)
    taken.add(keyOf(x))
    subs.push({ key: keyOf(x), name: `대체공휴일 (${name})`, substitute: true })
  }
  // singles with weekend rule
  for (const r of raw) {
    if (r.rule !== 'weekend') continue
    const wd = r.date.getDay()
    const dup = (count.get(keyOf(r.date)) ?? 0) > 1
    if ((wd === 0 || wd === 6 || dup) && !handled.has(keyOf(r.date))) {
      handled.add(keyOf(r.date))
      addSub(r.date, r.name)
    }
  }
  // lunar 3-day blocks: Sunday or overlap with another holiday
  for (const g of ['seollal', 'chuseok']) {
    const days = raw.filter((r) => r.group === g)
    if (!days.length) continue
    const hit = days.some((r) => r.date.getDay() === 0 || ((count.get(keyOf(r.date)) ?? 0) > 1 && !handled.has(keyOf(r.date))))
    if (hit) addSub(days[days.length - 1].date, g === 'seollal' ? '설날' : '추석')
  }

  const merged = new Map<string, Holiday>()
  for (const r of raw) {
    const k = keyOf(r.date)
    const prev = merged.get(k)
    merged.set(k, { key: k, name: prev ? `${prev.name} · ${r.name}` : r.name })
  }
  subs.forEach((s) => merged.set(s.key, s))
  const list = [...merged.values()].filter((h) => h.key.startsWith(String(year))).sort((a, b) => a.key.localeCompare(b.key))
  cache.set(year, list)
  return list
}

export function holidayOn(date: Date): Holiday | undefined {
  const k = keyOf(date)
  return getHolidays(date.getFullYear()).find((h) => h.key === k)
}

export const isHoliday = (date: Date) => !!holidayOn(date)

export function holidayToEvent(h: Holiday): CalEvent {
  const [y, m, day] = h.key.split('-').map(Number)
  const date = new Date(y, m - 1, day)
  return {
    id: `hol_${h.key}`,
    title: h.name,
    start: startOfDay(date).toISOString(),
    end: endOfDay(date).toISOString(),
    allDay: true,
    type: 'holiday',
    attendeeIds: [],
    organizerId: 'u_bot',
    description: h.substitute ? '공휴일이 주말·다른 공휴일과 겹쳐 지정된 대체공휴일입니다.' : '대한민국 법정 공휴일입니다. 즐거운 휴일 보내세요! 🎉',
  }
}

export function holidayEvents(years: number[]): CalEvent[] {
  return years.flatMap((y) => getHolidays(y).map(holidayToEvent))
}
