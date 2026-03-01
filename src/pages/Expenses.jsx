// ============================================
// EXPENSES PAGE - MODULE THU CHI (Phase 1b)
// + Quản lý danh mục tùy chỉnh
// Mobile-first, touch-friendly
// ============================================
import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, ChevronLeft, ChevronRight, Trash2, ArrowUpCircle, ArrowDownCircle, Settings, Plus, X, Edit2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoneyFull, formatMoney } from '../lib/helpers'
import {
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getTransactions, createTransaction, updateTransaction, deleteTransaction, getExpenseSummary
} from '../lib/expenses'

// ============================================
// HELPERS
// ============================================
function getMonthRange(date) {
  const y = date.getFullYear(), m = date.getMonth()
  return {
    start: new Date(y, m, 1).toISOString().split('T')[0],
    end: new Date(y, m + 1, 0).toISOString().split('T')[0]
  }
}

function formatMonthLabel(date) {
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date().toISOString().split('T')[0]
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (dateStr === today) return 'Hôm nay'
  if (dateStr === y.toISOString().split('T')[0]) return 'Hôm qua'
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`
}

// Icon + Color options cho category form
const ICON_OPTIONS = ['🏠','🍜','🚗','💼','🧪','💊','📦','🛒','👕','📱','🎓','🎮','✂️','🧴','💡','🏥','🎁','☕','🍺','💄','👶','🐾','✈️','🎬','📚']
const COLOR_OPTIONS = ['#3B82F6','#EF4444','#F59E0B','#10B981','#8B5CF6','#EC4899','#14B8A6','#6366F1','#F97316','#06B6D4','#84CC16','#A855F7']

// ============================================
// MAIN COMPONENT
// ============================================
export default function Expenses() {
  const toast = useToast()

  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0, byCategory: [] })
  const [loading, setLoading] = useState(true)

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState('expense')
  const [editingTx, setEditingTx] = useState(null)
  const [activeView, setActiveView] = useState('list')
  const [filterCategory, setFilterCategory] = useState(null)
  const [showCategoryManager, setShowCategoryManager] = useState(false)

  // ============================================
  // LOAD DATA
  // ============================================
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getMonthRange(currentMonth)
      const [cats, txs, sum] = await Promise.all([
        getExpenseCategories(),
        getTransactions({ startDate: start, endDate: end }),
        getExpenseSummary(start, end)
      ])
      setCategories(cats)
      setTransactions(txs)
      setSummary(sum)
    } catch (err) {
      console.error(err)
      toast.error('Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [currentMonth, toast])

  useEffect(() => { loadData() }, [loadData])

  // ============================================
  // MONTH NAV
  // ============================================
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    if (next <= new Date()) setCurrentMonth(next)
  }
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear()

  // ============================================
  // GROUP BY DATE
  // ============================================
  const groupedTx = useMemo(() => {
    let filtered = transactions
    if (filterCategory) filtered = transactions.filter(t => t.category_id === filterCategory)
    const groups = {}
    filtered.forEach(tx => {
      if (!groups[tx.date]) groups[tx.date] = []
      groups[tx.date].push(tx)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [transactions, filterCategory])

  // ============================================
  // HANDLERS
  // ============================================
  const handleAddTx = (type) => { setAddType(type); setEditingTx(null); setShowAdd(true) }
  const handleEditTx = (tx) => { setEditingTx(tx); setAddType(tx.type); setShowAdd(true) }

  const handleDeleteTx = async (tx) => {
    if (!confirm(`Xóa "${tx.note || tx.category?.name}"?`)) return
    try { await deleteTransaction(tx.id); toast.success('Đã xóa'); loadData() }
    catch { toast.error('Lỗi xóa') }
  }

  const handleSaveTx = async (formData) => {
    try {
      if (editingTx) { await updateTransaction(editingTx.id, formData); toast.success('Đã cập nhật') }
      else { await createTransaction(formData); toast.success('Đã thêm') }
      setShowAdd(false); loadData()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="pb-4">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">💰 Thu Chi</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowCategoryManager(true)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" title="Quản lý danh mục">
              <Settings size={18} />
            </button>
            <button onClick={() => loadData()}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        {/* MONTH NAV */}
        <div className="flex items-center justify-between py-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full active:scale-90 transition-transform">
            <ChevronLeft size={22} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-700">{formatMonthLabel(currentMonth)}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className={`p-2 rounded-full active:scale-90 transition-transform ${isCurrentMonth ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ChevronRight size={22} />
          </button>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-green-600 font-medium">Thu</p>
            <p className="text-sm font-bold text-green-700 mt-0.5">{formatMoney(summary.totalIncome)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-red-600 font-medium">Chi</p>
            <p className="text-sm font-bold text-red-700 mt-0.5">{formatMoney(summary.totalExpense)}</p>
          </div>
          <div className={`border rounded-xl p-3 text-center ${summary.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] font-medium ${summary.balance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>Cân đối</p>
            <p className={`text-sm font-bold mt-0.5 ${summary.balance >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
              {summary.balance >= 0 ? '+' : ''}{formatMoney(summary.balance)}
            </p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setActiveView('list'); setFilterCategory(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'list' ? 'bg-green-500 text-white shadow-md' : 'bg-white text-gray-600'}`}>
            Giao dịch
          </button>
          <button onClick={() => setActiveView('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'summary' ? 'bg-green-500 text-white shadow-md' : 'bg-white text-gray-600'}`}>
            Tổng hợp
          </button>
        </div>

        {/* CATEGORY FILTER */}
        {activeView === 'list' && categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
            <button onClick={() => setFilterCategory(null)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterCategory ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>
              Tất cả
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setFilterCategory(filterCategory === c.id ? null : c.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCategory === c.id ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={filterCategory === c.id ? { backgroundColor: c.color } : {}}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-12 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : activeView === 'summary' ? (
          <SummaryView summary={summary} onCategoryClick={(id) => { setFilterCategory(id); setActiveView('list') }} />
        ) : groupedTx.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-gray-500 text-sm">{filterCategory ? 'Không có giao dịch cho danh mục này' : 'Chưa có giao dịch nào'}</p>
            <button onClick={() => handleAddTx('expense')} className="mt-3 text-green-600 font-medium text-sm">+ Thêm giao dịch đầu tiên</button>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {groupedTx.map(([date, txs]) => (
              <div key={date}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-500">{formatDateLabel(date)}</span>
                  <span className="text-xs text-gray-400">
                    {(() => { const v = txs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0); return (v >= 0 ? '+' : '') + formatMoney(v) })()}
                  </span>
                </div>
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  {txs.map((tx, i) => (
                    <div key={tx.id}
                      className={`flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors cursor-pointer ${i < txs.length - 1 ? 'border-b border-gray-50' : ''}`}
                      onClick={() => handleEditTx(tx)}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: (tx.category?.color || '#6B7280') + '15' }}>
                        {tx.category?.icon || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{tx.note || tx.category?.name || 'Giao dịch'}</p>
                        <p className="text-xs text-gray-400">{tx.category?.name}</p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FABs */}
      <div className="fixed right-4 flex flex-col gap-2 z-40" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={() => handleAddTx('income')}
          className="w-12 h-12 bg-green-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform">
          <ArrowDownCircle size={24} />
        </button>
        <button onClick={() => handleAddTx('expense')}
          className="w-12 h-12 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform">
          <ArrowUpCircle size={24} />
        </button>
      </div>

      {/* TX FORM */}
      <TransactionForm
        isOpen={showAdd} onClose={() => setShowAdd(false)} onSave={handleSaveTx}
        categories={categories} type={addType} editingTx={editingTx}
        onDelete={editingTx ? () => { handleDeleteTx(editingTx); setShowAdd(false) } : null}
      />

      {/* CATEGORY MANAGER */}
      <CategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={categories}
        onChanged={loadData}
      />
    </div>
  )
}

// ============================================
// SUMMARY VIEW
// ============================================
function SummaryView({ summary, onCategoryClick }) {
  const exp = summary.byCategory.filter(c => c.expense > 0)
  const inc = summary.byCategory.filter(c => c.income > 0)
  const maxE = Math.max(...exp.map(c => c.expense), 1)
  const maxI = Math.max(...inc.map(c => c.income), 1)

  const renderList = (items, field, max, color) => (
    <div className="space-y-2.5">
      {items.map(c => (
        <button key={c.category.id || 'x'} className="w-full text-left active:bg-gray-50 rounded-lg p-1 -m-1"
          onClick={() => onCategoryClick(c.category.id)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{c.category.icon}</span>
            <span className="text-xs font-medium text-gray-700 flex-1">{c.category.name}</span>
            <span className={`text-xs font-bold ${color}`}>{formatMoney(c[field])}</span>
            <span className="text-[10px] text-gray-400">({c.count})</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(c[field] / max) * 100}%`, backgroundColor: c.category.color || '#EF4444' }} />
          </div>
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      {exp.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">💸 Chi tiêu theo danh mục</h3>
          {renderList(exp, 'expense', maxE, 'text-red-600')}
        </div>
      )}
      {inc.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">💰 Thu nhập theo danh mục</h3>
          {renderList(inc, 'income', maxI, 'text-green-600')}
        </div>
      )}
      {exp.length === 0 && inc.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-500 text-sm">Chưa có dữ liệu tháng này</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// TRANSACTION FORM
// ============================================
function TransactionForm({ isOpen, onClose, onSave, categories, type, editingTx, onDelete }) {
  const [formType, setFormType] = useState(type)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingTx) {
        setFormType(editingTx.type); setAmount(String(editingTx.amount))
        setCategoryId(editingTx.category_id || ''); setNote(editingTx.note || ''); setDate(editingTx.date)
      } else {
        setFormType(type); setAmount(''); setCategoryId(''); setNote('')
        setDate(new Date().toISOString().split('T')[0])
      }
    }
  }, [isOpen, editingTx, type])

  const filteredCats = categories.filter(c => {
    const isIncome = c.metadata?.is_income === true
    return formType === 'income' ? isIncome : !isIncome
  })

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0 || !categoryId) return
    setSaving(true)
    await onSave({ type: formType, amount: Number(amount), category_id: categoryId, note, date })
    setSaving(false)
  }

  const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000]

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={editingTx ? 'Sửa giao dịch' : (formType === 'income' ? '💰 Thêm thu' : '💸 Thêm chi')}>
      <div className="space-y-4">
        {/* Type toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setFormType('expense')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${formType === 'expense' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}>
            💸 Chi
          </button>
          <button onClick={() => setFormType('income')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${formType === 'income' ? 'bg-green-500 text-white shadow' : 'text-gray-500'}`}>
            💰 Thu
          </button>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tiền</label>
          <div className="relative">
            <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" autoFocus
              className="w-full text-2xl font-bold text-center py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">đ</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {quickAmounts.map(q => (
              <button key={q} onClick={() => setAmount(String(q))}
                className="py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-600 active:scale-95 transition-transform">
                {formatMoney(q)}
              </button>
            ))}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Danh mục</label>
          {filteredCats.length === 0 ? (
            <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
              Chưa có danh mục {formType === 'income' ? 'thu' : 'chi'}. Bấm ⚙️ trên header để thêm.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {filteredCats.map(c => (
                <button key={c.id} onClick={() => setCategoryId(c.id)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all active:scale-95 ${categoryId === c.id ? 'border-green-500 bg-green-50' : 'border-transparent bg-gray-50'}`}>
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date + Note */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ngày</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Mua nguyên liệu..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onDelete && (
            <button onClick={onDelete} className="px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={18} /></button>
          )}
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm active:scale-98">Hủy</button>
          <button onClick={handleSubmit} disabled={saving || !amount || !categoryId}
            className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md active:scale-98 disabled:opacity-50">
            {saving ? '...' : (editingTx ? 'Cập nhật' : 'Thêm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// CATEGORY MANAGER
// Thêm/Sửa/Xóa danh mục thu chi
// ============================================
function CategoryManager({ isOpen, onClose, categories, onChanged }) {
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingCat, setEditingCat] = useState(null)
  const [formData, setFormData] = useState({ name: '', icon: '📦', color: '#3B82F6', is_income: false })
  const [saving, setSaving] = useState(false)

  const expenseCats = categories.filter(c => !c.metadata?.is_income)
  const incomeCats = categories.filter(c => c.metadata?.is_income === true)

  const openAdd = (isIncome) => {
    setEditingCat(null)
    setFormData({ name: '', icon: '📦', color: '#3B82F6', is_income: isIncome })
    setShowForm(true)
  }

  const openEdit = (cat) => {
    setEditingCat(cat)
    setFormData({ name: cat.name, icon: cat.icon, color: cat.color, is_income: cat.metadata?.is_income || false })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return
    setSaving(true)
    try {
      if (editingCat) {
        await updateExpenseCategory(editingCat.id, {
          name: formData.name.trim(), icon: formData.icon, color: formData.color,
          metadata: { is_income: formData.is_income }
        })
        toast.success('Đã cập nhật')
      } else {
        await createExpenseCategory({
          name: formData.name.trim(), icon: formData.icon, color: formData.color,
          metadata: { is_income: formData.is_income },
          sort_order: categories.length + 1
        })
        toast.success('Đã thêm')
      }
      setShowForm(false)
      onChanged()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Xóa danh mục "${cat.name}"?`)) return
    try {
      await deleteExpenseCategory(cat.id)
      toast.success('Đã xóa')
      onChanged()
    } catch { toast.error('Lỗi xóa') }
  }

  const renderCatList = (list, label, isIncome) => (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-gray-700">{label}</h4>
        <button onClick={() => openAdd(isIncome)}
          className="flex items-center gap-1 text-xs text-green-600 font-medium px-2 py-1 hover:bg-green-50 rounded-lg active:scale-95">
          <Plus size={14} /> Thêm
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-gray-400 py-3 text-center">Chưa có danh mục nào</p>
      ) : (
        <div className="space-y-1">
          {list.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: cat.color + '20' }}>
                {cat.icon}
              </div>
              <span className="text-sm font-medium text-gray-800 flex-1">{cat.name}</span>
              <button onClick={() => openEdit(cat)} className="p-2 text-gray-400 hover:text-blue-500 active:scale-90">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(cat)} className="p-2 text-gray-400 hover:text-red-500 active:scale-90">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Quản lý danh mục">
      {!showForm ? (
        <div>
          {renderCatList(expenseCats, '💸 Danh mục chi', false)}
          {renderCatList(incomeCats, '💰 Danh mục thu', true)}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft size={16} /> Quay lại
          </button>

          <h4 className="font-bold text-gray-700">
            {editingCat ? `Sửa "${editingCat.name}"` : `Thêm danh mục ${formData.is_income ? 'thu' : 'chi'}`}
          </h4>

          {/* Name */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tên danh mục</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ví dụ: Ăn uống" autoFocus
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>

          {/* Icon picker */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(ic => (
                <button key={ic} onClick={() => setFormData({ ...formData, icon: ic })}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 ${formData.icon === ic ? 'bg-green-100 ring-2 ring-green-500' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Màu</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(cl => (
                <button key={cl} onClick={() => setFormData({ ...formData, color: cl })}
                  className={`w-9 h-9 rounded-full transition-all active:scale-90 ${formData.color === cl ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: cl }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ backgroundColor: formData.color + '20' }}>
              {formData.icon}
            </div>
            <span className="text-sm font-medium">{formData.name || 'Tên danh mục'}</span>
            <span className={`text-xs ml-auto px-2 py-0.5 rounded-full ${formData.is_income ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {formData.is_income ? 'Thu' : 'Chi'}
            </span>
          </div>

          {/* Save */}
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
            <button onClick={handleSave} disabled={saving || !formData.name.trim()}
              className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">
              {saving ? '...' : (editingCat ? 'Cập nhật' : 'Thêm')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
