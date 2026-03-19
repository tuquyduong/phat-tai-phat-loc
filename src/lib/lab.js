// ============================================
// LAB API - v2
// + Steps, Batches (test/production)
// + Unit conversion (g↔kg, ml↔l)
// + Stock deduction + undo
// ============================================
import { supabase } from './supabase'

// ============================================
// UNIT CONVERSION
// ============================================
const UNIT_GROUPS = {
  mass: { g:1, kg:1000 },
  volume: { ml:1, 'lít':1000 }
}

export function getUnitGroup(unit) {
  for (const [group, units] of Object.entries(UNIT_GROUPS)) {
    if (unit in units) return { group, units }
  }
  return null
}

// Convert qty from fromUnit to toUnit. Returns null if incompatible
export function convertUnit(qty, fromUnit, toUnit) {
  if (fromUnit === toUnit) return qty
  const fromG = getUnitGroup(fromUnit), toG = getUnitGroup(toUnit)
  if (!fromG || !toG || fromG.group !== toG.group) return null
  const baseQty = qty * fromG.units[fromUnit]
  return baseQty / toG.units[toUnit]
}

// All units available
export const ALL_UNITS = ['g','kg','ml','lít','thìa cà phê','thìa canh','giọt','viên','gói','cái']

// Convertible units for a given unit
export function getConvertibleUnits(unit) {
  const g = getUnitGroup(unit)
  if (!g) return [unit]
  return Object.keys(g.units)
}

// Format stock with 4 decimals for kg/lít, 2 for others
export function formatStock(qty, unit) {
  const n = Number(qty) || 0
  if (unit === 'kg' || unit === 'lít') return n.toFixed(4)
  if (unit === 'g' || unit === 'ml') return n.toFixed(2)
  return n % 1 === 0 ? String(n) : n.toFixed(2)
}

// ============================================
// PHÂN LOẠI CÔNG THỨC
// ============================================
export async function getLabCategories() {
  const { data, error } = await supabase.from('app_config').select('*')
    .eq('module','lab').eq('type','formula_category').eq('is_active',true).order('sort_order')
  if (error) throw error
  return data || []
}
export async function createLabCategory(name) {
  const { data, error } = await supabase.from('app_config')
    .insert([{ module:'lab', type:'formula_category', name:name.trim(), icon:'🏷️', color:'#8B5CF6', sort_order:99, is_active:true }])
    .select().single()
  if (error) throw error; return data
}
export async function deleteLabCategory(id) {
  const { error } = await supabase.from('app_config').update({ is_active:false }).eq('id',id)
  if (error) throw error
}

// ============================================
// NGUYÊN LIỆU
// ============================================
export async function getIngredients() {
  const { data, error } = await supabase.from('ingredients').select('*').eq('is_active',true).order('name')
  if (error) throw error; return data || []
}
export async function createIngredient(item) {
  const { data, error } = await supabase.from('ingredients')
    .insert([{ name:item.name, unit:item.unit||'g', price_per_unit:item.price_per_unit||0,
      supplier:item.supplier||'', supplier_contact:item.supplier_contact||'',
      stock_qty:item.stock_qty||0, note:item.note||'' }])
    .select().single()
  if (error) throw error; return data
}
export async function updateIngredient(id, updates) {
  const { data, error } = await supabase.from('ingredients')
    .update({ ...updates, updated_at: new Date().toISOString() }).eq('id',id).select().single()
  if (error) throw error; return data
}
export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').update({ is_active:false }).eq('id',id)
  if (error) throw error
}
// Quick update stock
export async function updateStock(id, newQty) {
  const { error } = await supabase.from('ingredients')
    .update({ stock_qty: newQty, updated_at: new Date().toISOString() }).eq('id',id)
  if (error) throw error
}

