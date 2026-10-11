// ============================================
// MỐC TỪ TRANG SỨC & LAB — chỉ ĐỌC để hiện trên lịch
// Không ghi gì, không tạo bảng, không gửi thông báo.
// Sửa ngày ở Trang sức / Lab thì lịch tự đổi theo.
// ============================================
import { supabase } from './supabase'
import { getLocalDateString } from './helpers'

export const DEFAULT_LINKS = { jewelry: true, lab: true, hair: true }   // hair: ngày cắt tóc, móng tay
export async function getLinkPrefs(who) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'viec_links_' + who).maybeSingle()
  try { return { ...DEFAULT_LINKS, ...JSON.parse(data?.value || '{}') } } catch { return { ...DEFAULT_LINKS } }
}
export async function saveLinkPrefs(who, p) {
  const { error } = await supabase.from('settings').upsert([{ key: 'viec_links_' + who, value: JSON.stringify(p) }], { onConflict: 'key' })
  if (error) throw error
}

// Mốc giờ (timestamptz) → ngày theo giờ máy (Việt Nam); khoảng ngày → mốc giờ đầu/cuối
const dayOf = ts => ts ? (String(ts).length <= 10 ? String(ts) : getLocalDateString(new Date(ts))) : null
const startTs = iso => new Date(iso + 'T00:00:00').toISOString()
const endTs = iso => new Date(iso + 'T23:59:59.999').toISOString()
const ok = r => { if (r.error) throw r.error; return r.data || [] }
const nameMap = async (table, ids, cols) => {
  const u = [...new Set(ids.filter(Boolean))]
  if (!u.length) return {}
  const rows = ok(await supabase.from(table).select(cols).in('id', u))
  return Object.fromEntries(rows.map(r => [r.id, r]))
}
const label = j => j ? [j.code, j.name].filter(Boolean).join(' · ') : ''

