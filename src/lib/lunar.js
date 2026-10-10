// ============================================
// ÂM LỊCH VIỆT NAM — thuật toán Hồ Ngọc Đức, múi giờ +7
// Không cần thư viện ngoài. Kết quả được nhớ lại để không tính hai lần.
// ============================================
const PI = Math.PI, INT = Math.floor, TZ = 7

function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3
  return dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045
}
function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 += -0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr) - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr)) - 0.0074 * Math.sin(dr * (M - Mpr))
  C1 += 0.0004 * Math.sin(dr * (2 * F + M)) - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
                     : -0.000278 + 0.000265 * T + 0.000262 * T2
  return Jd1 + C1 - dt
}
const newMoonDay = k => INT(newMoon(k) + 0.5 + TZ / 24)
function sunLong(jdn) {
  const T = (jdn - 2451545.5 - TZ / 24) / 36525, T2 = T * T, dr = PI / 180
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M)
  let L = (L0 + DL) * dr
  L -= PI * 2 * INT(L / (PI * 2))
  return INT(L / PI * 6)
}
function month11(yy) {
  const k = INT((jdFromDate(31, 12, yy) - 2415021) / 29.530588853)
  let nm = newMoonDay(k)
  if (sunLong(nm) >= 9) nm = newMoonDay(k - 1)
  return nm
}
function leapOffset(a11) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  let last, i = 1, arc = sunLong(newMoonDay(k + i))
  do { last = arc; i++; arc = sunLong(newMoonDay(k + i)) } while (arc !== last && i < 14)
  return i - 1
}

const cache = new Map()
// Nhận chuỗi 'YYYY-MM-DD' → { day, month, year, leap, len }  (len = 29 tháng thiếu, 30 tháng đủ)
export function lunarOf(iso) {
  if (cache.has(iso)) return cache.get(iso)
  const [yy, mm, dd] = iso.split('-').map(Number)
  const n = jdFromDate(dd, mm, yy), k = INT((n - 2415021.076998695) / 29.530588853)
  let start = newMoonDay(k + 1), next
  if (start > n) { start = newMoonDay(k); next = newMoonDay(k + 1) } else next = newMoonDay(k + 2)
  let a11 = month11(yy), b11 = a11, year
  if (a11 >= start) { year = yy; a11 = month11(yy - 1) } else { year = yy + 1; b11 = month11(yy + 1) }
  const day = n - start + 1, diff = INT((start - a11) / 29)
  let leap = false, month = diff + 11
  if (b11 - a11 > 365) {
    const ld = leapOffset(a11)
    if (diff >= ld) { month = diff + 10; if (diff === ld) leap = true }
  }
  if (month > 12) month -= 12
  if (month >= 11 && diff < 4) year -= 1
  const r = { day, month, year, leap, len: next - start }
  cache.set(iso, r)
  return r
}

// 10 ngày trai; tháng thiếu (29 ngày) có thể ăn bù ngày 27
export const TRAI_DAYS = [1, 8, 14, 15, 18, 23, 24, 28, 29, 30]
export function isTraiDay(iso, cfg = {}) {
  if (cfg.trai === false) return false
  const L = lunarOf(iso)
  return TRAI_DAYS.includes(L.day) || (cfg.bu27 !== false && L.len === 29 && L.day === 27)
}
export const isMakeupDay = iso => { const L = lunarOf(iso); return L.len === 29 && L.day === 27 }