// ============================================
// CÔNG THỨC
// ============================================
export async function getFormulas() {
  const { data, error } = await supabase.from('formulas').select(`
    *, items:formula_ingredients(id, quantity, unit, note, sort_order,
      ingredient:ingredients(id, name, unit, price_per_unit, stock_qty))
  `).order('is_favorite',{ascending:false}).order('sort_order',{ascending:true}).order('updated_at',{ascending:false})
  if (error) throw error
  return (data||[]).map(f => ({ ...f, sort_order:f.sort_order||0, items:(f.items||[]).sort((a,b)=>a.sort_order-b.sort_order), steps:f.steps||[], extra_costs:f.extra_costs||[], selling_price:f.selling_price||0 }))
}
export async function createFormula(formula) {
  const { data, error } = await supabase.from('formulas')
    .insert([{ name:formula.name, description:formula.description||'', base_serving:formula.base_serving||1,
      category:formula.category||'', note:formula.note||'', steps:formula.steps||[],
      extra_costs:formula.extra_costs||[], selling_price:formula.selling_price||0,
      linked_product_id:formula.linked_product_id||null, sort_order:formula.sort_order||0 }]).select().single()
  if (error) throw error; return data
}
export async function updateFormula(id, updates) {
  const { error } = await supabase.from('formulas').update({ ...updates, updated_at:new Date().toISOString() }).eq('id',id)
  if (error) throw error
}
export async function deleteFormula(id) {
  const { error } = await supabase.from('formulas').delete().eq('id',id)
  if (error) throw error
}
export async function toggleFavorite(id, current) {
  const { error } = await supabase.from('formulas').update({ is_favorite:!current }).eq('id',id)
  if (error) throw error
}
// Batch update sort_order for multiple formulas: [{id, sort_order}]
export async function reorderFormulas(updates) {
  const results = await Promise.all(
    updates.map(u => supabase.from('formulas').update({ sort_order:u.sort_order }).eq('id',u.id))
  )
  const failed = results.find(r => r.error)
  if (failed) throw failed.error
}

// ============================================
// NGUYÊN LIỆU TRONG CÔNG THỨC
// ============================================
export async function addFormulaIngredient(fi) {
  const { data, error } = await supabase.from('formula_ingredients')
    .insert([{ formula_id:fi.formula_id, ingredient_id:fi.ingredient_id, quantity:fi.quantity,
      unit:fi.unit||'g', note:fi.note||'', sort_order:fi.sort_order||0 }])
    .select('*, ingredient:ingredients(id, name, unit, price_per_unit, stock_qty)').single()
  if (error) throw error; return data
}
export async function updateFormulaIngredient(id, updates) {
  const { error } = await supabase.from('formula_ingredients').update(updates).eq('id',id)
  if (error) throw error
}
export async function deleteFormulaIngredient(id) {
  const { error } = await supabase.from('formula_ingredients').delete().eq('id',id)
  if (error) throw error
}
export async function deleteFormulaIngredientsByFormula(formulaId) {
  const { error } = await supabase.from('formula_ingredients').delete().eq('formula_id', formulaId)
  if (error) throw error
}

// ============================================
// BATCHES (Lô sản xuất)
// ============================================
export async function getBatches(formulaId) {
  let q = supabase.from('lab_batches').select('*').order('created_at',{ascending:false})
  if (formulaId) q = q.eq('formula_id', formulaId)
  const { data, error } = await q
  if (error) throw error; return data || []
}

export async function createBatch(batch) {
  const { data, error } = await supabase.from('lab_batches')
    .insert([{ formula_id:batch.formula_id, type:batch.type||'test', serving:batch.serving||1,
      items:batch.items||[], cost:batch.cost||0, note:batch.note||'', result:batch.result||'',
      stock_deducted:false }]).select().single()
  if (error) throw error; return data
}

export async function updateBatch(id, updates) {
  const { error } = await supabase.from('lab_batches').update(updates).eq('id',id)
  if (error) throw error
}

export async function deleteBatch(id) {
  const { error } = await supabase.from('lab_batches').delete().eq('id',id)
  if (error) throw error
}

