// ============================================
// LAB HUB - MODULE CÔNG THỨC & NGUYÊN LIỆU (Phase 2)
// Mobile-first, touch-friendly
// 3 tabs: Công thức | Nguyên liệu | Ghi chú
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw, Plus, Trash2, Edit2, Star, ChevronLeft, ChevronDown, ChevronUp,
  Copy, Search, X, Pin, FlaskConical, Package, StickyNote, Calculator, Settings
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoney } from '../lib/helpers'
import {
  getIngredients, createIngredient, updateIngredient, deleteIngredient,
  getFormulas, createFormula, updateFormula, deleteFormula, toggleFavorite,
  addFormulaIngredient, updateFormulaIngredient, deleteFormulaIngredient,
  getLabNotes, createLabNote, updateLabNote, deleteLabNote, togglePinNote,
  calcFormulaCost, scaleIngredients,
  getLabCategories, createLabCategory, deleteLabCategory
} from '../lib/lab'

// ============================================
// MAIN
// ============================================
export default function Lab() {
  const toast = useToast()
  const toastRef = useRef(toast); toastRef.current = toast

  const [activeTab, setActiveTab] = useState('formulas')
  const [ingredients, setIngredients] = useState([])
  const [formulas, setFormulas] = useState([])
  const [notes, setNotes] = useState([])
  const [labCategories, setLabCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCategoryMgr, setShowCategoryMgr] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ing, frm, nts, cats] = await Promise.all([getIngredients(), getFormulas(), getLabNotes(), getLabCategories()])
      setIngredients(ing); setFormulas(frm); setNotes(nts); setLabCategories(cats)
    } catch (err) {
      console.error(err)
      toastRef.current.error('Lỗi tải dữ liệu')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const tabs = [
    { id: 'formulas', icon: <FlaskConical size={16} />, label: 'Công thức', count: formulas.length },
    { id: 'ingredients', icon: <Package size={16} />, label: 'Nguyên liệu', count: ingredients.length },
    { id: 'notes', icon: <StickyNote size={16} />, label: 'Ghi chú', count: notes.length },
  ]

  return (
    <div className="pb-4">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">🧪 Lab Hub</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowCategoryMgr(true)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" title="Quản lý phân loại">
              <Settings size={18} />
            </button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch('') }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-1 justify-center
                ${activeTab === t.id ? 'bg-purple-500 text-white shadow-md' : 'bg-gray-100 text-gray-600'}`}>
              {t.icon} {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-white/20' : 'bg-gray-200'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-3">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i =>
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          )}</div>
        ) : activeTab === 'formulas' ? (
          <FormulasTab formulas={formulas} ingredients={ingredients} labCategories={labCategories}
            search={search} setSearch={setSearch} onRefresh={loadData} toast={toast} />
        ) : activeTab === 'ingredients' ? (
          <IngredientsTab ingredients={ingredients} search={search}
            setSearch={setSearch} onRefresh={loadData} toast={toast} />
        ) : (
          <NotesTab notes={notes} formulas={formulas} search={search}
            setSearch={setSearch} onRefresh={loadData} toast={toast} />
        )}
      </div>

      {/* Lab Category Manager */}
      <LabCategoryManager isOpen={showCategoryMgr} onClose={() => setShowCategoryMgr(false)}
        categories={labCategories} onChanged={loadData} toast={toast} />
    </div>
  )
}

// ============================================
// SEARCH BAR (dùng chung)
// ============================================
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-3">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm" />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// ============================================
// FORMULAS TAB
// ============================================
function FormulasTab({ formulas, ingredients, labCategories, search, setSearch, onRefresh, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [editingFormula, setEditingFormula] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [servingOverrides, setServingOverrides] = useState({})

  const filtered = useMemo(() => {
    if (!search) return formulas
    const s = search.toLowerCase()
    return formulas.filter(f => f.name.toLowerCase().includes(s) || f.category?.toLowerCase().includes(s))
  }, [formulas, search])

  const handleDelete = async (f) => {
    if (!confirm(`Xóa công thức "${f.name}"?`)) return
    try { await deleteFormula(f.id); toast.success('Đã xóa'); onRefresh() }
    catch { toast.error('Lỗi xóa') }
  }

  const handleToggleFav = async (f) => {
    try { await toggleFavorite(f.id, f.is_favorite); onRefresh() }
    catch { toast.error('Lỗi') }
  }

  const handleCopyList = (f, serving) => {
    const items = scaleIngredients(f.items || [], f.base_serving, serving)
    const text = `📋 ${f.name} (${serving} serving)\n\n` +
      items.map(i => `• ${i.ingredient?.name}: ${i.scaledQty} ${i.unit}`).join('\n')
    navigator.clipboard.writeText(text).then(() => toast.success('Đã copy!')).catch(() => toast.error('Lỗi copy'))
  }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm công thức..." />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">🧪</div>
          <p className="text-gray-500 text-sm">{search ? 'Không tìm thấy' : 'Chưa có công thức nào'}</p>
          <button onClick={() => { setEditingFormula(null); setShowForm(true) }}
            className="mt-3 text-purple-600 font-medium text-sm">+ Tạo công thức đầu tiên</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const isExpanded = expandedId === f.id
            const serving = servingOverrides[f.id] || f.base_serving
            const items = scaleIngredients(f.items || [], f.base_serving, serving)
            const cost = calcFormulaCost(items.map(i => ({ ...i, quantity: i.scaledQty })))

            return (
              <div key={f.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                  <button onClick={(e) => { e.stopPropagation(); handleToggleFav(f) }}
                    className={`flex-shrink-0 ${f.is_favorite ? 'text-yellow-500' : 'text-gray-300'}`}>
                    <Star size={18} fill={f.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {f.category && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded mr-1">{f.category}</span>}
                      {f.items?.length || 0} nguyên liệu
                      {cost > 0 && <span className="ml-1">• ~{formatMoney(cost)}</span>}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                    {f.description && <p className="text-xs text-gray-500 italic">{f.description}</p>}

                    {/* Serving calculator */}
                    <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2">
                      <Calculator size={14} className="text-purple-500" />
                      <span className="text-xs text-purple-700 font-medium">Serving:</span>
                      <button onClick={() => setServingOverrides(s => ({ ...s, [f.id]: Math.max(1, serving - 1) }))}
                        className="w-7 h-7 bg-white rounded-lg text-purple-600 font-bold active:scale-90">−</button>
                      <span className="text-sm font-bold text-purple-700 w-8 text-center">{serving}</span>
                      <button onClick={() => setServingOverrides(s => ({ ...s, [f.id]: serving + 1 }))}
                        className="w-7 h-7 bg-white rounded-lg text-purple-600 font-bold active:scale-90">+</button>
                      {serving !== f.base_serving && (
                        <button onClick={() => setServingOverrides(s => ({ ...s, [f.id]: f.base_serving }))}
                          className="text-[10px] text-purple-500 ml-auto">Reset</button>
                      )}
                    </div>

                    {/* Ingredient list */}
                    {items.length > 0 ? (
                      <div className="space-y-1.5">
                        {items.map(i => (
                          <div key={i.id} className="flex items-center justify-between text-sm py-1">
                            <span className="text-gray-700">{i.ingredient?.name || '?'}</span>
                            <span className="font-medium text-gray-800">
                              {i.scaledQty} {i.unit}
                              {i.ingredient?.price_per_unit > 0 && (
                                <span className="text-xs text-gray-400 ml-1">
                                  ({formatMoney(i.scaledQty * i.ingredient.price_per_unit)})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                        {cost > 0 && (
                          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 font-bold">
                            <span className="text-gray-700">Chi phí ước tính</span>
                            <span className="text-purple-600">{formatMoney(cost)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Chưa có nguyên liệu</p>
                    )}

                    {/* Note */}
                    {f.note && <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">📝 {f.note}</p>}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleCopyList(f, serving)}
                        className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-xs font-medium text-gray-600 active:scale-95">
                        <Copy size={14} /> Copy
                      </button>
                      <button onClick={() => { setEditingFormula(f); setShowForm(true) }}
                        className="flex items-center gap-1 px-3 py-2 bg-purple-50 rounded-lg text-xs font-medium text-purple-600 active:scale-95">
                        <Edit2 size={14} /> Sửa
                      </button>
                      <button onClick={() => handleDelete(f)}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-500 ml-auto active:scale-95">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setEditingFormula(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <Plus size={24} />
      </button>

      {/* Form Modal */}
      <FormulaForm isOpen={showForm} onClose={() => setShowForm(false)}
        formula={editingFormula} ingredients={ingredients} labCategories={labCategories}
        toast={toast} onSaved={onRefresh} />
    </>
  )
}

// ============================================
// FORMULA FORM (Create/Edit)
// ============================================
function FormulaForm({ isOpen, onClose, formula, ingredients, labCategories, toast, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [baseServing, setBaseServing] = useState(1)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([]) // { ingredient_id, quantity, unit }
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (formula) {
        setName(formula.name); setDescription(formula.description || '')
        setBaseServing(formula.base_serving); setCategory(formula.category || '')
        setNote(formula.note || '')
        setItems((formula.items || []).map(i => ({
          id: i.id, ingredient_id: i.ingredient?.id || i.ingredient_id,
          quantity: i.quantity, unit: i.unit
        })))
      } else {
        setName(''); setDescription(''); setBaseServing(1)
        setCategory(''); setNote(''); setItems([])
      }
    }
  }, [isOpen, formula])

  const addItem = () => {
    if (ingredients.length === 0) { toast.error('Thêm nguyên liệu trước!'); return }
    setItems([...items, { ingredient_id: ingredients[0].id, quantity: 0, unit: ingredients[0].unit }])
  }

  const updateItem = (idx, field, value) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [field]: value }
    // Auto set unit when changing ingredient
    if (field === 'ingredient_id') {
      const ing = ingredients.find(i => i.id === value)
      if (ing) newItems[idx].unit = ing.unit
    }
    setItems(newItems)
  }

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Nhập tên công thức'); return }
    setSaving(true)
    try {
      let formulaId
      if (formula) {
        await updateFormula(formula.id, { name: name.trim(), description, base_serving: baseServing, category, note })
        formulaId = formula.id
        // Delete old items, re-insert
        for (const old of (formula.items || [])) {
          await deleteFormulaIngredient(old.id)
        }
      } else {
        const created = await createFormula({ name: name.trim(), description, base_serving: baseServing, category, note })
        formulaId = created.id
      }
      // Insert items
      for (let i = 0; i < items.length; i++) {
        if (items[i].quantity > 0) {
          await addFormulaIngredient({
            formula_id: formulaId,
            ingredient_id: items[i].ingredient_id,
            quantity: items[i].quantity,
            unit: items[i].unit,
            sort_order: i
          })
        }
      }
      toast.success(formula ? 'Đã cập nhật' : 'Đã tạo công thức')
      onClose(); onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formula ? 'Sửa công thức' : '🧪 Tạo công thức'}>
      <div className="space-y-4 p-5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tên công thức *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Nước dưỡng Vitamin C"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" autoFocus />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Phân loại</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white">
              <option value="">-- Chọn --</option>
              {labCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs text-gray-500 mb-1 block">Base serving</label>
            <input type="number" inputMode="numeric" value={baseServing} min={1}
              onChange={e => setBaseServing(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-center" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Mô tả</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Mô tả ngắn..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 font-bold">Nguyên liệu</label>
            <button onClick={addItem}
              className="flex items-center gap-1 text-xs text-purple-600 font-medium px-2 py-1 hover:bg-purple-50 rounded-lg active:scale-95">
              <Plus size={14} /> Thêm
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Bấm "Thêm" để thêm nguyên liệu</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                  <select value={item.ingredient_id} onChange={e => updateItem(idx, 'ingredient_id', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white">
                    {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                  </select>
                  <input type="number" inputMode="decimal" value={item.quantity || ''}
                    onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                    placeholder="0" className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-xs text-center" />
                  <span className="text-xs text-gray-500 w-8">{item.unit}</span>
                  <button onClick={() => removeItem(idx)} className="p-1 text-red-400 active:scale-90">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Mẹo, lưu ý..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none" />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">
            {saving ? '...' : (formula ? 'Cập nhật' : 'Tạo')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// INGREDIENTS TAB
// ============================================
function IngredientsTab({ ingredients, search, setSearch, onRefresh, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return ingredients
    const s = search.toLowerCase()
    return ingredients.filter(i => i.name.toLowerCase().includes(s) || i.supplier?.toLowerCase().includes(s))
  }, [ingredients, search])

  const handleDelete = async (i) => {
    if (!confirm(`Xóa "${i.name}"?`)) return
    try { await deleteIngredient(i.id); toast.success('Đã xóa'); onRefresh() }
    catch { toast.error('Lỗi xóa') }
  }

  const handleSave = async (data) => {
    try {
      if (editing) { await updateIngredient(editing.id, data); toast.success('Đã cập nhật') }
      else { await createIngredient(data); toast.success('Đã thêm') }
      setShowForm(false); onRefresh()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
  }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm nguyên liệu..." />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-gray-500 text-sm">{search ? 'Không tìm thấy' : 'Chưa có nguyên liệu nào'}</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="mt-3 text-purple-600 font-medium text-sm">+ Thêm nguyên liệu</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(i => (
            <div key={i.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{i.name}</p>
                <p className="text-xs text-gray-400">
                  {i.price_per_unit > 0 && <span>{formatMoney(i.price_per_unit)}/{i.unit}</span>}
                  {i.supplier && <span className="ml-2">• {i.supplier}</span>}
                  {i.stock_qty > 0 && <span className="ml-2 text-green-600">Kho: {i.stock_qty} {i.unit}</span>}
                </p>
              </div>
              <button onClick={() => { setEditing(i); setShowForm(true) }}
                className="p-2 text-gray-400 hover:text-purple-500 active:scale-90"><Edit2 size={16} /></button>
              <button onClick={() => handleDelete(i)}
                className="p-2 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setEditing(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <Plus size={24} />
      </button>

      {/* Form */}
      <IngredientForm isOpen={showForm} onClose={() => setShowForm(false)}
        ingredient={editing} onSave={handleSave} />
    </>
  )
}

// ============================================
// INGREDIENT FORM
// ============================================
function IngredientForm({ isOpen, onClose, ingredient, onSave }) {
  const [form, setForm] = useState({ name: '', unit: 'g', price_per_unit: '', supplier: '', supplier_contact: '', stock_qty: '', note: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (ingredient) {
        setForm({
          name: ingredient.name, unit: ingredient.unit, price_per_unit: String(ingredient.price_per_unit || ''),
          supplier: ingredient.supplier || '', supplier_contact: ingredient.supplier_contact || '',
          stock_qty: String(ingredient.stock_qty || ''), note: ingredient.note || ''
        })
      } else {
        setForm({ name: '', unit: 'g', price_per_unit: '', supplier: '', supplier_contact: '', stock_qty: '', note: '' })
      }
    }
  }, [isOpen, ingredient])

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      name: form.name.trim(), unit: form.unit,
      price_per_unit: Number(form.price_per_unit) || 0,
      supplier: form.supplier, supplier_contact: form.supplier_contact,
      stock_qty: Number(form.stock_qty) || 0, note: form.note
    })
    setSaving(false)
  }

  const UNITS = ['g', 'kg', 'ml', 'lít', 'thìa cà phê', 'thìa canh', 'giọt', 'viên', 'gói', 'cái']

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ingredient ? 'Sửa nguyên liệu' : '📦 Thêm nguyên liệu'}>
      <div className="space-y-3 p-5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tên *</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Ví dụ: Vitamin C" autoFocus
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Đơn vị</label>
            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white">
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Giá/đơn vị (đ)</label>
            <input type="number" inputMode="numeric" value={form.price_per_unit}
              onChange={e => setForm({ ...form, price_per_unit: e.target.value })}
              placeholder="0" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nhà cung cấp</label>
            <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
              placeholder="Tên NCC" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">SĐT / Liên hệ</label>
            <input type="text" value={form.supplier_contact} onChange={e => setForm({ ...form, supplier_contact: e.target.value })}
              placeholder="SĐT" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tồn kho</label>
          <input type="number" inputMode="decimal" value={form.stock_qty}
            onChange={e => setForm({ ...form, stock_qty: e.target.value })}
            placeholder="0" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            placeholder="Ghi chú..." className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSubmit} disabled={saving || !form.name.trim()}
            className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">
            {saving ? '...' : (ingredient ? 'Cập nhật' : 'Thêm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// NOTES TAB
// ============================================
function NotesTab({ notes, formulas, search, setSearch, onRefresh, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return notes
    const s = search.toLowerCase()
    return notes.filter(n => n.title.toLowerCase().includes(s) || n.content?.toLowerCase().includes(s))
  }, [notes, search])

  const handleDelete = async (n) => {
    if (!confirm(`Xóa "${n.title}"?`)) return
    try { await deleteLabNote(n.id); toast.success('Đã xóa'); onRefresh() }
    catch { toast.error('Lỗi xóa') }
  }

  const handlePin = async (n) => {
    try { await togglePinNote(n.id, n.is_pinned); onRefresh() }
    catch { toast.error('Lỗi') }
  }

  const handleSave = async (data) => {
    try {
      if (editing) { await updateLabNote(editing.id, data); toast.success('Đã cập nhật') }
      else { await createLabNote(data); toast.success('Đã thêm') }
      setShowForm(false); onRefresh()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
  }

  const typeLabels = { note: '📝 Ghi chú', experiment: '🔬 Thí nghiệm', discovery: '💡 Phát hiện' }
  const typeColors = { note: 'bg-gray-100 text-gray-600', experiment: 'bg-blue-100 text-blue-600', discovery: 'bg-amber-100 text-amber-600' }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm ghi chú..." />

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📝</div>
          <p className="text-gray-500 text-sm">{search ? 'Không tìm thấy' : 'Chưa có ghi chú nào'}</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="mt-3 text-purple-600 font-medium text-sm">+ Thêm ghi chú</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id} className="bg-white rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {n.is_pinned && <Pin size={12} className="text-amber-500" />}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[n.type] || typeColors.note}`}>
                      {typeLabels[n.type] || '📝 Ghi chú'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{n.title}</p>
                  {n.content && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>}
                  <p className="text-[10px] text-gray-300 mt-1">
                    {new Date(n.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => handlePin(n)}
                    className={`p-1.5 rounded-lg active:scale-90 ${n.is_pinned ? 'text-amber-500' : 'text-gray-300'}`}>
                    <Pin size={14} />
                  </button>
                  <button onClick={() => { setEditing(n); setShowForm(true) }}
                    className="p-1.5 text-gray-400 hover:text-purple-500 active:scale-90"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(n)}
                    className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setEditing(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40" style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <Plus size={24} />
      </button>

      {/* Form */}
      <NoteForm isOpen={showForm} onClose={() => setShowForm(false)}
        note={editing} formulas={formulas} onSave={handleSave} />
    </>
  )
}

