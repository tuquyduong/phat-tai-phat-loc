// ============================================
// EXPENSES API - FILE MỚI
// Tương tác với bảng: transactions, app_config
// KHÔNG đụng vào bảng cũ
// ============================================
import { supabase } from './supabase'

// ============================================
// DANH MỤC (từ app_config)
// ============================================

export async function getExpenseCategories() {
  const { data, error } = await supabase
    .from('app_config')
    .select('*')
    .eq('module', 'expense')
    .eq('type', 'category')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function createExpenseCategory(category) {
  const { data, error } = await supabase
    .from('app_config')
    .insert([{
      module: 'expense',
      type: 'category',
      name: category.name,
      icon: category.icon || '📦',
      color: category.color || '#6B7280',
      metadata: category.metadata || {},
      sort_order: category.sort_order || 99,
      is_active: true
    }])
    .select().single()
  if (error) throw error
  return data
}

export async function updateExpenseCategory(id, updates) {
  const { error } = await supabase
    .from('app_config').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteExpenseCategory(id) {
  const { error } = await supabase
    .from('app_config').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ============================================
// GIAO DỊCH (transactions)
// ============================================

export async function getTransactions({ startDate, endDate, type, categoryId } = {}) {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      category:app_config(id, name, icon, color, metadata)
    `)
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
      category_id: tx.category_id,
      type: tx.type,
      amount: tx.amount,
      date: tx.date || new Date().toISOString().split('T')[0],
      note: tx.note || '',
      tags: tx.tags || [],
      linked_order_id: tx.linked_order_id || null
    }])
    .select(`
      *,
      category:app_config(id, name, icon, color, metadata)
    `)
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(id, updates) {
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      category:app_config(id, name, icon, color, metadata)
    `)
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// THỐNG KÊ
// ============================================

// Tổng thu/chi theo khoảng thời gian
export async function getExpenseSummary(startDate, endDate) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, category_id, category:app_config(id, name, icon, color)')
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  let totalIncome = 0, totalExpense = 0
  const byCategory = {}

  ;(data || []).forEach(tx => {
    const amt = Number(tx.amount)
    if (tx.type === 'income') totalIncome += amt
    else totalExpense += amt

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
  })

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: Object.values(byCategory)
      .sort((a, b) => (b.expense + b.income) - (a.expense + a.income))
  }
}