// Trừ kho cho batch production
// items: [{ingredient_id, quantity, unit}]
// ingredients: full list with stock_qty and unit
export async function deductStock(batchId, items, ingredients) {
  const errors = []
  for (const item of items) {
    const ing = ingredients.find(i => i.id === item.ingredient_id)
    if (!ing) { errors.push(`Không tìm thấy nguyên liệu ${item.ingredient_id}`); continue }
    const converted = convertUnit(item.quantity, item.unit, ing.unit)
    if (converted === null) {
      errors.push(`${ing.name}: không thể convert ${item.unit} → ${ing.unit}`)
      continue
    }
    const newStock = (Number(ing.stock_qty)||0) - converted
    await updateStock(ing.id, newStock)
  }
  // Mark batch as deducted
  await updateBatch(batchId, { stock_deducted: true })
  return errors
}

// Hoàn tồn (undo deduction)
export async function undoDeductStock(batchId, items, ingredients) {
  for (const item of items) {
    const ing = ingredients.find(i => i.id === item.ingredient_id)
    if (!ing) continue
    const converted = convertUnit(item.quantity, item.unit, ing.unit)
    if (converted === null) continue
    const newStock = (Number(ing.stock_qty)||0) + converted
    await updateStock(ing.id, newStock)
  }
  await updateBatch(batchId, { stock_deducted: false })
}

// ============================================
// GHI CHÚ + THÍ NGHIỆM
// ============================================
export async function getLabNotes(formulaId = null) {
  let q = supabase.from('lab_notes').select('*')
    .order('is_pinned',{ascending:false}).order('created_at',{ascending:false})
  if (formulaId) q = q.eq('formula_id', formulaId)
  const { data, error } = await q
  if (error) throw error
  return (data||[]).map(n => ({ ...n, discoveries:n.discoveries||[], changes:n.changes||'', observation:n.observation||'', rating:n.rating||'' }))
}
export async function createLabNote(note) {
  const { data, error } = await supabase.from('lab_notes')
    .insert([{ title:note.title, content:note.content||'', type:note.type||'note',
      formula_id:note.formula_id||null, ingredient_id:note.ingredient_id||null,
      tags:note.tags||[], is_pinned:note.is_pinned||false,
      changes:note.changes||'', observation:note.observation||'', rating:note.rating||'',
      discoveries:note.discoveries||[] }]).select().single()
  if (error) throw error; return data
}
export async function updateLabNote(id, updates) {
  const { error } = await supabase.from('lab_notes').update({ ...updates, updated_at:new Date().toISOString() }).eq('id',id)
  if (error) throw error
}
export async function deleteLabNote(id) {
  const { error } = await supabase.from('lab_notes').delete().eq('id',id)
  if (error) throw error
}
export async function togglePinNote(id, current) {
  const { error } = await supabase.from('lab_notes').update({ is_pinned:!current }).eq('id',id)
  if (error) throw error
}

// ============================================
// TÍNH TOÁN
// ============================================
export function calcFormulaCost(items) {
  return items.reduce((sum, fi) => {
    const price = fi.ingredient?.price_per_unit || 0
    const qty = fi.scaledQty ?? fi.quantity
    const ing = fi.ingredient
    if (ing && fi.unit !== ing.unit) {
      const conv = convertUnit(qty, fi.unit, ing.unit)
      if (conv !== null) return sum + (conv * price)
    }
    return sum + (qty * price)
  }, 0)
}

export function calcExtraCostsTotal(extraCosts) {
  return (extraCosts||[]).reduce((sum, ec) => sum + (Number(ec.amount)||0), 0)
}

export function calcTotalCost(ingredientCost, extraCosts) {
  return ingredientCost + calcExtraCostsTotal(extraCosts)
}

export function scaleIngredients(items, baseServing, targetServing) {
  const ratio = targetServing / (baseServing || 1)
  return items.map(fi => ({
    ...fi, scaledQty: Math.round(fi.quantity * ratio * 10000) / 10000
  }))
}
