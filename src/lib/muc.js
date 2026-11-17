// ============================================
// THU CHI · THEO MỤC
// Gom các khoản chi theo nội dung ghi chú ("Cy", "Cf", "chợ"…) để xem tổng từng tháng.
// CHỈ ĐỌC giao dịch. Danh sách mục lưu ở settings.chi_muc — không sửa giao dịch nào.
// ============================================
import { supabase } from './supabase'
import { getLocalDateString } from './helpers'

const KEY = 'chi_muc'

// Mục gợi ý ban đầu (chưa lưu gì vào database cho tới khi người dùng sửa)
export const DEFAULT_MUC = [
  { k: 'cy', n: 'Cy', e: '👩‍👧', c: '#fce7f3', kw: ['cy'], ex: [] },
  { k: 'cho', n: 'Đi chợ', e: '🥬', c: '#dcfce7', kw: ['chợ'], ex: [] },
  { k: 'moon', n: 'Moon', e: '🌙', c: '#fef3c7', kw: ['moon'], ex: [] },
  { k: 'choo', n: 'Choo', e: '🐣', c: '#e0f2fe', kw: ['choo'], ex: [] },
  { k: 'thuoc', n: 'Thuốc MC', e: '💊', c: '#ede9fe', kw: ['thuốc mc'], ex: [] },
  { k: 'cf', n: 'Cà phê', e: '☕', c: '#f5ebe0', kw: ['cf', 'cà phê', 'cafe', 'caphe'], ex: [] },
  { k: 'xang', n: 'Xăng', e: '⛽', c: '#e5e7eb', kw: ['xăng'], ex: [] },
]
export const MUC_COLORS = ['#fce7f3', '#dcfce7', '#fef3c7', '#e0f2fe', '#ede9fe', '#f5ebe0', '#e5e7eb', '#fee2e2']

// ---------- So khớp ----------
// Bỏ dấu, đ→d, chữ thường. 'ph' coi như 'f' để "cafe" ≈ "cà phê".
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
const words = s => norm(s).replace(/ph/g, 'f').split(/[^a-z0-9]+/).filter(Boolean)
const keyOf = s => String(s || '').trim().toLowerCase()

// Chữ khoá có nằm trọn trong ghi chú không (đúng từ, không phải một phần của từ khác)
export function hit(note, kw) {
  const W = words(note), K = words(kw)
  if (!K.length) return false
  for (let i = 0; i + K.length <= W.length; i++) if (K.every((k, j) => W[i + j] === k)) return true
  return false
}

// Sai đúng 1 ký tự (thêm / bớt / thay)
function lev1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, e = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++e > 1) return false
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++ }
  }
  return e + (a.length - i) + (b.length - j) <= 1
}

// 2 = đúng chữ · 1 = gần giống (viết liền/tách, sai 1 ký tự) · 0 = không khớp
export function match(note, q) {
  if (!String(q || '').trim()) return 0
  if (hit(note, q)) return 2
  const W = words(note), q2 = words(q).join('')
  if (!q2) return 0
  const C = [...W, ...W.map((w, i) => w + (W[i + 1] || ''))]
  if (C.includes(q2)) return 1
  if (q2.length >= 4 && C.some(w => w.length >= 4 && w[0] === q2[0] && lev1(w, q2))) return 1
  return 0
}

export const inMuc = (m, note) => !!note && m.kw.some(k => hit(note, k)) && !(m.ex || []).includes(keyOf(note))
// Mục của một ghi chú: một mục, 'many' (khớp nhiều mục), hoặc null
export function mucOf(list, note) {
  const m = list.filter(x => inMuc(x, note))
  return m.length === 1 ? m[0] : m.length > 1 ? 'many' : null
}

// Gán dứt khoát một ghi chú lẫn nhiều mục: thêm vào mục được chọn, loại khỏi các mục khác
export function assignNote(list, note, k) {
  const key = keyOf(note)
  return list.map(m => m.k === k
    ? { ...m, kw: m.kw.includes(key) ? m.kw : [...m.kw, key], ex: (m.ex || []).filter(x => x !== key) }
    : inMuc(m, note) ? { ...m, ex: [...(m.ex || []), key] } : m)
}

// ---------- Tháng ----------
export const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
// 6 tháng kết thúc ở tháng đang xem, cũ → mới
export function sixMonths(cur) {
  return Array.from({ length: 6 }, (_, i) => monthKey(new Date(cur.getFullYear(), cur.getMonth() - 5 + i, 1)))
}
// Tổng theo tháng của các khoản thoả fn
export function byMonth(rows, months, fn) {
  const v = months.map(() => 0), idx = Object.fromEntries(months.map((m, i) => [m, i]))
  rows.forEach(r => { const i = idx[r.date.slice(0, 7)]; if (i !== undefined && fn(r)) v[i] += Number(r.amount) || 0 })
  return v
}

// Ghi chú gõ nhiều lần mà chưa thuộc mục nào → gợi ý thêm mục
export function suggestions(rows, list, min = 3, max = 6) {
  const cnt = {}
  rows.forEach(r => { const k = keyOf(r.note); if (k && k.length <= 24 && !mucOf(list, r.note)) cnt[k] = (cnt[k] || 0) + 1 })
  return Object.entries(cnt).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, max)
}

// ---------- Dữ liệu ----------
// Các khoản chi trong 6 tháng (chỉ đọc vài cột cần thiết)
export async function getChiRows(months) {
  const from = months[0] + '-01'
  const [y, m] = months[months.length - 1].split('-').map(Number)
  const to = getLocalDateString(new Date(y, m, 0))
  const out = []
  for (let off = 0; ; off += 1000) {
    const { data, error } = await supabase.from('transactions')
      .select('id, type, date, amount, note, category_id, payment_method, account_id, card_id, category:app_config(id, name, icon, color, metadata)')
      .eq('type', 'expense').gte('date', from).lte('date', to)
      .order('date', { ascending: false }).order('id', { ascending: true }).range(off, off + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) return out
  }
}

export async function loadMuc() {
  const { data, error } = await supabase.from('settings').select('value').eq('key', KEY).maybeSingle()
  if (error) throw error
  if (!data?.value) return DEFAULT_MUC
  try { const v = JSON.parse(data.value); return Array.isArray(v) ? v : DEFAULT_MUC } catch { return DEFAULT_MUC }
}

export async function saveMuc(list) {
  const clean = list.map(({ k, n, e, c, kw, ex }) => ({ k, n, e, c, kw: [...new Set(kw.map(keyOf).filter(Boolean))], ex: [...new Set((ex || []).map(keyOf))] }))
  const { error } = await supabase.from('settings').upsert([{ key: KEY, value: JSON.stringify(clean) }], { onConflict: 'key' })
  if (error) throw error
  return clean
}
