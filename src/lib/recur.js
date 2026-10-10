// ============================================
// LẶP LẠI — tính mọi lần lặp THẲNG TỪ NGÀY BẮT ĐẦU
// Không tính từ lần trước, nên không bao giờ trôi ngày
// (31/1 mỗi tháng → 28/2, 31/3, 30/4… chứ không kẹt ở 28).
// ============================================
import { lunarOf } from './lunar'

const parse = s => s.split('-').map(Number)
const fmt = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const lastDay = (y, m) => new Date(y, m, 0).getDate()               // m: 1–12
export function addDaysIso(iso, n) { const [y, m, d] = parse(iso); const t = new Date(y, m - 1, d + n); return fmt(t.getFullYear(), t.getMonth() + 1, t.getDate()) }
export function diffDays(a, b) { const [y1, m1, d1] = parse(a), [y2, m2, d2] = parse(b); return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000) }

export const UNITS = { day: 'ngày', week: 'tuần', month: 'tháng', year: 'năm' }
export const isSeries = t => !!t.repeat_unit

// Việc t có rơi vào ngày iso không
export function occursOn(t, iso) {
  if (!isSeries(t)) return t.due_date === iso
  const start = t.repeat_start || t.due_date
  if (!start || iso < start) return false
  if (t.repeat_until && iso > t.repeat_until) return false
  const n = Math.max(1, t.repeat_every || 1)
  switch (t.repeat_unit) {
    case 'day':   return diffDays(iso, start) % n === 0
    case 'week':  return diffDays(iso, start) % (7 * n) === 0
    case 'month':
    case 'year': {
      const step = t.repeat_unit === 'year' ? 12 * n : n
      const [ys, ms, ds] = parse(start), [y, m, d] = parse(iso)
      const k = (y - ys) * 12 + (m - ms)
      return k >= 0 && k % step === 0 && d === Math.min(ds, lastDay(y, m))
    }
    case 'lunar': { const L = lunarOf(iso); return L.day === 1 || L.day === 15 }
    default: return false
  }
}

// Các ngày rơi vào trong khoảng [from, to]
export function occurrencesBetween(t, from, to) {
  if (!isSeries(t)) return t.due_date && t.due_date >= from && t.due_date <= to ? [t.due_date] : []
  const start = t.repeat_start || t.due_date
  let a = from > start ? from : start
  const b = t.repeat_until && t.repeat_until < to ? t.repeat_until : to
  const out = []
  for (let s = a, guard = 0; s <= b && guard < 800; s = addDaysIso(s, 1), guard++) if (occursOn(t, s)) out.push(s)
  return out
}

// N lần tiếp theo kể từ ngày from (tính cả from)
export function nextOccurrences(t, from, count = 4) {
  const out = []
  if (!isSeries(t)) return t.due_date >= from ? [t.due_date] : []
  const start = t.repeat_start || t.due_date
  let s = from > start ? from : start
  for (let guard = 0; out.length < count && guard < 4000; guard++, s = addDaysIso(s, 1)) {
    if (t.repeat_until && s > t.repeat_until) break
    if (occursOn(t, s)) out.push(s)
  }
  return out
}

export const isDoneOn = (t, iso) => isSeries(t) ? (t.done_dates || []).includes(iso) : !!t.done

// Mô tả ngắn: "Mỗi 2 tuần · từ 10/10/2026 · đến 31/12/2026"
export function describe(t) {
  if (!isSeries(t)) return ''
  const n = Math.max(1, t.repeat_every || 1), dmY = s => { const [y, m, d] = parse(s); return `${d}/${m}/${y}` }
  const rule = t.repeat_unit === 'lunar' ? 'Mùng 1 & Rằm'
    : n === 1 ? { day: 'Hằng ngày', week: 'Hằng tuần', month: 'Hằng tháng', year: 'Hằng năm' }[t.repeat_unit]
    : `Mỗi ${n} ${UNITS[t.repeat_unit]}`
  return [rule, 'từ ' + dmY(t.repeat_start || t.due_date), t.repeat_until && 'đến ' + dmY(t.repeat_until)].filter(Boolean).join(' · ')
}
