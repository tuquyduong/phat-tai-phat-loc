// ============================================
// TAB VIỆC — dữ liệu và logic
// To-do theo ngày, Daily bấm giờ, mã PIN riêng từng người.
// Không đụng bảng nào của Trang sức, Lab, Thu Chi.
// ============================================
import { supabase } from './supabase'
import { getLocalDateString } from './helpers'
import { isSeries, occurrencesBetween, isDoneOn } from './recur'

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
  const [t, d, l, p, o] = await Promise.all([
    // Việc của dự án luôn tải đủ (kể cả đã xong) để tính đúng tiến độ dự án
    supabase.from('viec_tasks').select('*').or(mineFilter(who)).or(`done.eq.false,due_date.gte.${oldest},project_id.not.is.null`)
      .order('due_date', { ascending: true }),
    supabase.from('viec_daily').select('*').or(mineFilter(who)).order('sort').order('created_at'),
    supabase.from('viec_logs').select('*').eq('who', who).gte('day', since).order('start_at'),
    supabase.from('viec_projects').select('*').or(mineFilter(who)).order('created_at'),
    // Hàng đặt: mọi đơn chưa về + đơn đặt trong 13 tháng gần nhất (đủ cho tổng kết và số ngày về trung bình)
    supabase.from('viec_orders').select('*').or(mineFilter(who)).or(`received_at.is.null,order_date.gte.${oldest}`).order('order_date'),
  ])
  for (const r of [t, d, l, p, o]) if (r.error) throw r.error
  return { tasks: t.data || [], daily: d.data || [], logs: l.data || [], projects: p.data || [], orders: o.data || [] }
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
// Tick một việc. Việc lặp: chỉ đánh dấu ĐÚNG lần (ngày) được tick, các lần khác giữ nguyên.
export async function toggleTask(task, iso) {
  if (isSeries(task)) {
    const set = new Set(task.done_dates || [])
    set.has(iso) ? set.delete(iso) : set.add(iso)
    return { updated: await updateTask(task.id, { done_dates: [...set].sort() }) }
  }
  const done = !task.done
  return { updated: await updateTask(task.id, { done, done_at: done ? new Date().toISOString() : null }) }
}


