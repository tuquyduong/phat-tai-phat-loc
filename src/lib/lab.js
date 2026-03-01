// ============================================
// LAB API - FILE MỚI
// Tương tác: ingredients, formulas, formula_ingredients, lab_notes
// KHÔNG đụng bảng cũ
// ============================================
import { supabase } from './supabase'

// ============================================
// PHÂN LOẠI CÔNG THỨC (app_config)
// ============================================
export async function getLabCategories() {
  const { data, error } = await supabase
    .from('app_config').select('*')
    .eq('module', 'lab').eq('type', 'formula_category').eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function createLabCategory(name) {
  const { data, error } = await supabase
    .from('app_config').insert([{
      module: 'lab', type: 'formula_category',
      name: name.trim(), icon: '🏷️', color: '#8B5CF6',
      sort_order: 99, is_active: true
    }]).select().single()
  if (error) throw error
  return data
}

export async function deleteLabCategory(id) {
  const { error } = await supabase
    .from('app_config').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ============================================
// NGUYÊN LIỆU
// ============================================
export async function getIngredients() {
  const { data, error } = await supabase
    .from('ingredients').select('*')
    .eq('is_active', true).order('name')
  if (error) throw error
  return data || []
}

export async function createIngredient(item) {
  const { data, error } = await supabase
    .from('ingredients').insert([{
      name: item.name,
      unit: item.unit || 'g',
      price_per_unit: item.price_per_unit || 0,
      supplier: item.supplier || '',
      supplier_contact: item.supplier_contact || '',
      stock_qty: item.stock_qty || 0,
      note: item.note || ''
    }]).select().single()
  if (error) throw error
  return data
}

export async function updateIngredient(id, updates) {
  const { data, error } = await supabase
    .from('ingredients').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteIngredient(id) {
  const { error } = await supabase
    .from('ingredients').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

// ============================================
// CÔNG THỨC
// ============================================
export async function getFormulas() {
  const { data, error } = await supabase
    .from('formulas').select(`
      *,
      items:formula_ingredients(
        id, quantity, unit, note, sort_order,
        ingredient:ingredients(id, name, unit, price_per_unit)
      )
    `)
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(f => ({
    ...f,
    items: (f.items || []).sort((a, b) => a.sort_order - b.sort_order)
  }))
}

export async function createFormula(formula) {
  const { data, error } = await supabase
    .from('formulas').insert([{
      name: formula.name,
      description: formula.description || '',
      base_serving: formula.base_serving || 1,
      category: formula.category || '',
      note: formula.note || '',
      linked_product_id: formula.linked_product_id || null
    }]).select().single()
  if (error) throw error
  return data
}

export async function updateFormula(id, updates) {
  const { error } = await supabase
    .from('formulas').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFormula(id) {
  const { error } = await supabase
    .from('formulas').delete().eq('id', id)
  if (error) throw error
}

export async function toggleFavorite(id, current) {
  const { error } = await supabase
    .from('formulas').update({ is_favorite: !current }).eq('id', id)
  if (error) throw error
}

// ============================================
// NGUYÊN LIỆU TRONG CÔNG THỨC
// ============================================
export async function addFormulaIngredient(fi) {
  const { data, error } = await supabase
    .from('formula_ingredients').insert([{
      formula_id: fi.formula_id,
      ingredient_id: fi.ingredient_id,
      quantity: fi.quantity,
      unit: fi.unit || 'g',
      note: fi.note || '',
      sort_order: fi.sort_order || 0
    }]).select('*, ingredient:ingredients(id, name, unit, price_per_unit)').single()
  if (error) throw error
  return data
}

export async function updateFormulaIngredient(id, updates) {
  const { error } = await supabase
    .from('formula_ingredients').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteFormulaIngredient(id) {
  const { error } = await supabase
    .from('formula_ingredients').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// GHI CHÚ
// ============================================
export async function getLabNotes(formulaId = null) {
  let query = supabase.from('lab_notes').select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (formulaId) query = query.eq('formula_id', formulaId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function createLabNote(note) {
  const { data, error } = await supabase
    .from('lab_notes').insert([{
      title: note.title,
      content: note.content || '',
      type: note.type || 'note',
      formula_id: note.formula_id || null,
      ingredient_id: note.ingredient_id || null,
      tags: note.tags || [],
      is_pinned: note.is_pinned || false
    }]).select().single()
  if (error) throw error
  return data
}

export async function updateLabNote(id, updates) {
  const { error } = await supabase
    .from('lab_notes').update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteLabNote(id) {
  const { error } = await supabase
    .from('lab_notes').delete().eq('id', id)
  if (error) throw error
}

export async function togglePinNote(id, current) {
  const { error } = await supabase
    .from('lab_notes').update({ is_pinned: !current }).eq('id', id)
  if (error) throw error
}

// ============================================
// TÍNH TOÁN
// ============================================
export function calcFormulaCost(items) {
  return items.reduce((sum, fi) => {
    const price = fi.ingredient?.price_per_unit || 0
    return sum + (fi.quantity * price)
  }, 0)
}

export function scaleIngredients(items, baseServing, targetServing) {
  const ratio = targetServing / (baseServing || 1)
  return items.map(fi => ({
    ...fi,
    scaledQty: Math.round(fi.quantity * ratio * 100) / 100
  }))
}
