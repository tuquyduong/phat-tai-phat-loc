// ============================================
// EXPENSES API - v3
// + payment_method: cash / transfer / credit
// + type: income / expense / transfer / pay_credit
// + Lũy kế TM, CK, Nợ TD
// ============================================
import { supabase } from './supabase'

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
  let query = supabase.from('transactions')
    .select('*, category:app_config(id, name, icon, color, metadata)')
    .order('date', { ascending: false }).order('created_at', { ascending: false })
  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createTransaction(tx) {
  const { data, error } = await supabase.from('transactions')
    .insert([{ category_id:tx.category_id||null, type:tx.type, amount:tx.amount,
      date:tx.date||new Date().toISOString().split('T')[0], note:tx.note||'',
      payment_method:tx.payment_method||'cash', tags:tx.tags||[], linked_order_id:tx.linked_order_id||null }])
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
  const { data, error } = await supabase.from('transactions')
    .select('type, amount, category_id, payment_method, category:app_config(id, name, icon, color)')
    .gte('date', startDate).lte('date', endDate)
  if (error) throw error

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

// Lũy kế TRƯỚC ngày chỉ định
// Tính: cash, transfer, credit (nợ TD, số dương = đang nợ)
export async function getRunningBalance(beforeDate) {
  const { data, error } = await supabase.from('transactions')
    .select('type, amount, payment_method').lt('date', beforeDate)
  if (error) throw error
  const r = { cash:0, transfer:0, credit:0, total:0 }
  ;(data || []).forEach(tx => {
    const amt = Number(tx.amount), m = tx.payment_method || 'cash'
    if (tx.type === 'income') {
      if (m==='cash') r.cash+=amt; else if (m==='transfer') r.transfer+=amt
      // Thu vào credit thì ko có ý nghĩa, skip
      r.total += amt
    } else if (tx.type === 'expense') {
      if (m==='cash') r.cash-=amt
      else if (m==='transfer') r.transfer-=amt
      else if (m==='credit') r.credit+=amt // Nợ TD tăng
      r.total -= amt
    } else if (tx.type === 'transfer') {
      // payment_method = nguồn chuyển ĐI
      if (m==='cash') { r.cash-=amt; r.transfer+=amt }
      else { r.transfer-=amt; r.cash+=amt }
    } else if (tx.type === 'pay_credit') {
      // Trả nợ TD: payment_method = nguồn trả (cash hoặc transfer)
      if (m==='cash') r.cash-=amt; else r.transfer-=amt
      r.credit-=amt // Giảm nợ TD
      // total không đổi (đã tính chi lúc mua)
    }
  })
  return r
}
