// ============================================
// LAB HUB - v2
// + Steps, Batches (test/production), Unit convert
// + Quick edit stock, 4 decimal display
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw, Plus, Trash2, Edit2, Star, ChevronDown, ChevronUp,
  Copy, Search, X, Pin, FlaskConical, Package, StickyNote, Calculator, Settings,
  Play, Undo2, CheckCircle, Layers
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoney } from '../lib/helpers'
import {
  getIngredients, createIngredient, updateIngredient, deleteIngredient, updateStock,
  getFormulas, createFormula, updateFormula, deleteFormula, toggleFavorite,
  addFormulaIngredient, deleteFormulaIngredient,
  getLabNotes, createLabNote, updateLabNote, deleteLabNote, togglePinNote,
  getBatches, createBatch, deleteBatch, deductStock, undoDeductStock,
  calcFormulaCost, scaleIngredients, formatStock, convertUnit, getConvertibleUnits, ALL_UNITS,
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
  const [batches, setBatches] = useState([])
  const [labCategories, setLabCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCategoryMgr, setShowCategoryMgr] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ing,frm,nts,cats,bat] = await Promise.all([getIngredients(),getFormulas(),getLabNotes(),getLabCategories(),getBatches()])
      setIngredients(ing); setFormulas(frm); setNotes(nts); setLabCategories(cats); setBatches(bat)
    } catch(err) { console.error(err); toastRef.current.error('Lỗi tải dữ liệu') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const tabs = [
    { id:'formulas', icon:<FlaskConical size={16}/>, label:'Công thức', count:formulas.length },
    { id:'ingredients', icon:<Package size={16}/>, label:'Nguyên liệu', count:ingredients.length },
    { id:'batches', icon:<Layers size={16}/>, label:'Lô SX', count:batches.length },
    { id:'notes', icon:<StickyNote size={16}/>, label:'Ghi chú', count:notes.length },
  ]

  return (
    <div className="pb-4">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">🧪 Lab Hub</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowCategoryMgr(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><Settings size={18}/></button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><RefreshCw size={18} className={loading?'animate-spin':''}/></button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch('') }}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium flex-1 justify-center ${activeTab===t.id?'bg-purple-500 text-white shadow-md':'bg-gray-100 text-gray-600'}`}>
              {t.icon} {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab===t.id?'bg-white/20':'bg-gray-200'}`}>{t.count}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-3">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2"/><div className="h-3 bg-gray-100 rounded w-3/4"/></div>)}</div>
        ) : activeTab==='formulas' ? (
          <FormulasTab formulas={formulas} ingredients={ingredients} labCategories={labCategories} search={search} setSearch={setSearch} onRefresh={loadData} toast={toast} />
        ) : activeTab==='ingredients' ? (
          <IngredientsTab ingredients={ingredients} search={search} setSearch={setSearch} onRefresh={loadData} toast={toast} />
        ) : activeTab==='batches' ? (
          <BatchesTab batches={batches} formulas={formulas} ingredients={ingredients} search={search} setSearch={setSearch} onRefresh={loadData} toast={toast} />
        ) : (
          <NotesTab notes={notes} formulas={formulas} search={search} setSearch={setSearch} onRefresh={loadData} toast={toast} />
        )}
      </div>

      <LabCategoryManager isOpen={showCategoryMgr} onClose={() => setShowCategoryMgr(false)} categories={labCategories} onChanged={loadData} toast={toast} />
    </div>
  )
}

// Search bar
function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="relative mb-3">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm"/>
      {value && <button onClick={() => onChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16}/></button>}
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
  const [showBatchForm, setShowBatchForm] = useState(null) // formula object

  const filtered = useMemo(() => {
    if (!search) return formulas
    const s = search.toLowerCase()
    return formulas.filter(f => f.name.toLowerCase().includes(s) || f.category?.toLowerCase().includes(s))
  }, [formulas, search])

  const handleDelete = async (f) => {
    if(!confirm(`Xóa "${f.name}"?`)) return
    try { await deleteFormula(f.id); toast.success('Đã xóa'); onRefresh() } catch { toast.error('Lỗi xóa') }
  }
  const handleToggleFav = async (f) => {
    try { await toggleFavorite(f.id, f.is_favorite); onRefresh() } catch { toast.error('Lỗi') }
  }
  const handleCopyList = (f, serving) => {
    const items = scaleIngredients(f.items||[], f.base_serving, serving)
    const ingCost = calcFormulaCost(items.map(i => ({...i, quantity:i.scaledQty})))
    const ratio = serving / (f.base_serving||1)
    const extraTotal = (f.extra_costs||[]).reduce((s,ec) => s + Math.round((Number(ec.amount)||0)*ratio), 0)
    const total = ingCost + extraTotal
    const sell = Math.round((f.selling_price||0)*ratio)
    let text = `📋 ${f.name} (${serving} serving)\n\n` +
      items.map(i => `• ${i.ingredient?.name}: ${i.scaledQty} ${i.unit}`).join('\n')
    if (f.extra_costs?.length) text += '\n\n💰 Chi phí khác:\n' + f.extra_costs.map(ec => `• ${ec.name}: ${formatMoney(Math.round(Number(ec.amount)*ratio))}`).join('\n')
    if (total>0) text += `\n\n💰 Tổng giá vốn: ${formatMoney(total)}`
    if (sell>0) text += `\n🏷️ Giá bán: ${formatMoney(sell)}\n📊 Lợi nhuận: ${formatMoney(sell-total)} (${total>0?Math.round((sell-total)/total*100):0}%)`
    if (f.steps?.length) text += '\n\n📝 Các bước:\n' + f.steps.map((s,i) => `${i+1}. ${s.title}${s.desc?' - '+s.desc:''}${s.note?' ['+s.note+']':''}`).join('\n')
    navigator.clipboard.writeText(text).then(() => toast.success('Đã copy!')).catch(() => toast.error('Lỗi copy'))
  }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm công thức..."/>
      {filtered.length===0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">🧪</div>
          <p className="text-gray-500 text-sm">{search?'Không tìm thấy':'Chưa có công thức nào'}</p>
          <button onClick={() => { setEditingFormula(null); setShowForm(true) }} className="mt-3 text-purple-600 font-medium text-sm">+ Tạo công thức đầu tiên</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const isExp = expandedId===f.id
            const serving = servingOverrides[f.id]||f.base_serving
            const items = scaleIngredients(f.items||[], f.base_serving, serving)
            const ingCost = calcFormulaCost(items.map(i => ({...i, quantity:i.scaledQty})))
            const ratio = serving / (f.base_serving||1)
            const scaledExtra = (f.extra_costs||[]).map(ec => ({...ec, scaled: Math.round((Number(ec.amount)||0)*ratio)}))
            const extraTotal = scaledExtra.reduce((s,ec) => s+ec.scaled, 0)
            const totalCost = ingCost + extraTotal
            const sellPrice = Math.round((f.selling_price||0)*ratio)
            const profit = sellPrice - totalCost

            return (
              <div key={f.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50" onClick={() => setExpandedId(isExp?null:f.id)}>
                  <button onClick={e => { e.stopPropagation(); handleToggleFav(f) }} className={`flex-shrink-0 ${f.is_favorite?'text-yellow-500':'text-gray-300'}`}>
                    <Star size={18} fill={f.is_favorite?'currentColor':'none'}/>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">
                      {f.category && <span className="bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded mr-1">{f.category}</span>}
                      {f.items?.length||0} NL {totalCost>0 && <span>• ~{formatMoney(totalCost)}</span>}
                      {f.steps?.length>0 && <span> • {f.steps.length} bước</span>}
                      {sellPrice>0 && totalCost>0 && <span className={profit>=0?'text-green-600':'text-red-500'}> • LN {Math.round(profit/totalCost*100)}%</span>}
                    </p>
                  </div>
                  {isExp ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>}
                </div>

                {isExp && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                    {f.description && <p className="text-xs text-gray-500 italic">{f.description}</p>}

                    {/* Serving calc */}
                    <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2">
                      <Calculator size={14} className="text-purple-500"/>
                      <span className="text-xs text-purple-700 font-medium">Serving:</span>
                      <button onClick={() => setServingOverrides(s => ({...s,[f.id]:Math.max(1,serving-1)}))} className="w-7 h-7 bg-white rounded-lg text-purple-600 font-bold active:scale-90">−</button>
                      <span className="text-sm font-bold text-purple-700 w-8 text-center">{serving}</span>
                      <button onClick={() => setServingOverrides(s => ({...s,[f.id]:serving+1}))} className="w-7 h-7 bg-white rounded-lg text-purple-600 font-bold active:scale-90">+</button>
                      {serving!==f.base_serving && <button onClick={() => setServingOverrides(s => ({...s,[f.id]:f.base_serving}))} className="text-[10px] text-purple-500 ml-auto">Reset</button>}
                    </div>

                    {/* Ingredients */}
                    {items.length>0 ? (
                      <div className="space-y-1.5">
                        {items.map(i => {
                          const ing = i.ingredient
                          const stockInUnit = ing ? convertUnit(ing.stock_qty, ing.unit, i.unit) : null
                          return (
                            <div key={i.id} className="flex items-center justify-between text-sm py-1">
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-700">{ing?.name||'?'}</span>
                                {ing && stockInUnit!==null && <span className="text-[10px] text-gray-400 ml-1.5">(tồn: {formatStock(stockInUnit, i.unit)} {i.unit})</span>}
                                {ing && stockInUnit===null && i.unit!==ing?.unit && <span className="text-[10px] text-red-400 ml-1.5">(⚠ {ing.unit}≠{i.unit})</span>}
                              </div>
                              <span className="font-medium text-gray-800">
                                {i.scaledQty} {i.unit}
                                {ing?.price_per_unit>0 && <span className="text-xs text-gray-400 ml-1">({formatMoney(calcFormulaCost([{...i,quantity:i.scaledQty}]))})</span>}
                              </span>
                            </div>
                          )
                        })}
                        {ingCost>0 && <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 font-bold"><span className="text-gray-700">NL</span><span className="text-purple-600">{formatMoney(ingCost)}</span></div>}
                      </div>
                    ) : <p className="text-xs text-gray-400 italic">Chưa có nguyên liệu</p>}

                    {/* Extra costs + Total */}
                    {(scaledExtra.length>0 || sellPrice>0) && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 space-y-1.5">
                        {scaledExtra.length>0 && scaledExtra.map((ec,i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{ec.name}</span>
                            <span className="font-medium text-gray-700">{formatMoney(ec.scaled)}</span>
                          </div>
                        ))}
                        {totalCost>0 && (
                          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-purple-200 font-bold">
                            <span className="text-gray-700">💰 Tổng giá vốn</span>
                            <span className="text-purple-700">{formatMoney(totalCost)}</span>
                          </div>
                        )}
                        {sellPrice>0 && (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">🏷️ Giá bán</span>
                              <span className="font-bold text-blue-600">{formatMoney(sellPrice)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">📊 Lợi nhuận</span>
                              <span className={`font-bold ${profit>=0?'text-green-600':'text-red-600'}`}>{profit>=0?'+':''}{formatMoney(profit)} ({totalCost>0?Math.round(profit/totalCost*100):0}%)</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Steps */}
                    {f.steps?.length>0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-bold text-gray-600 mb-2">📝 Các bước</p>
                        <div className="space-y-2">
                          {f.steps.map((s,i) => (
                            <div key={i} className="flex gap-2">
                              <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700">{s.title}</p>
                                {s.desc && <p className="text-[11px] text-gray-500">{s.desc}</p>}
                                {s.note && <p className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded mt-0.5">💡 {s.note}</p>}
                                {s.duration>0 && <p className="text-[10px] text-gray-400">⏱ {s.duration} phút</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {f.note && <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">📝 {f.note}</p>}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={() => setShowBatchForm(f)} className="flex items-center gap-1 px-3 py-2 bg-green-50 rounded-lg text-xs font-medium text-green-600 active:scale-95"><Play size={14}/> Làm lô</button>
                      <button onClick={() => handleCopyList(f, serving)} className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-lg text-xs font-medium text-gray-600 active:scale-95"><Copy size={14}/> Copy</button>
                      <button onClick={() => { setEditingFormula(f); setShowForm(true) }} className="flex items-center gap-1 px-3 py-2 bg-purple-50 rounded-lg text-xs font-medium text-purple-600 active:scale-95"><Edit2 size={14}/> Sửa</button>
                      <button onClick={() => handleDelete(f)} className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-500 ml-auto active:scale-95"><Trash2 size={14}/></button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button onClick={() => { setEditingFormula(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 z-40" style={{bottom:"calc(4.5rem + env(safe-area-inset-bottom, 0px))"}}>
        <Plus size={24}/>
      </button>

      <FormulaForm isOpen={showForm} onClose={() => setShowForm(false)} formula={editingFormula} ingredients={ingredients} labCategories={labCategories} toast={toast} onSaved={onRefresh}/>
      {showBatchForm && <BatchForm isOpen={!!showBatchForm} onClose={() => setShowBatchForm(null)} formula={showBatchForm} ingredients={ingredients} toast={toast} onSaved={onRefresh}/>}
    </>
  )
}

// ============================================
// FORMULA FORM - Steps + Unit dropdown
// ============================================
function FormulaForm({ isOpen, onClose, formula, ingredients, labCategories, toast, onSaved }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('')
  const [baseServing, setBaseServing] = useState(1); const [category, setCategory] = useState('')
  const [note, setNote] = useState(''); const [items, setItems] = useState([])
  const [steps, setSteps] = useState([]); const [extraCosts, setExtraCosts] = useState([])
  const [sellingPrice, setSellingPrice] = useState(''); const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (formula) {
        setName(formula.name); setDescription(formula.description||'')
        setBaseServing(formula.base_serving); setCategory(formula.category||'')
        setNote(formula.note||'')
        setItems((formula.items||[]).map(i => ({ id:i.id, ingredient_id:i.ingredient?.id||i.ingredient_id, quantity:i.quantity, unit:i.unit })))
        setSteps((formula.steps||[]).map(s => ({...s})))
        setExtraCosts((formula.extra_costs||[]).map(ec => ({...ec})))
        setSellingPrice(String(formula.selling_price||''))
      } else { setName(''); setDescription(''); setBaseServing(1); setCategory(''); setNote(''); setItems([]); setSteps([]); setExtraCosts([]); setSellingPrice('') }
    }
  }, [isOpen, formula])

  const addItem = () => {
    if(!ingredients.length) { toast.error('Thêm nguyên liệu trước!'); return }
    setItems([...items, { ingredient_id:ingredients[0].id, quantity:0, unit:ingredients[0].unit }])
  }
  const updateItem = (idx, field, value) => {
    const n = [...items]; n[idx] = {...n[idx],[field]:value}
    if (field==='ingredient_id') { const ing=ingredients.find(i=>i.id===value); if(ing) n[idx].unit=ing.unit }
    setItems(n)
  }
  const addStep = () => setSteps([...steps, { title:'', desc:'', note:'', duration:0 }])
  const updateStep = (idx, field, value) => { const n=[...steps]; n[idx]={...n[idx],[field]:value}; setSteps(n) }
  const addExtraCost = () => setExtraCosts([...extraCosts, { name:'', amount:0 }])
  const updateExtraCost = (idx, field, value) => { const n=[...extraCosts]; n[idx]={...n[idx],[field]:value}; setExtraCosts(n) }

  const handleSave = async () => {
    if(!name.trim()) { toast.error('Nhập tên'); return }
    setSaving(true)
    try {
      const cleanSteps = steps.filter(s => s.title.trim()).map((s,i) => ({...s, order:i+1}))
      const cleanExtra = extraCosts.filter(ec => ec.name.trim() && Number(ec.amount)>0).map(ec => ({name:ec.name.trim(), amount:Number(ec.amount)}))
      let fId
      if (formula) {
        await updateFormula(formula.id, { name:name.trim(), description, base_serving:baseServing, category, note, steps:cleanSteps, extra_costs:cleanExtra, selling_price:Number(sellingPrice)||0 })
        fId = formula.id
        for (const old of (formula.items||[])) await deleteFormulaIngredient(old.id)
      } else {
        const c = await createFormula({ name:name.trim(), description, base_serving:baseServing, category, note, steps:cleanSteps, extra_costs:cleanExtra, selling_price:Number(sellingPrice)||0 })
        fId = c.id
      }
      for (let i=0; i<items.length; i++) {
        if (items[i].quantity>0) await addFormulaIngredient({ formula_id:fId, ingredient_id:items[i].ingredient_id, quantity:items[i].quantity, unit:items[i].unit, sort_order:i })
      }
      toast.success(formula?'Đã cập nhật':'Đã tạo'); onClose(); onSaved()
    } catch(err) { toast.error('Lỗi: '+err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={formula?'Sửa công thức':'🧪 Tạo công thức'}>
      <div className="space-y-4 p-5">
        <div><label className="text-xs text-gray-500 mb-1 block">Tên *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ví dụ: Serum Vitamin C" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" autoFocus/></div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">Phân loại</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white">
              <option value="">-- Chọn --</option>{labCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select></div>
          <div className="w-24"><label className="text-xs text-gray-500 mb-1 block">Serving</label>
            <input type="number" inputMode="numeric" value={baseServing} min={1} onChange={e => setBaseServing(Math.max(1,Number(e.target.value)))} className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm text-center"/></div>
        </div>
        <div><label className="text-xs text-gray-500 mb-1 block">Mô tả</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả ngắn..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 font-bold">Nguyên liệu</label>
            <button onClick={addItem} className="flex items-center gap-1 text-xs text-purple-600 font-medium px-2 py-1 hover:bg-purple-50 rounded-lg active:scale-95"><Plus size={14}/> Thêm</button>
          </div>
          {items.length===0 ? <p className="text-xs text-gray-400 text-center py-3">Bấm "Thêm" để thêm nguyên liệu</p> : (
            <div className="space-y-2">{items.map((item,idx) => {
              const ing = ingredients.find(i => i.id===item.ingredient_id)
              const convUnits = ing ? getConvertibleUnits(ing.unit) : [item.unit]
              const allUnits = [...new Set([...convUnits, item.unit, ...(ing?[ing.unit]:[]) ])]
              return (
                <div key={idx} className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2">
                  <select value={item.ingredient_id} onChange={e => updateItem(idx,'ingredient_id',e.target.value)}
                    className="flex-1 min-w-0 px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white">
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input type="number" inputMode="decimal" value={item.quantity||''} onChange={e => updateItem(idx,'quantity',Number(e.target.value))}
                    placeholder="0" className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-xs text-center"/>
                  <select value={item.unit} onChange={e => updateItem(idx,'unit',e.target.value)}
                    className="w-14 px-1 py-2 border border-gray-200 rounded-lg text-xs bg-white">
                    {allUnits.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={() => setItems(items.filter((_,i) => i!==idx))} className="p-1 text-red-400 active:scale-90"><X size={16}/></button>
                </div>
              )
            })}</div>
          )}
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 font-bold">Các bước</label>
            <button onClick={addStep} className="flex items-center gap-1 text-xs text-purple-600 font-medium px-2 py-1 hover:bg-purple-50 rounded-lg active:scale-95"><Plus size={14}/> Thêm</button>
          </div>
          {steps.length===0 ? <p className="text-xs text-gray-400 text-center py-2">Tùy chọn: thêm các bước thực hiện</p> : (
            <div className="space-y-2">{steps.map((s,idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx+1}</span>
                  <input type="text" value={s.title} onChange={e => updateStep(idx,'title',e.target.value)} placeholder="Tên bước *"
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"/>
                  <input type="number" value={s.duration||''} onChange={e => updateStep(idx,'duration',Number(e.target.value))} placeholder="phút"
                    className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center"/>
                  <button onClick={() => setSteps(steps.filter((_,i)=>i!==idx))} className="p-1 text-red-400 active:scale-90"><X size={14}/></button>
                </div>
                <input type="text" value={s.desc||''} onChange={e => updateStep(idx,'desc',e.target.value)} placeholder="Mô tả chi tiết..."
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"/>
                <input type="text" value={s.note||''} onChange={e => updateStep(idx,'note',e.target.value)} placeholder="💡 Ghi chú / mẹo..."
                  className="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-xs bg-amber-50"/>
              </div>
            ))}</div>
          )}
        </div>

        {/* Extra Costs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 font-bold">Chi phí khác</label>
            <button onClick={addExtraCost} className="flex items-center gap-1 text-xs text-purple-600 font-medium px-2 py-1 hover:bg-purple-50 rounded-lg active:scale-95"><Plus size={14}/> Thêm</button>
          </div>
          {extraCosts.length===0 ? <p className="text-xs text-gray-400 text-center py-2">Bao bì, nhân công, vận chuyển...</p> : (
            <div className="space-y-2">{extraCosts.map((ec,idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <input type="text" value={ec.name} onChange={e => updateExtraCost(idx,'name',e.target.value)} placeholder="Tên chi phí"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"/>
                <div className="relative w-24">
                  <input type="number" inputMode="numeric" value={ec.amount||''} onChange={e => updateExtraCost(idx,'amount',e.target.value)} placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-right pr-6"/>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">đ</span>
                </div>
                <button onClick={() => setExtraCosts(extraCosts.filter((_,i)=>i!==idx))} className="p-1 text-red-400 active:scale-90"><X size={14}/></button>
              </div>
            ))}</div>
          )}
        </div>

        {/* Selling Price */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">🏷️ Giá bán dự kiến (cho {baseServing} serving)</label>
          <div className="relative">
            <input type="number" inputMode="numeric" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} placeholder="0"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-right pr-8"/>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">đ</span>
          </div>
        </div>

        <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú chung</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Mẹo, lưu ý..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"/></div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving||!name.trim()} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':(formula?'Cập nhật':'Tạo')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// BATCH FORM (Làm thử / Làm thật)
// ============================================
function BatchForm({ isOpen, onClose, formula, ingredients, toast, onSaved }) {
  const [type, setType] = useState('test')
  const [serving, setServing] = useState(formula?.base_serving||1)
  const [batchItems, setBatchItems] = useState([])
  const [note, setNote] = useState(''); const [result, setResult] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && formula) {
      setServing(formula.base_serving||1); setNote(''); setResult(''); setType('test')
      const scaled = scaleIngredients(formula.items||[], formula.base_serving, formula.base_serving)
      setBatchItems(scaled.map(i => ({ ingredient_id:i.ingredient?.id||i.ingredient_id, name:i.ingredient?.name||'?', quantity:i.scaledQty, unit:i.unit, stockUnit:i.ingredient?.unit, stockQty:i.ingredient?.stock_qty||0 })))
    }
  }, [isOpen, formula])

  // Rescale
  useEffect(() => {
    if (!formula) return
    const scaled = scaleIngredients(formula.items||[], formula.base_serving, serving)
    setBatchItems(prev => scaled.map((i,idx) => ({ ...prev[idx], quantity:i.scaledQty })))
  }, [serving])

  const cost = useMemo(() => {
    const ingCost = batchItems.reduce((sum, bi) => {
      const ing = ingredients.find(i => i.id===bi.ingredient_id)
      if (!ing || !ing.price_per_unit) return sum
      const conv = convertUnit(bi.quantity, bi.unit, ing.unit)
      if (conv===null) return sum + (bi.quantity * ing.price_per_unit)
      return sum + (conv * ing.price_per_unit)
    }, 0)
    const ratio = serving / (formula?.base_serving||1)
    const extraTotal = (formula?.extra_costs||[]).reduce((s,ec) => s + Math.round((Number(ec.amount)||0)*ratio), 0)
    return ingCost + extraTotal
  }, [batchItems, ingredients, serving, formula])

  const handleSave = async () => {
    // Check negative stock before production
    if (type === 'production') {
      const negatives = batchItems.filter(bi => {
        const conv = convertUnit(bi.quantity, bi.unit, bi.stockUnit)
        return conv !== null && (bi.stockQty - conv) < 0
      }).map(bi => bi.name)
      if (negatives.length > 0) {
        if (!confirm(`⚠️ Tồn kho sẽ âm cho: ${negatives.join(', ')}\n\nVẫn tiếp tục trừ kho?`)) return
      }
    }
    setSaving(true)
    try {
      const batch = await createBatch({
        formula_id:formula.id, type, serving,
        items:batchItems.map(bi => ({ingredient_id:bi.ingredient_id, quantity:bi.quantity, unit:bi.unit})),
        cost, note, result
      })
      if (type==='production') {
        const errs = await deductStock(batch.id, batchItems, ingredients)
        if (errs.length>0) toast.error('Lỗi convert: '+errs.join(', '))
        else toast.success('Đã tạo lô + trừ kho')
      } else { toast.success('Đã tạo lô thử nghiệm') }
      onClose(); onSaved()
    } catch(err) { toast.error('Lỗi: '+err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`🧪 Làm lô: ${formula?.name||''}`}>
      <div className="space-y-4 p-5">
        {/* Type */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setType('test')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${type==='test'?'bg-blue-500 text-white shadow':'text-gray-500'}`}>🔬 Thử nghiệm</button>
          <button onClick={() => setType('production')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${type==='production'?'bg-green-500 text-white shadow':'text-gray-500'}`}>🏭 Làm thật</button>
        </div>

        {type==='production' && <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg">⚠️ Làm thật sẽ tự động trừ tồn kho nguyên liệu</p>}

        {/* Serving */}
        <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2">
          <span className="text-xs text-purple-700 font-medium">Serving:</span>
          <button onClick={() => setServing(Math.max(1,serving-1))} className="w-7 h-7 bg-white rounded-lg text-purple-600 font-bold active:scale-90">−</button>
          <span className="text-sm font-bold text-purple-700 w-8 text-center">{serving}</span>
          <button onClick={() => setServing(serving+1)} className="w-7 h-7 bg-white rounded-lg text-purple-600 font-bold active:scale-90">+</button>
        </div>

        {/* Items preview */}
        <div className="space-y-1.5">
          {batchItems.map((bi,idx) => {
            const conv = convertUnit(bi.quantity, bi.unit, bi.stockUnit)
            const stockAfter = conv!==null ? bi.stockQty - conv : null
            const canConvert = conv!==null
            return (
              <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-700 font-medium">{bi.name}</span>
                <div className="text-right">
                  <span className="font-bold">{bi.quantity} {bi.unit}</span>
                  {type==='production' && (
                    canConvert
                      ? <p className={`text-[10px] ${stockAfter<0?'text-red-500':'text-green-600'}`}>Tồn: {formatStock(bi.stockQty, bi.stockUnit)} → {formatStock(stockAfter, bi.stockUnit)} {bi.stockUnit}</p>
                      : <p className="text-[10px] text-red-500">⚠ Không convert {bi.unit}→{bi.stockUnit}</p>
                  )}
                </div>
              </div>
            )
          })}
          {cost>0 && <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-200 font-bold"><span>Chi phí</span><span className="text-purple-600">{formatMoney(cost)}</span></div>}
        </div>

        <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Giảm glycerin 10%..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Kết quả / Đánh giá</label>
          <textarea value={result} onChange={e => setResult(e.target.value)} rows={2} placeholder="Ví dụ: Hơi đặc, cần thêm nước..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"/></div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className={`flex-1 py-3 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98 ${type==='production'?'bg-green-500':'bg-blue-500'}`}>
            {saving?'...':(type==='production'?'Làm thật + Trừ kho':'Lưu thử nghiệm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// BATCHES TAB
// ============================================
function BatchesTab({ batches, formulas, ingredients, search, setSearch, onRefresh, toast }) {
  const filtered = useMemo(() => {
    if (!search) return batches
    const s = search.toLowerCase()
    return batches.filter(b => {
      const f = formulas.find(fm => fm.id===b.formula_id)
      return f?.name.toLowerCase().includes(s) || b.note?.toLowerCase().includes(s)
    })
  }, [batches, search, formulas])

  const handleUndo = async (b) => {
    if(!b.stock_deducted) { toast.error('Lô này chưa trừ kho'); return }
    if(!confirm('Hoàn lại tồn kho cho lô này?')) return
    try { await undoDeductStock(b.id, b.items, ingredients); toast.success('Đã hoàn tồn'); onRefresh() }
    catch(err) { toast.error('Lỗi: '+err.message) }
  }

  const handleDelete = async (b) => {
    if(b.stock_deducted) { toast.error('Cần hoàn tồn trước khi xóa'); return }
    if(!confirm('Xóa lô này?')) return
    try { await deleteBatch(b.id); toast.success('Đã xóa'); onRefresh() } catch { toast.error('Lỗi') }
  }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm lô sản xuất..."/>
      {filtered.length===0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">🧪</div>
          <p className="text-gray-500 text-sm">{search?'Không tìm thấy':'Chưa có lô nào'}</p>
          <p className="text-xs text-gray-400 mt-1">Vào Công thức → Mở rộng → bấm "Làm lô"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(b => {
            const f = formulas.find(fm => fm.id===b.formula_id)
            const isTest = b.type==='test'
            return (
              <div key={b.id} className="bg-white rounded-xl px-4 py-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${isTest?'bg-blue-50':'bg-green-50'}`}>
                    {isTest?'🔬':'🏭'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate">{f?.name||'?'}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isTest?'bg-blue-100 text-blue-600':'bg-green-100 text-green-600'}`}>
                        {isTest?'Thử':'Thật'}
                      </span>
                      {b.stock_deducted && <CheckCircle size={12} className="text-green-500"/>}
                    </div>
                    <p className="text-xs text-gray-400">
                      Serving: {b.serving} • {b.cost>0?formatMoney(b.cost)+' • ':''}{new Date(b.created_at).toLocaleDateString('vi-VN')}
                    </p>
                    {b.note && <p className="text-xs text-gray-500 mt-0.5">📝 {b.note}</p>}
                    {b.result && <p className="text-xs text-amber-600 mt-0.5">💡 {b.result}</p>}

                    {/* Items detail */}
                    <div className="mt-1.5 space-y-0.5">
                      {(b.items||[]).map((item,idx) => {
                        const ing = ingredients.find(i => i.id===item.ingredient_id)
                        return <p key={idx} className="text-[11px] text-gray-400">• {ing?.name||'?'}: {item.quantity} {item.unit}</p>
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {b.stock_deducted && <button onClick={() => handleUndo(b)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg active:scale-90" title="Hoàn tồn"><Undo2 size={14}/></button>}
                    <button onClick={() => handleDelete(b)} className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ============================================
// INGREDIENTS TAB - Quick edit stock
// ============================================
function IngredientsTab({ ingredients, search, setSearch, onRefresh, toast }) {
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState(null)
  const [editStock, setEditStock] = useState(null) // { id, qty }

  const filtered = useMemo(() => {
    if (!search) return ingredients
    const s = search.toLowerCase()
    return ingredients.filter(i => i.name.toLowerCase().includes(s)||i.supplier?.toLowerCase().includes(s))
  }, [ingredients, search])

  const handleDelete = async (i) => {
    if(!confirm(`Xóa "${i.name}"?`)) return
    try { await deleteIngredient(i.id); toast.success('Đã xóa'); onRefresh() } catch { toast.error('Lỗi') }
  }
  const handleSave = async (data) => {
    try {
      if(editing) { await updateIngredient(editing.id, data); toast.success('Đã cập nhật') }
      else { await createIngredient(data); toast.success('Đã thêm') }
      setShowForm(false); onRefresh()
    } catch(err) { toast.error('Lỗi: '+err.message) }
  }
  const handleQuickStock = async (id) => {
    if(editStock?.id!==id) return
    try { await updateStock(id, Number(editStock.qty)||0); toast.success('Đã cập nhật tồn'); setEditStock(null); onRefresh() }
    catch { toast.error('Lỗi') }
  }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm nguyên liệu..."/>
      {filtered.length===0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📦</div>
          <p className="text-gray-500 text-sm">{search?'Không tìm thấy':'Chưa có nguyên liệu'}</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="mt-3 text-purple-600 font-medium text-sm">+ Thêm</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(i => (
            <div key={i.id} className="bg-white rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{i.name}</p>
                  <p className="text-xs text-gray-400">
                    {i.price_per_unit>0 && <span>{formatMoney(i.price_per_unit)}/{i.unit}</span>}
                    {i.supplier && <span className="ml-2">• {i.supplier}</span>}
                  </p>
                </div>
                {/* Quick stock edit */}
                <div className="flex items-center gap-1">
                  {editStock?.id===i.id ? (
                    <>
                      <input type="number" inputMode="decimal" value={editStock.qty}
                        onChange={e => setEditStock({...editStock, qty:e.target.value})}
                        className="w-20 px-2 py-1.5 border border-purple-300 rounded-lg text-xs text-center" autoFocus
                        onKeyDown={e => { if(e.key==='Enter') handleQuickStock(i.id); if(e.key==='Escape') setEditStock(null) }}/>
                      <span className="text-xs text-gray-400">{i.unit}</span>
                      <button onClick={() => handleQuickStock(i.id)} className="p-1 text-green-500 active:scale-90"><CheckCircle size={16}/></button>
                      <button onClick={() => setEditStock(null)} className="p-1 text-gray-400 active:scale-90"><X size={14}/></button>
                    </>
                  ) : (
                    <button onClick={() => setEditStock({id:i.id, qty:String(i.stock_qty||0)})}
                      className={`px-2 py-1 rounded-lg text-xs font-bold ${Number(i.stock_qty)>0?'bg-green-50 text-green-700 border border-green-200':'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                      {formatStock(i.stock_qty, i.unit)} {i.unit}
                    </button>
                  )}
                </div>
                <button onClick={() => { setEditing(i); setShowForm(true) }} className="p-2 text-gray-400 hover:text-purple-500 active:scale-90"><Edit2 size={16}/></button>
                <button onClick={() => handleDelete(i)} className="p-2 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => { setEditing(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 z-40" style={{bottom:"calc(4.5rem + env(safe-area-inset-bottom, 0px))"}}>
        <Plus size={24}/></button>
      <IngredientForm isOpen={showForm} onClose={() => setShowForm(false)} ingredient={editing} onSave={handleSave}/>
    </>
  )
}

// ============================================
// INGREDIENT FORM
// ============================================
function IngredientForm({ isOpen, onClose, ingredient, onSave }) {
  const [form, setForm] = useState({ name:'', unit:'g', price_per_unit:'', supplier:'', supplier_contact:'', stock_qty:'', note:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if(isOpen) {
      if(ingredient) setForm({ name:ingredient.name, unit:ingredient.unit, price_per_unit:String(ingredient.price_per_unit||''),
        supplier:ingredient.supplier||'', supplier_contact:ingredient.supplier_contact||'', stock_qty:String(ingredient.stock_qty||''), note:ingredient.note||'' })
      else setForm({ name:'', unit:'g', price_per_unit:'', supplier:'', supplier_contact:'', stock_qty:'', note:'' })
    }
  }, [isOpen, ingredient])

  const handleUnitChange = (newUnit) => {
    const oldUnit = form.unit
    if (oldUnit === newUnit) { setForm({...form, unit:newUnit}); return }
    const conv = convertUnit(1, oldUnit, newUnit)
    if (conv !== null) {
      // Convert: price is per-unit so invert, stock is quantity so normal
      const oldPrice = Number(form.price_per_unit) || 0
      const oldStock = Number(form.stock_qty) || 0
      const newPrice = oldPrice > 0 ? Math.round(oldPrice / conv * 10000) / 10000 : 0
      const newStock = oldStock > 0 ? Math.round(oldStock * conv * 10000) / 10000 : 0
      setForm({...form, unit:newUnit, price_per_unit: newPrice ? String(newPrice) : '', stock_qty: newStock ? String(newStock) : ''})
    } else {
      setForm({...form, unit:newUnit})
    }
  }

  const handleSubmit = async () => {
    if(!form.name.trim()) return; setSaving(true)
    await onSave({ name:form.name.trim(), unit:form.unit, price_per_unit:Number(form.price_per_unit)||0,
      supplier:form.supplier, supplier_contact:form.supplier_contact, stock_qty:Number(form.stock_qty)||0, note:form.note })
    setSaving(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={ingredient?'Sửa nguyên liệu':'📦 Thêm nguyên liệu'}>
      <div className="space-y-3 p-5">
        <div><label className="text-xs text-gray-500 mb-1 block">Tên *</label>
          <input type="text" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Ví dụ: Vitamin C" autoFocus className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-gray-500 mb-1 block">Đơn vị</label>
            <select value={form.unit} onChange={e => handleUnitChange(e.target.value)} className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white">
              {ALL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Giá/đơn vị (đ)</label>
            <input type="number" inputMode="numeric" value={form.price_per_unit} onChange={e => setForm({...form,price_per_unit:e.target.value})} placeholder="0" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-gray-500 mb-1 block">Nhà cung cấp</label><input type="text" value={form.supplier} onChange={e => setForm({...form,supplier:e.target.value})} placeholder="Tên NCC" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm"/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">SĐT</label><input type="text" value={form.supplier_contact} onChange={e => setForm({...form,supplier_contact:e.target.value})} placeholder="SĐT" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        </div>
        <div><label className="text-xs text-gray-500 mb-1 block">Tồn kho</label>
          <input type="number" inputMode="decimal" value={form.stock_qty} onChange={e => setForm({...form,stock_qty:e.target.value})} placeholder="0" className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={form.note} onChange={e => setForm({...form,note:e.target.value})} placeholder="Ghi chú..." className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSubmit} disabled={saving||!form.name.trim()} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':(ingredient?'Cập nhật':'Thêm')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// NOTES TAB (giữ nguyên logic)
// ============================================
function NotesTab({ notes, formulas, search, setSearch, onRefresh, toast }) {
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState(null)
  const filtered = useMemo(() => {
    if(!search) return notes; const s=search.toLowerCase()
    return notes.filter(n => n.title.toLowerCase().includes(s)||n.content?.toLowerCase().includes(s))
  }, [notes, search])

  const handleDelete = async (n) => { if(!confirm(`Xóa "${n.title}"?`)) return; try { await deleteLabNote(n.id); toast.success('Đã xóa'); onRefresh() } catch { toast.error('Lỗi') } }
  const handlePin = async (n) => { try { await togglePinNote(n.id, n.is_pinned); onRefresh() } catch { toast.error('Lỗi') } }
  const handleSave = async (data) => {
    try { if(editing) { await updateLabNote(editing.id, data); toast.success('Đã cập nhật') } else { await createLabNote(data); toast.success('Đã thêm') }
      setShowForm(false); onRefresh() } catch(err) { toast.error('Lỗi: '+err.message) }
  }
  const typeLabels = { note:'📝 Ghi chú', experiment:'🔬 Thí nghiệm', discovery:'💡 Phát hiện' }
  const typeColors = { note:'bg-gray-100 text-gray-600', experiment:'bg-blue-100 text-blue-600', discovery:'bg-amber-100 text-amber-600' }

  return (
    <>
      <SearchBar value={search} onChange={setSearch} placeholder="Tìm ghi chú..."/>
      {filtered.length===0 ? (
        <div className="bg-white rounded-xl p-8 text-center"><div className="text-4xl mb-2">📝</div>
          <p className="text-gray-500 text-sm">{search?'Không tìm thấy':'Chưa có ghi chú'}</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }} className="mt-3 text-purple-600 font-medium text-sm">+ Thêm</button></div>
      ) : (
        <div className="space-y-2">{filtered.map(n => (
          <div key={n.id} className="bg-white rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {n.is_pinned && <Pin size={12} className="text-amber-500"/>}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[n.type]||typeColors.note}`}>{typeLabels[n.type]||'📝 Ghi chú'}</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{n.title}</p>
                {n.content && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>}
                <p className="text-[10px] text-gray-300 mt-1">{new Date(n.created_at).toLocaleDateString('vi-VN')}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => handlePin(n)} className={`p-1.5 rounded-lg active:scale-90 ${n.is_pinned?'text-amber-500':'text-gray-300'}`}><Pin size={14}/></button>
                <button onClick={() => { setEditing(n); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-purple-500 active:scale-90"><Edit2 size={14}/></button>
                <button onClick={() => handleDelete(n)} className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={14}/></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      <button onClick={() => { setEditing(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 z-40" style={{bottom:"calc(4.5rem + env(safe-area-inset-bottom, 0px))"}}><Plus size={24}/></button>
      <NoteForm isOpen={showForm} onClose={() => setShowForm(false)} note={editing} formulas={formulas} onSave={handleSave}/>
    </>
  )
}

// ============================================
// NOTE FORM
// ============================================
function NoteForm({ isOpen, onClose, note, formulas, onSave }) {
  const [form, setForm] = useState({ title:'', content:'', type:'note', formula_id:'' }); const [saving, setSaving] = useState(false)
  useEffect(() => { if(isOpen) { if(note) setForm({ title:note.title, content:note.content||'', type:note.type||'note', formula_id:note.formula_id||'' }); else setForm({ title:'', content:'', type:'note', formula_id:'' }) } }, [isOpen, note])
  const handleSubmit = async () => { if(!form.title.trim()) return; setSaving(true); await onSave({ title:form.title.trim(), content:form.content, type:form.type, formula_id:form.formula_id||null }); setSaving(false) }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={note?'Sửa ghi chú':'📝 Thêm ghi chú'}>
      <div className="space-y-3 p-5">
        <div><label className="text-xs text-gray-500 mb-1 block">Loại</label>
          <div className="flex gap-2">{[['note','📝 Ghi chú'],['experiment','🔬 Thí nghiệm'],['discovery','💡 Phát hiện']].map(([v,l]) => (
            <button key={v} onClick={() => setForm({...form,type:v})} className={`flex-1 py-2 rounded-lg text-xs font-medium ${form.type===v?'bg-purple-500 text-white':'bg-gray-100 text-gray-600'}`}>{l}</button>
          ))}</div></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Tiêu đề *</label>
          <input type="text" value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Tiêu đề" autoFocus className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Nội dung</label>
          <textarea value={form.content} onChange={e => setForm({...form,content:e.target.value})} rows={4} placeholder="Chi tiết..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"/></div>
        {formulas.length>0 && <div><label className="text-xs text-gray-500 mb-1 block">Liên kết công thức</label>
          <select value={form.formula_id} onChange={e => setForm({...form,formula_id:e.target.value})} className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white">
            <option value="">-- Không --</option>{formulas.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select></div>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSubmit} disabled={saving||!form.title.trim()} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':(note?'Cập nhật':'Thêm')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// LAB CATEGORY MANAGER
// ============================================
function LabCategoryManager({ isOpen, onClose, categories, onChanged, toast }) {
  const [newName, setNewName] = useState(''); const [saving, setSaving] = useState(false)
  const handleAdd = async () => {
    if(!newName.trim()) return
    if(categories.some(c => c.name.toLowerCase()===newName.trim().toLowerCase())) { toast.error('Đã tồn tại'); return }
    setSaving(true)
    try { await createLabCategory(newName.trim()); toast.success('Đã thêm'); setNewName(''); onChanged() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false) }
  }
  const handleDelete = async (cat) => {
    if(!confirm(`Xóa "${cat.name}"?`)) return
    try { await deleteLabCategory(cat.id); toast.success('Đã xóa'); onChanged() } catch { toast.error('Lỗi') }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Phân loại công thức">
      <div className="space-y-4 p-5">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.length===0 ? <p className="text-sm text-gray-400 text-center py-4">Chưa có</p> : categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">{cat.name}</span>
              <button onClick={() => handleDelete(cat)} className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={15}/></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên mới..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm" onKeyDown={e => { if(e.key==='Enter') handleAdd() }}/>
          <button onClick={handleAdd} disabled={saving||!newName.trim()} className="px-4 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95">{saving?'...':'+ Thêm'}</button>
        </div>
        <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Đóng</button>
      </div>
    </Modal>
  )
}