// ============================================
// NOTE FORM
// ============================================
function NoteForm({ isOpen, onClose, note, formulas, onSave }) {
  const [form, setForm] = useState({ title: '', content: '', type: 'note', formula_id: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (note) {
        setForm({ title: note.title, content: note.content || '', type: note.type || 'note', formula_id: note.formula_id || '' })
      } else {
        setForm({ title: '', content: '', type: 'note', formula_id: '' })
      }
    }
  }, [isOpen, note])

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    await onSave({
      title: form.title.trim(), content: form.content,
      type: form.type, formula_id: form.formula_id || null
    })
    setSaving(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={note ? 'Sửa ghi chú' : '📝 Thêm ghi chú'}>
      <div className="space-y-3 p-5">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Loại</label>
          <div className="flex gap-2">
            {[['note', '📝 Ghi chú'], ['experiment', '🔬 Thí nghiệm'], ['discovery', '💡 Phát hiện']].map(([v, l]) => (
              <button key={v} onClick={() => setForm({ ...form, type: v })}
                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${form.type === v ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tiêu đề *</label>
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="Tiêu đề ghi chú" autoFocus
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nội dung</label>
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
            rows={4} placeholder="Nội dung chi tiết..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none" />
        </div>

        {formulas.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Liên kết công thức (tùy chọn)</label>
            <select value={form.formula_id} onChange={e => setForm({ ...form, formula_id: e.target.value })}
              className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white">
              <option value="">-- Không liên kết --</option>
              {formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSubmit} disabled={saving || !form.title.trim()}
            className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">
            {saving ? '...' : (note ? 'Cập nhật' : 'Thêm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// LAB CATEGORY MANAGER
// ============================================
function LabCategoryManager({ isOpen, onClose, categories, onChanged, toast }) {
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    if (categories.some(c => c.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error('Phân loại đã tồn tại'); return
    }
    setSaving(true)
    try {
      await createLabCategory(newName.trim())
      toast.success(`Đã thêm "${newName.trim()}"`)
      setNewName('')
      onChanged()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Xóa phân loại "${cat.name}"?`)) return
    try {
      await deleteLabCategory(cat.id)
      toast.success('Đã xóa')
      onChanged()
    } catch { toast.error('Lỗi xóa') }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Quản lý phân loại công thức">
      <div className="space-y-4 p-5">
        <p className="text-xs text-gray-500">Thêm/xóa phân loại hiển thị khi tạo công thức</p>

        {/* Danh sách hiện tại */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Chưa có phân loại nào</p>
          ) : categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
              <button onClick={() => handleDelete(cat)}
                className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        {/* Thêm mới */}
        <div className="flex gap-2">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Tên phân loại mới..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} />
          <button onClick={handleAdd} disabled={saving || !newName.trim()}
            className="px-4 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95">
            {saving ? '...' : '+ Thêm'}
          </button>
        </div>

        <button onClick={onClose}
          className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">
          Đóng
        </button>
      </div>
    </Modal>
  )
}
