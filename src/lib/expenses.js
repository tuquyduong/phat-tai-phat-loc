// ============================================
// EXPENSES API - v3
// + payment_method: cash / transfer / credit
// + type: income / expense / transfer / pay_credit (payment_method 'credit' = hoàn tiền về thẻ) / adjust
// + Lũy kế TM, CK, Nợ TD
// ============================================
import { supabase } from './supabase'
import { getLocalDateString } from './helpers'


// ============================================
// ĐỌC THEO TRANG — Supabase chỉ trả tối đa 1.000 dòng mỗi lần.
// Đọc nhiều lần, mỗi lần 1.000 dòng, sắp xếp cố định theo ngày + id để không sót, không trùng.
// ============================================
const PAGE = 1000
async function fetchAllTx(build) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().order('date', { ascending: true }).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < PAGE) return out
  }
}

// ============================================
// DANH MỤC
// ============================================
export async function getExpenseCategories() {
  const { data, error } = await supabase
    .from('app_config').select('*')
    .eq('module', 'expense').eq('type', 'category').eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function createExpenseCategory(category) {
  const { data, error } = await supabase.from('app_config')
    .insert([{ module:'expense', type:'category', name:category.name, icon:category.icon||'📦',
      color:category.color||'#6B7280', metadata:category.metadata||{},
      sort_order:category.sort_order||99, is_active:true }])
    .select().single()
  if (error) throw error
  return data
}

export async function updateExpenseCategory(id, updates) {
  const { error } = await supabase.from('app_config').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteExpenseCategory(id) {
  const { error } = await supabase.from('app_config').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ============================================
// SỐ DƯ BAN ĐẦU
// ============================================
export async function getInitialBalances() {
  const { data, error } = await supabase.from('app_config').select('*')
    .eq('module', 'expense').eq('type', 'initial_balance').eq('is_active', true).maybeSingle()
  if (error) throw error
  if (data) return { cash:Number(data.metadata?.cash)||0, transfer:Number(data.metadata?.transfer)||0, credit:Number(data.metadata?.credit)||0, id:data.id }
  return { cash:0, transfer:0, credit:0, id:null }
}

export async function saveInitialBalances(cash, transfer, credit, existingId) {
  const payload = { module:'expense', type:'initial_balance', name:'Số dư ban đầu',
    icon:'💰', color:'#3B82F6', metadata:{ cash:Number(cash)||0, transfer:Number(transfer)||0, credit:Number(credit)||0 }, is_active:true }
  if (existingId) { const { error } = await supabase.from('app_config').update(payload).eq('id', existingId); if(error) throw error }
  else { const { error } = await supabase.from('app_config').insert([payload]); if(error) throw error }
}

// ============================================
// GIAO DỊCH
// ============================================
export async function getTransactions({ startDate, endDate } = {}) {
  const rows = await fetchAllTx(() => {
    let q = supabase.from('transactions').select('*, category:app_config(id, name, icon, color, metadata)')
    if (startDate) q = q.gte('date', startDate)
    if (endDate) q = q.lte('date', endDate)
    return q
  })
  // mới nhất lên đầu (như trước): theo ngày, rồi theo lúc tạo
  return rows.sort((a, b) => b.date.localeCompare(a.date) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
}

export async function createTransaction(tx) {
  const { data, error } = await supabase.from('transactions')
    .insert([{ category_id:tx.category_id||null, type:tx.type, amount:tx.amount,
      date:tx.date||getLocalDateString(), note:tx.note||'',
      payment_method:tx.payment_method||'cash', tags:tx.tags||[], linked_order_id:tx.linked_order_id||null,
      ...(tx.card_id !== undefined ? { card_id: tx.card_id || null } : {}) }])
    .select('*, category:app_config(id, name, icon, color, metadata)').single()
  if (error) throw error
  return data
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id)
    .select('*, category:app_config(id, name, icon, color, metadata)').single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// THỐNG KÊ
// ============================================
export async function getExpenseSummary(startDate, endDate) {
  const data = await fetchAllTx(() => supabase.from('transactions')
    .select('id, date, type, amount, category_id, payment_method, category:app_config(id, name, icon, color)')
    .gte('date', startDate).lte('date', endDate))

  let totalIncome = 0, totalExpense = 0
  const byCategory = {}
  const byMethod = { cash:{income:0,expense:0}, transfer:{income:0,expense:0}, credit:{income:0,expense:0} }

  ;(data || []).forEach(tx => {
    const amt = Number(tx.amount), method = tx.payment_method || 'cash'
    if (tx.type === 'income') {
      totalIncome += amt
      if (byMethod[method]) byMethod[method].income += amt
    } else if (tx.type === 'expense') {
      totalExpense += amt
      if (byMethod[method]) byMethod[method].expense += amt
    }
    // transfer, pay_credit: không tính thu/chi
    if (tx.type === 'income' || tx.type === 'expense') {
      const catId = tx.category_id || 'none'
      if (!byCategory[catId]) {
        byCategory[catId] = { category:tx.category||{name:'Khác',icon:'📦',color:'#6B7280'}, income:0, expense:0, count:0 }
      }
      if (tx.type === 'income') byCategory[catId].income += amt
      else byCategory[catId].expense += amt
      byCategory[catId].count++
    }
  })
  return { totalIncome, totalExpense, balance:totalIncome-totalExpense,
    byCategory:Object.values(byCategory).sort((a,b)=>(b.expense+b.income)-(a.expense+a.income)), byMethod }
}

// ============================================
// SỐ DƯ — cash, transfer (dương = đang có), credit (dương = đang nợ)
// credit tách theo thẻ: cards[card_id] — 'none' là giao dịch chưa phân thẻ
// ============================================
const cardKey = id => id || 'none'
export function foldRunning(groups) {
  const r = { cash: 0, transfer: 0, credit: 0, total: 0, count: 0, cards: {} }
  const card = (id, d) => { const k = cardKey(id); r.cards[k] = (r.cards[k] || 0) + d; r.credit += d }
  for (const g of groups) {
    const amt = Number(g.total ?? g.amount) || 0, m = g.payment_method || 'cash'
    r.count += Number(g.n ?? 1)
    if (g.type === 'income') {
      if (m === 'cash') r.cash += amt; else if (m === 'transfer') r.transfer += amt
      r.total += amt
    } else if (g.type === 'expense') {
      if (m === 'cash') r.cash -= amt
      else if (m === 'transfer') r.transfer -= amt
      else if (m === 'credit') card(g.card_id, amt)           // quẹt thẻ: nợ thẻ đó tăng
      r.total -= amt
    } else if (g.type === 'transfer') {                       // payment_method = nguồn chuyển ĐI
      if (m === 'cash') { r.cash -= amt; r.transfer += amt } else { r.transfer -= amt; r.cash += amt }
    } else if (g.type === 'pay_credit') {                     // trả thẻ: nợ thẻ đó giảm
      if (m === 'cash') r.cash -= amt                         //   trả bằng tiền mặt
      else if (m === 'transfer') r.transfer -= amt            //   trả bằng chuyển khoản
      /* m === 'credit': HOÀN TIỀN từ chương trình thẻ — không ai bỏ tiền ra, chỉ giảm nợ thẻ */
      card(g.card_id, -amt)
    } else if (g.type === 'adjust') {                         // điều chỉnh đối soát (có thể âm)
      if (m === 'cash') r.cash += amt; else if (m === 'transfer') r.transfer += amt
      else if (m === 'credit') card(g.card_id, amt)
    }
  }
  return r
}
// Cộng tất cả giao dịch TRƯỚC ngày beforeDate. Ưu tiên để cơ sở dữ liệu tự cộng;
// chưa chạy SQL thì đọc theo trang (không bao giờ bị cắt ở 1.000 dòng).
export async function getRunningBalance(beforeDate) {
  const r1 = await supabase.rpc('expense_totals', { p_before: beforeDate })
  if (!r1.error && Array.isArray(r1.data)) return foldRunning(r1.data)
  const r2 = await supabase.rpc('expense_running_totals', { p_before: beforeDate })
  if (!r2.error && Array.isArray(r2.data)) return foldRunning(r2.data)
  let rows
  try { rows = await fetchAllTx(() => supabase.from('transactions').select('id, date, type, amount, payment_method, card_id').lt('date', beforeDate)) }
  catch { rows = await fetchAllTx(() => supabase.from('transactions').select('id, date, type, amount, payment_method').lt('date', beforeDate)) }
  return foldRunning(rows)
}
// Số dư CUỐI ngày `date` (gồm cả giao dịch trong ngày đó), cộng số dư ban đầu
const nextDay = iso => { const [y, m, d] = iso.split('-').map(Number); return getLocalDateString(new Date(y, m - 1, d + 1)) }
export async function getBalanceAt(date) {
  const [run, init] = await Promise.all([getRunningBalance(nextDay(date)), getInitialBalances()])
  const cards = { ...run.cards }
  cards.none = (cards.none || 0) + init.credit                  // nợ ban đầu chưa gắn với thẻ nào
  return { cash: init.cash + run.cash, transfer: init.transfer + run.transfer, credit: init.credit + run.credit, cards }
}

// ============================================
// THẺ TÍN DỤNG
// ============================================
export async function getCards() {
  const { data, error } = await supabase.from('expense_cards').select('*').eq('is_active', true).order('sort').order('created_at')
  if (error) return []                                           // chưa chạy SQL bản 2 → coi như chưa có thẻ
  return data || []
}
export async function saveCard(card) {
  const fields = { name: card.name.trim(), last4: card.last4 || null, keywords: card.keywords || null, color: card.color || '#7C3AED',
    credit_limit: card.credit_limit ? Number(card.credit_limit) : null,
    statement_day: card.statement_day ? Number(card.statement_day) : null, due_day: card.due_day ? Number(card.due_day) : null }
  const q = card.id ? supabase.from('expense_cards').update(fields).eq('id', card.id) : supabase.from('expense_cards').insert([fields])
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}
// Ẩn thẻ (không xoá): giao dịch cũ vẫn giữ liên kết, số nợ vẫn đúng
export async function archiveCard(id) {
  const { error } = await supabase.from('expense_cards').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// Giao dịch tín dụng chưa phân thẻ (quẹt thẻ, trả thẻ, điều chỉnh thẻ)
export async function getUnassignedCredit(since = null) {
  const rows = await fetchAllTx(() => {
    let q = supabase.from('transactions').select('id, date, type, amount, payment_method, note, card_id, category:app_config(name)').is('card_id', null)
    return since ? q.gte('date', since) : q
  })
  return rows.filter(t => (t.type === 'expense' && t.payment_method === 'credit') || t.type === 'pay_credit' || (t.type === 'adjust' && t.payment_method === 'credit'))
    .sort((a, b) => b.date.localeCompare(a.date))
}
// Gợi ý thẻ theo ghi chú: khớp tên thẻ, 4 số cuối, từ khoá — chỉ gợi ý khi khớp đúng MỘT thẻ
const plain = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
export function cardWords(c) {
  return [c.name, c.last4, ...String(c.keywords || '').split(',')].map(plain).map(x => x.trim()).filter(x => x.length >= 2)
}
export function suggestCard(tx, cards) {
  const text = ' ' + plain(tx.note) + ' ' + plain(tx.category?.name) + ' '
  const hit = cards.filter(c => cardWords(c).some(w => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(text)))
  return hit.length === 1 ? hit[0] : null
}
export async function assignCard(ids, cardId) {
  for (let i = 0; i < ids.length; i += 200) {                    // gửi từng nhóm 200 để không quá dài
    const { error } = await supabase.from('transactions').update({ card_id: cardId }).in('id', ids.slice(i, i + 200))
    if (error) throw error
  }
}

// ============================================
// ĐỐI SOÁT — so số thực tế với số theo app, ghi một dòng điều chỉnh cho phần chênh.
// Không sửa giao dịch cũ. kind: 'cash' | 'transfer' | 'credit' (credit cần cardId, hoặc null = chưa phân thẻ)
// ============================================
export async function previewReconcile({ kind, cardId = null, date }) {
  const b = await getBalanceAt(date)
  return kind === 'credit' ? (b.cards[cardKey(cardId)] || 0) : b[kind]
}
export async function reconcile({ kind, cardId = null, actual, date, note = '' }) {
  const act = Math.round(Number(actual))
  if (!Number.isFinite(act)) throw new Error('Số thực tế không hợp lệ')
  const recorded = Math.round(await previewReconcile({ kind, cardId, date }))
  const diff = act - recorded
  if (diff === 0) return { recorded, diff, tx: null }
  const label = kind === 'cash' ? 'tiền mặt' : kind === 'transfer' ? 'chuyển khoản' : 'nợ thẻ'
  const { data, error } = await supabase.from('transactions').insert([{
    type: 'adjust', payment_method: kind, card_id: kind === 'credit' ? cardId : null, amount: diff, date, category_id: null,
    note: (note ? note + ' · ' : '') + `Đối soát ${label}: thực tế ${act.toLocaleString('vi-VN')}đ, app ${recorded.toLocaleString('vi-VN')}đ`,
    tags: [], linked_order_id: null,
  }]).select('*, category:app_config(id, name, icon, color, metadata)').single()
  if (error) throw error
  return { recorded, diff, tx: data }
}

// ============================================
// CHỐT SỔ THẺ — làm một lần khi bắt đầu theo dõi từng thẻ.
// actuals: { [cardId]: nợ thực tế }. Mỗi thẻ được điều chỉnh về đúng số thực tế,
// phần "chưa phân thẻ" (dữ liệu cũ) đưa về 0. Ghi lại ngày chốt để công cụ phân thẻ
// chỉ xét các giao dịch từ ngày đó trở đi.
// ============================================
export async function closeCardBooks({ actuals, date }) {
  const results = []
  for (const [cardId, actual] of Object.entries(actuals)) {
    if (actual === '' || actual === null || actual === undefined) continue
    results.push({ cardId, ...(await reconcile({ kind: 'credit', cardId, actual, date, note: 'Chốt sổ thẻ' })) })
  }
  results.push({ cardId: null, ...(await reconcile({ kind: 'credit', cardId: null, actual: 0, date, note: 'Chốt sổ thẻ — dữ liệu cũ chưa phân thẻ' })) })
  await supabase.from('settings').upsert([{ key: 'thuchi_card_cutoff', value: date }], { onConflict: 'key' })
  return results
}
export async function getCardCutoff() {
  const { data } = await supabase.from('settings').select('value').eq('key', 'thuchi_card_cutoff').maybeSingle()
  return data?.value || null
}

// ============================================
// MỐC ĐỐI SOÁT — mỗi tài khoản / mỗi thẻ: lần đối soát gần nhất (ngày + lúc ghi)
// Khoá: 'cash' · 'transfer' · 'card:<id>' · 'card:none'
// ============================================
export const accKey = (method, cardId) => method === 'credit' ? 'card:' + (cardId || 'none') : method
// Một giao dịch làm thay đổi số dư của những tài khoản nào
export function affectedKeys(tx) {
  const m = tx.payment_method || 'cash'
  if (tx.type === 'income') return m === 'credit' ? [] : [m]
  if (tx.type === 'expense') return [accKey(m, tx.card_id)]
  if (tx.type === 'transfer') return ['cash', 'transfer']
  if (tx.type === 'pay_credit') return m === 'credit' ? [accKey('credit', tx.card_id)]       // hoàn tiền: chỉ ảnh hưởng thẻ
    : [m === 'cash' ? 'cash' : 'transfer', accKey('credit', tx.card_id)]
  return []                                                   // điều chỉnh không tính là ghi lùi
}
export async function getReconState() {
  let rows = []
  try { rows = await fetchAllTx(() => supabase.from('transactions').select('id, date, created_at, payment_method, card_id').eq('type', 'adjust')) }
  catch { return {} }
  const last = {}
  for (const r of rows) {
    const k = accKey(r.payment_method, r.card_id)
    if (!last[k] || r.date > last[k].date || (r.date === last[k].date && r.created_at > last[k].created_at)) last[k] = { date: r.date, created_at: r.created_at }
  }
  return last
}
// Ghi/sửa/xoá giao dịch ngày TRƯỚC mốc đối soát của tài khoản bị ảnh hưởng → danh sách cảnh báo
// (cùng ngày đối soát thì không nhắc — tránh làm phiền khi vừa đối soát xong ghi tiếp trong ngày)
export function backdateWarnings(tx, last, cards = []) {
  const name = k => k === 'cash' ? 'tiền mặt' : k === 'transfer' ? 'chuyển khoản' : k === 'card:none' ? 'nợ thẻ (chưa phân thẻ)' : 'thẻ ' + (cards.find(c => 'card:' + c.id === k)?.name || '')
  return affectedKeys(tx).filter(k => last[k] && tx.date < last[k].date).map(k => ({ key: k, name: name(k), date: last[k].date }))
}
export const warnText = ws => ws.map(w => `• ${w.name}: đã đối soát tới ngày ${w.date.split('-').reverse().join('/')}`).join('\n')
  + '\n\nGhi vào ngày trước đó sẽ làm lệch số đã đối soát. Vẫn tiếp tục? (Sau đó nên đối soát lại.)'

// ============================================
// SỨC KHOẺ SỔ — tự kiểm, chỉ đọc
// ============================================
const CARD_PAY = /(tra|tt|thanh toan|t\.?t)\s*(the|td|tin dung|vib|vpb|vp|tcb|techcom|sao ke)|tra gop the|the .*tra gop/
const NOT_CARD = /\bsgb\b|vay|lai\b|goc\b|phi the|phi thuong nien/
export async function getMisrecorded() {
  const [rows, keep] = await Promise.all([
    fetchAllTx(() => supabase.from('transactions').select('id, date, type, amount, payment_method, note, category_id, created_at, category:app_config(name)').eq('type', 'expense').in('payment_method', ['cash', 'transfer'])),
    supabase.from('settings').select('value').eq('key', 'thuchi_keep_expense').maybeSingle().then(r => { try { return new Set(JSON.parse(r.data?.value || '[]')) } catch { return new Set() } }),
  ])
  return rows.filter(t => {
    if (keep.has(t.id)) return false
    const text = plain(t.note) + ' ' + plain(t.category?.name)
    return CARD_PAY.test(text) && !NOT_CARD.test(plain(t.note))
  }).sort((a, b) => a.date.localeCompare(b.date))
}
// C — chuyển khoản Chi thành Trả nợ thẻ (giữ nguyên số tiền, ngày, nguồn TM/CK)
export async function convertToPayCredit(id, cardId) {
  const { error } = await supabase.from('transactions').update({ type: 'pay_credit', category_id: null, card_id: cardId || null }).eq('id', id)
  if (error) throw error
}
export async function keepAsExpense(ids) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'thuchi_keep_expense').maybeSingle()
  let cur = []; try { cur = JSON.parse(data?.value || '[]') } catch { /* rỗng */ }
  const { error } = await supabase.from('settings').upsert([{ key: 'thuchi_keep_expense', value: JSON.stringify([...new Set([...cur, ...ids])]) }], { onConflict: 'key' })
  if (error) throw error
}
// Kỳ sao kê gần nhất của thẻ (ngày sao kê đã qua gần nhất)
export function lastStatementDate(statementDay, today) {
  if (!statementDay) return null
  const [y, m, d] = today.split('-').map(Number)
  const mk = (yy, mm) => { const last = new Date(yy, mm, 0).getDate(); return getLocalDateString(new Date(yy, mm - 1, Math.min(statementDay, last))) }
  const thisMonth = mk(y, m)
  return thisMonth <= today ? thisMonth : mk(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)
}
export async function getHealth(cards) {
  const today = getLocalDateString()
  const [last, cutoff] = await Promise.all([getReconState(), getCardCutoff().catch(() => null)])
  const keys = ['cash', 'transfer', ...cards.map(c => 'card:' + c.id)]
  // giao dịch ghi sau mốc đối soát nhưng mang ngày trước mốc
  const minCreated = Object.values(last).map(x => x.created_at).sort()[0]
  let late = []
  if (minCreated) late = await fetchAllTx(() => supabase.from('transactions').select('id, date, created_at, type, amount, payment_method, card_id, note').gte('created_at', minCreated))
  const backdated = Object.fromEntries(keys.map(k => [k, []]))
  for (const t of late) for (const k of affectedKeys(t)) if (last[k] && backdated[k] && t.created_at >= last[k].created_at && t.date < last[k].date) backdated[k].push(t)
  const accounts = keys.map(k => {
    const card = k.startsWith('card:') ? cards.find(c => 'card:' + c.id === k) : null
    const st = card ? lastStatementDate(card.statement_day, today) : null
    return { key: k, card, last: last[k] || null, backdated: backdated[k],
      statementDue: !!(st && (!last[k] || last[k].date < st)), statementDate: st }
  })
  const [unassigned, mis] = await Promise.all([cutoff ? getUnassignedCredit(cutoff).catch(() => []) : Promise.resolve([]), getMisrecorded().catch(() => [])])
  return { accounts, unassigned: unassigned.length, misrecorded: mis }
}