// Đọc mọi mốc trong khoảng [from, to]. Bảng nào lỗi thì bỏ qua bảng đó, không làm hỏng lịch.
export async function loadLinks(from, to, prefs = DEFAULT_LINKS) {
  const ev = [], safe = async fn => { try { await fn() } catch (e) { console.warn('Mốc lịch:', e.message) } }
  const jobs = []
  if (prefs.jewelry) {
    jobs.push(safe(async () => {
      const [ord, eta] = await Promise.all([
        supabase.from('jewelry').select('id,code,name,order_date,status').gte('order_date', from).lte('order_date', to),
        supabase.from('jewelry').select('id,code,name,eta_date,status,incoming_qty').eq('status', 'ordered').gte('eta_date', from).lte('eta_date', to),
      ])
      ok(ord).forEach(j => ev.push({ date: j.order_date, src: 'jewelry', kind: 'order', text: label(j), target: { type: 'product', id: j.id } }))
      ok(eta).forEach(j => ev.push({ date: j.eta_date, src: 'jewelry', kind: 'eta', text: label(j) + (j.incoming_qty > 1 ? ` ×${j.incoming_qty}` : ''), target: { type: 'product', id: j.id } }))
    }))
    jobs.push(safe(async () => {
      const ins = ok(await supabase.from('jewelry_intakes').select('id,jewelry_id,item_name,qty,intake_at').gte('intake_at', startTs(from)).lte('intake_at', endTs(to)))
      const jm = await nameMap('jewelry', ins.map(r => r.jewelry_id), 'id,code,name')
      ins.forEach(r => ev.push({ date: dayOf(r.intake_at), src: 'jewelry', kind: 'intake', text: (label(jm[r.jewelry_id]) || r.item_name || 'Hàng') + (r.qty > 1 ? ` ×${r.qty}` : ''),
        target: r.jewelry_id ? { type: 'product', id: r.jewelry_id } : null }))   // sản phẩm đã xoá → chỉ mở tab
    }))
    jobs.push(safe(async () => {
      const ss = ok(await supabase.from('jewelry_sales').select('id,jewelry_id,item_name,customer_name,due_date,delivered').eq('delivered', false).gte('due_date', from).lte('due_date', to))
      const jm = await nameMap('jewelry', ss.map(r => r.jewelry_id), 'id,code,name')
      ss.forEach(r => ev.push({ date: r.due_date, src: 'jewelry', kind: 'deliver', text: (label(jm[r.jewelry_id]) || r.item_name || 'Hàng') + (r.customer_name ? ' → ' + r.customer_name : ''),
        target: r.jewelry_id ? { type: 'product', id: r.jewelry_id } : { type: 'sale', id: r.id } }))   // hàng order không có sản phẩm → mở đơn
    }))
  }
  if (prefs.lab) {
    jobs.push(safe(async () => {
      const bs = ok(await supabase.from('lab_batches').select('id,name,formula_id,serving,created_at').gte('created_at', startTs(from)).lte('created_at', endTs(to)))
      const fm = await nameMap('formulas', bs.map(b => b.formula_id), 'id,name')
      bs.forEach(b => ev.push({ date: dayOf(b.created_at), src: 'lab', kind: 'batch', text: (fm[b.formula_id]?.name || b.name || 'Lô') + (b.serving ? ` · ${b.serving} serving` : ''), target: { type: 'batch', id: b.id } }))
    }))
    jobs.push(safe(async () => {
      const [o, a] = await Promise.all([
        supabase.from('ingredient_imports').select('id,ingredient_id,qty,unit,order_date').gte('order_date', from).lte('order_date', to),
        supabase.from('ingredient_imports').select('id,ingredient_id,qty,unit,arrived_date').gte('arrived_date', from).lte('arrived_date', to),
      ])
      const rows = [...ok(o), ...ok(a)], im = await nameMap('ingredients', rows.map(r => r.ingredient_id), 'id,name')
      const t = r => (im[r.ingredient_id]?.name || 'Nguyên liệu') + (r.qty ? ` ${r.qty}${r.unit || ''}` : '')
      ok(o).forEach(r => ev.push({ date: r.order_date, src: 'lab', kind: 'ing_order', text: t(r), target: r.ingredient_id ? { type: 'ingredient', id: r.ingredient_id } : null }))
      ok(a).forEach(r => ev.push({ date: r.arrived_date, src: 'lab', kind: 'ing_arrive', text: t(r), target: r.ingredient_id ? { type: 'ingredient', id: r.ingredient_id } : null }))
    }))
  }
  await Promise.all(jobs)
  return ev.filter(e => e.date && e.date >= from && e.date <= to)
}

// ── HÀM THUẦN: gom theo ngày, theo loại ──
export const KIND = {
  order:      { src: 'jewelry', icon: '🛒', label: 'Đặt hàng' },
  eta:        { src: 'jewelry', icon: '🚚', label: 'Hàng dự kiến về' },
  intake:     { src: 'jewelry', icon: '📦', label: 'Nhập kho' },
  deliver:    { src: 'jewelry', icon: '🎁', label: 'Hẹn giao khách' },
  batch:      { src: 'lab',     icon: '⚗️', label: 'Làm lô' },
  ing_order:  { src: 'lab',     icon: '🛒', label: 'Đặt nguyên liệu' },
  ing_arrive: { src: 'lab',     icon: '🚚', label: 'Nguyên liệu về' },
}
// { 'YYYY-MM-DD': { jewelry: bool, lab: bool } } — để vẽ biểu tượng nhỏ trên ô lịch
export function linkMarks(events) {
  const o = {}
  for (const e of events) (o[e.date] = o[e.date] || {})[e.src] = true
  return o
}
// Các nhóm của một ngày: [{ kind, icon, label, src, items: [text…] }], theo thứ tự KIND
export function linkGroups(events, iso) {
  const day = events.filter(e => e.date === iso)
  return Object.entries(KIND).map(([kind, k]) => ({ kind, ...k, items: day.filter(e => e.kind === kind).map(e => e.text), events: day.filter(e => e.kind === kind) }))
    .filter(g => g.items.length)
}