// ── Dự án ──
export async function saveProject(fields) {
  const q = fields.id
    ? supabase.from('viec_projects').update(fields).eq('id', fields.id)
    : supabase.from('viec_projects').insert([fields])
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}
// Bật/tắt chia sẻ dự án thì mọi việc trong dự án đổi theo — hai người nhìn cùng một tiến độ
export async function setProjectShared(projectId, shared) {
  const { data, error } = await supabase.from('viec_tasks').update({ shared }).eq('project_id', projectId).select()
  if (error) throw error
  return data || []
}
// Xoá dự án: các việc vẫn giữ, chỉ bỏ liên kết (cơ sở dữ liệu tự làm)
export async function deleteProject(id) {
  const { error } = await supabase.from('viec_projects').delete().eq('id', id)
  if (error) throw error
}
// Tiến độ dự án: việc lặp không tính vào phần trăm (vì không bao giờ "xong hẳn")
export function projectProgress(projectId, tasks, today) {
  const ts = tasks.filter(t => t.project_id === projectId)
  const plain = ts.filter(t => !t.repeat_unit), done = plain.filter(t => t.done).length
  const next = plain.filter(t => !t.done && t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null
  const late = plain.filter(t => !t.done && t.due_date && t.due_date < today).length
  return { total: plain.length, done, pct: plain.length ? Math.round(done / plain.length * 100) : 0, next, late,
           undated: plain.filter(t => !t.done && !t.due_date).length, series: ts.length - plain.length }
}
// Các nhóm trong dự án, theo thứ tự xuất hiện; việc không có nhóm vào "Chung"
export function projectGroups(projectId, tasks) {
  const names = []
  tasks.filter(t => t.project_id === projectId).forEach(t => { const g = t.group_name || 'Chung'; if (!names.includes(g)) names.push(g) })
  return names
}


// ── Hàng đặt ──
export async function saveOrder(fields) {
  const q = fields.id
    ? supabase.from('viec_orders').update(fields).eq('id', fields.id)
    : supabase.from('viec_orders').insert([fields])
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}
export async function deleteOrder(id) {
  const { error } = await supabase.from('viec_orders').delete().eq('id', id)
  if (error) throw error
}
// Mã tracking: một hoặc nhiều mã, cách nhau dấu phẩy / khoảng trắng / xuống dòng
export const trackingCodes = s => [...new Set(String(s || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean))]   // bỏ mã dán trùng
export const trackUrl = code => 'https://t.17track.net/vi#nums=' + encodeURIComponent(code)
// Số ngày về trung bình, học từ các đơn đã nhận
export function avgArrival(orders) {
  const r = orders.filter(o => o.received_at && o.order_date)
  return r.length ? Math.round(r.reduce((a, o) => a + daysBetween(o.received_at, o.order_date), 0) / r.length) : null
}
// Tình trạng một đơn chưa về: quá hẹn (có ngày về), lâu bất thường (không ngày về, chờ gấp đôi trung bình)
export function orderFlag(o, today, avg) {
  if (o.received_at) return null
  if (o.eta) return o.eta < today ? { kind: 'late', days: daysBetween(today, o.eta) } : { kind: 'eta', days: daysBetween(o.eta, today) }
  return avg && daysBetween(today, o.order_date) > avg * 2 ? { kind: 'slow' } : null
}
// Tổng kết theo tháng đặt (month = 'YYYY-MM'): chưa về gồm cả đơn các tháng trước còn treo
export function orderSummary(orders, month, today) {
  const inMonth = orders.filter(o => o.order_date.startsWith(month))
  const received = inMonth.filter(o => o.received_at).sort((a, b) => b.received_at.localeCompare(a.received_at))
  const pending = orders.filter(o => !o.received_at && o.order_date.slice(0, 7) <= month).sort((a, b) => a.order_date.localeCompare(b.order_date))
  return { total: inMonth.length, received, pending, avg: avgArrival(orders) }
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


// Nhập tay khi quên theo dõi: value là số phút (bấm giờ) hoặc số lượng (đếm). day mặc định hôm nay.
export async function addManual(daily, who, value, day = getLocalDateString(), manual = true) {
  const v = Math.round(Number(value))
  if (!(v > 0)) throw new Error(daily.kind === 'count' ? 'Nhập số lượng lớn hơn 0' : 'Nhập số phút lớn hơn 0')
  if (day > getLocalDateString()) throw new Error('Không ghi cho ngày chưa tới')
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('viec_logs')
    .insert([{ daily_id: daily.id, who, day, start_at: now, end_at: now, minutes: v, manual }]).select().single()
  if (error) throw error
  return data
}
export async function deleteLog(id) {
  const { error } = await supabase.from('viec_logs').delete().eq('id', id)
  if (error) throw error
}
// Gợi ý số cho nút cộng nhanh / nhập tay, theo mục tiêu
export function quickSteps(daily) {
  if (daily.kind === 'time') return [15, 30, 45, 60, 90]
  const t = daily.target_min || 10
  if (t >= 200) return [10, 50, 100]
  if (t >= 50) return [10, 20, 50]
  if (t >= 10) return [1, 5, 10]
  return [1, 2, 5]
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
// Sắp tới: quá hạn + hôm nay + 7 ngày tới. Mỗi dòng là { t, date }.
// Việc lặp: hiện mọi lần trong 7 ngày tới; quá hạn chỉ hiện LẦN GẦN NHẤT bị sót (không dồn cả loạt).
export function upcoming(tasks, today, horizon = 7) {
  const end = addDays(today, horizon), from = addDays(today, -30)
  const late = [], tday = [], soon = []
  for (const t of tasks) {
    if (isSeries(t)) {
      const occ = occurrencesBetween(t, from, end)
      const missed = occ.filter(d => d < today && !isDoneOn(t, d))
      if (missed.length) late.push({ t, date: missed[missed.length - 1] })
      for (const d of occ) if (d >= today && !isDoneOn(t, d)) (d === today ? tday : soon).push({ t, date: d })
    } else if (!t.done && t.due_date) {
      const e = { t, date: t.due_date }
      if (t.due_date < today) late.push(e); else if (t.due_date === today) tday.push(e); else if (t.due_date <= end) soon.push(e)
    }
  }
  const by = (a, b) => a.date.localeCompare(b.date) || (a.t.due_time || '99').localeCompare(b.t.due_time || '99')
  return { late: late.sort(by), today: tday.sort(by), soon: soon.sort(by) }
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
