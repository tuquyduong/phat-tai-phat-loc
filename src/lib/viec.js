// ============================================
// TAB VIỆC — dữ liệu và logic
// To-do theo ngày, Daily bấm giờ, mã PIN riêng từng người.
// Không đụng bảng nào của Trang sức, Lab, Thu Chi.
// ============================================
import { supabase } from './supabase'
import { getLocalDateString } from './helpers'
import { lunarOf } from './lunar'

export const PEOPLE = { linh: 'Anh Linh', mai: 'Chị Mai' }
export const otherOf = who => (who === 'linh' ? 'mai' : 'linh')

// ── Ai đang dùng máy này (nhớ trên máy, không phải đăng nhập lại) ──
const WHO_KEY = 'viec_who'
export function getWho() { try { const w = localStorage.getItem(WHO_KEY); return PEOPLE[w] ? w : null } catch { return null } }
export function setWho(w) { try { w ? localStorage.setItem(WHO_KEY, w) : localStorage.removeItem(WHO_KEY) } catch { /* bỏ qua */ } }

// ── Mã PIN: băm rồi mới lưu, không bao giờ lưu mã gốc ──
async function hashPin(who, pin) {
  const text = 'viec_v1_' + who + '_' + pin
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof window !== 'undefined' && window.isSecureContext) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 5381; for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return 'f' + h.toString(16)
}
export async function hasPin(who) {
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'viec_pin_' + who).maybeSingle()
  if (error) throw error
  return !!data?.value
}
export async function setPin(who, pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('Mã PIN gồm đúng 4 chữ số')
  const { error } = await supabase.from('settings')
    .upsert([{ key: 'viec_pin_' + who, value: await hashPin(who, pin) }], { onConflict: 'key' })
  if (error) throw error
}
export async function checkPin(who, pin) {
  const { data, error } = await supabase.from('settings').select('value').eq('key', 'viec_pin_' + who).maybeSingle()
  if (error) throw error
  return !!data?.value && data.value === await hashPin(who, pin)
}

// ── Cài đặt chung: ngày trai ──
export const DEFAULT_CFG = { trai: true, bu27: true, traiAt: '06:00' }
export async function getCfg() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'viec_cfg').maybeSingle()
  try { return { ...DEFAULT_CFG, ...JSON.parse(data?.value || '{}') } } catch { return { ...DEFAULT_CFG } }
}
export async function saveCfg(cfg) {
  const { error } = await supabase.from('settings')
    .upsert([{ key: 'viec_cfg', value: JSON.stringify(cfg) }], { onConflict: 'key' })
  if (error) throw error
}

// ── Tải dữ liệu: của mình + những gì được chia sẻ ──
const mineFilter = who => `owner.eq.${who},shared.eq.true`
export async function loadAll(who, sinceDays = 40) {
  const since = addDays(getLocalDateString(), -sinceDays)
  // Việc đã xong quá 13 tháng thì không tải nữa (vẫn nằm trong database và bản sao lưu)
  const oldest = addDays(getLocalDateString(), -400)
  const [t, d, l] = await Promise.all([
    supabase.from('viec_tasks').select('*').or(mineFilter(who)).or(`done.eq.false,due_date.gte.${oldest}`)
      .order('due_date', { ascending: true }),
    supabase.from('viec_daily').select('*').or(mineFilter(who)).order('sort').order('created_at'),
    supabase.from('viec_logs').select('*').eq('who', who).gte('day', since).order('start_at'),
  ])
  for (const r of [t, d, l]) if (r.error) throw r.error
  return { tasks: t.data || [], daily: d.data || [], logs: l.data || [] }
}

