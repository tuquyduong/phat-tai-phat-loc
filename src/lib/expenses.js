// ============================================
// EXPENSES API - v2
// + payment_method (cash/transfer)
// + Số dư lũy kế (running balance)
// + Chuyển nội bộ TM↔CK (type='transfer')
// + Số dư ban đầu (app_config)
// ============================================
import { supabase } from './supabase'

// ============================================
// DANH MỤC (từ app_config)
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
  const { data, error } = await supabase
    .from('app_config')
    .insert([{
      module: 'expense', type: 'category',
      name: category.name, icon: category.icon || '📦',
      color: category.color || '#6B7280',
      metadata: category.metadata || {},
      sort_order: category.sort_order || 99, is_active: true
    }])
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
// SỐ DƯ BAN ĐẦU (app_config)
// ============================================
export async function getInitialBalances() {
  const { data, error } = await supabase
    .from('app_config').select('*')
    .eq('module', 'expense').eq('type', 'initial_balance').eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  if (data) {
    return { cash: Number(data.metadata?.cash) || 0, transfer: Number(data.metadata?.transfer) || 0, id: data.id }
  }
  return { cash: 0, transfer: 0, id: null }
}

export async function saveInitialBalances(cash, transfer, existingId) {
  const payload = {
    module: 'expense', type: 'initial_balance', name: 'Số dư ban đầu',
    icon: '💰', color: '#3B82F6',
    metadata: { cash: Number(cash) || 0, transfer: Number(transfer) || 0 },
    is_active: true
  }
  if (existingId) {
    const { error } = await supabase.from('app_config').update(payload).eq('id', existingId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('app_config').insert([payload])
    if (error) throw error
  }
}

// ============================================
// GIAO DỊCH
// ============================================
export async function getTransactions({ startDate, endDate, type, categoryId } = {}) {
  let query = supabase
    .from('transactions')
    .select('*, category:app_config(id, name, icon, color, metadata)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)
  if (type) query = query.eq('type', type)
  if (categoryId) query = query.eq('category_id', categoryId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createTransaction(tx) {
  const { data, error } = await supabase
    .from('transactions')
    .insert([{
      category_id: tx.category_id || null, type: tx.type,
      amount: tx.amount, date: tx.date || new Date().toISOString().split('T')[0],
      note: tx.note || '', payment_method: tx.payment_method || 'cash',
      tags: tx.tags || [], linked_order_id: tx.linked_order_id || null
    }])
    .select('*, category:app_config(id, name, icon, color, metadata)')
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase
    .from('transactions').update(updates).eq('id', id)
    .select('*, category:app_config(id, name, icon, color, metadata)')
    .single()
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
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, category_id, payment_method, category:app_config(id, name, icon, color)')
    .gte('date', startDate).lte('date', endDate)
  if (error) throw error

  let totalIncome = 0, totalExpense = 0
  const byCategory = {}
  const byMethod = { cash: { income: 0, expense: 0 }, transfer: { income: 0, expense: 0 } }

  ;(data || []).forEach(tx => {
    const amt = Number(tx.amount)
    const method = tx.payment_method || 'cash'
    if (tx.type === 'income') {
      totalIncome += amt
      if (byMethod[method]) byMethod[method].income += amt
    } else if (tx.type === 'expense') {
      totalExpense += amt
      if (byMethod[method]) byMethod[method].expense += amt
    }
    // transfer không tính vào thu/chi
    if (tx.type !== 'transfer') {
      const catId = tx.category_id || 'none'
      if (!byCategory[catId]) {
        byCategory[catId] = {
          category: tx.category || { name: 'Khác', icon: '📦', color: '#6B7280' },
          income: 0, expense: 0, count: 0
        }
      }
      if (tx.type === 'income') byCategory[catId].income += amt
      else byCategory[catId].expense += amt
      byCategory[catId].count++
    }
  })
  return {
    totalIncome, totalExpense, balance: totalIncome - totalExpense,
    byCategory: Object.values(byCategory).sort((a, b) => (b.expense + b.income) - (a.expense + a.income)),
    byMethod
  }
}

// Số dư lũy kế TRƯỚC ngày chỉ định
export async function getRunningBalance(beforeDate) {
  const { data, error } = await supabase
    .from('transactions').select('type, amount, payment_method').lt('date', beforeDate)
  if (error) throw error
  const result = { cash: 0, transfer: 0, total: 0 }
  ;(data || []).forEach(tx => {
    const amt = Number(tx.amount)
    const method = tx.payment_method || 'cash'
    if (tx.type === 'income') {
      if (method === 'cash') result.cash += amt; else result.transfer += amt
      result.total += amt
    } else if (tx.type === 'expense') {
      if (method === 'cash') result.cash -= amt; else result.transfer -= amt
      result.total -= amt
    } else if (tx.type === 'transfer') {
      // payment_method = nguồn chuyển ĐI
      if (method === 'cash') { result.cash -= amt; result.transfer += amt }
      else { result.transfer -= amt; result.cash += amt }
    }
  })
  return result
}