// ── To-do ──
export async function createTask(fields) {
  const { data, error } = await supabase.from('viec_tasks').insert([fields]).select().single()
  if (error) throw error
  return data
}
export async function updateTask(id, fields) {
  const { data, error } = await supabase.from('viec_tasks').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function deleteTask(id) {
  const { error } = await supabase.from('viec_tasks').delete().eq('id', id)
  if (error) throw error
}
// Tick xong; việc lặp lại thì tự tạo lần kế tiếp
export async function toggleTask(task) {
  const done = !task.done
  const updated = await updateTask(task.id, { done, done_at: done ? new Date().toISOString() : null })
  let next = null
  if (done && task.repeat && task.due_date) {
    const nd = nextDate(task.due_date, task.repeat)
    if (nd) {
      // Chỉ tạo lần kế khi chưa có — tránh đẻ bản trùng khi lỡ tay bỏ tick rồi tick lại
      const { data: ex, error: e2 } = await supabase.from('viec_tasks').select('id')
        .eq('owner', task.owner).eq('title', task.title).eq('due_date', nd).eq('repeat', task.repeat)
      if (e2) throw e2
      if (!ex || ex.length === 0) next = await createTask({ owner: task.owner, shared: task.shared, title: task.title,
        due_date: nd, due_time: task.due_time, repeat: task.repeat, note: task.note })
    }
  }
  return { updated, next }
}

// ── Daily ──
export async function saveDaily(fields) {
  const q = fields.id
    ? supabase.from('viec_daily').update(fields).eq('id', fields.id)
    : supabase.from('viec_daily').insert([fields])
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}
// Bắt đầu bấm giờ: dừng đồng hồ đang chạy (nếu có) trước
export async function startTimer(daily, who, running) {
  if (running) await stopTimer(running)
  const { data, error } = await supabase.from('viec_logs')
    .insert([{ daily_id: daily.id, who, day: getLocalDateString(), start_at: new Date().toISOString() }])
    .select().single()
  if (error) throw error
  return data
}
export async function stopTimer(log, endAt = new Date()) {
  const minutes = Math.max(1, Math.round((endAt - new Date(log.start_at)) / 60000))
  const { data, error } = await supabase.from('viec_logs')
    .update({ end_at: endAt.toISOString(), minutes }).eq('id', log.id).select().single()
  if (error) throw error
  return data
}
// Daily kiểu đánh dấu: bấm lần nữa để bỏ
export async function toggleTick(daily, who, logs) {
  const today = getLocalDateString()
  const ex = logs.find(l => l.daily_id === daily.id && l.day === today && l.who === who)
  if (ex) {
    const { error } = await supabase.from('viec_logs').delete().eq('id', ex.id)
    if (error) throw error
    return { removed: ex.id }
  }
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('viec_logs')
    .insert([{ daily_id: daily.id, who, day: today, start_at: now, end_at: now, minutes: 0 }]).select().single()
  if (error) throw error
  return { added: data }
}

// ============================================
// HÀM THUẦN — không gọi mạng, kiểm thử được
// ============================================
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return getLocalDateString(new Date(y, m - 1, d + n))
}
export const daysBetween = (a, b) => {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2)) / 86400000)
}
// Ngày lặp kế tiếp
export function nextDate(iso, repeat) {
  if (repeat === 'weekly') return addDays(iso, 7)
  if (repeat === 'monthly') {
    const [y, m, d] = iso.split('-').map(Number)
    const last = new Date(y, m + 1, 0).getDate()
    return getLocalDateString(new Date(y, m, Math.min(d, last)))
  }
  if (repeat === 'lunar_1_15') {
    for (let i = 1; i <= 20; i++) { const s = addDays(iso, i), L = lunarOf(s); if (L.day === 1 || L.day === 15) return s }
  }
  return null
}
export const REPEAT_LABEL = { '': 'Một lần', weekly: 'Hằng tuần', monthly: 'Hằng tháng', lunar_1_15: 'Mùng 1 & Rằm' }

// Daily có làm vào ngày này không (1 = Thứ Hai … 7 = Chủ nhật)
export function isDailyDay(daily, iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1
  return (daily.weekdays || '1234567').includes(String(wd))
}
// Tiến độ một Daily trong ngày; đồng hồ đang chạy được tính tới bây giờ
export function dailyProgress(daily, logs, iso, nowMs = Date.now()) {
  const ls = logs.filter(l => l.daily_id === daily.id && l.day === iso)
  if (daily.kind === 'tick') return { minutes: 0, pct: ls.length ? 100 : 0, done: ls.length > 0 }
  const minutes = ls.reduce((a, l) => a + (l.end_at || !l.start_at
    ? (l.minutes || 0)                                                   // phiên đã xong
    : Math.max(0, Math.round((nowMs - new Date(l.start_at)) / 60000))),  // đồng hồ đang chạy
  0)
  const pct = Math.min(100, Math.round(minutes / daily.target_min * 100))
  return { minutes, pct, done: pct >= 100 }
}
export const runningLog = (logs, who) => logs.find(l => !l.end_at && l.who === who) || null
// Quên bấm kết thúc: chạy quá 3 lần mục tiêu, hoặc từ hôm trước
export function looksForgotten(log, daily, nowMs = Date.now()) {
  if (!log || !daily) return false
  const mins = (nowMs - new Date(log.start_at)) / 60000
  return mins > Math.max(90, daily.target_min * 3) || log.day !== getLocalDateString(new Date(nowMs))
}
// Sắp tới: quá hạn + hôm nay + 7 ngày tới
export function upcoming(tasks, today, horizon = 7) {
  const open = tasks.filter(t => !t.done && t.due_date)
  const byTime = (a, b) => a.due_date.localeCompare(b.due_date) || (a.due_time || '99').localeCompare(b.due_time || '99')
  return {
    late:  open.filter(t => t.due_date < today).sort(byTime),
    today: open.filter(t => t.due_date === today).sort(byTime),
    soon:  open.filter(t => t.due_date > today && daysBetween(t.due_date, today) <= horizon).sort(byTime),
  }
}
// Thống kê nhiều ngày
export function periodStats(daily, logs, fromIso, toIso) {
  const days = []; for (let s = fromIso; s <= toIso; s = addDays(s, 1)) days.push(s)
  return daily.filter(d => !d.archived).map(d => {
    const planned = days.filter(s => isDailyDay(d, s))
    const hit = planned.filter(s => dailyProgress(d, logs, s).done).length
    const minutes = logs.filter(l => l.daily_id === d.id && l.day >= fromIso && l.day <= toIso).reduce((a, l) => a + (l.minutes || 0), 0)
    return { daily: d, planned: planned.length, hit, minutes, pct: planned.length ? Math.round(hit / planned.length * 100) : 0 }
  })
}
