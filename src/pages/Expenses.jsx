// ============================================
// EXPENSES PAGE - MODULE THU CHI (Phase 1)
// Mobile-first, touch-friendly
// ============================================
import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, Plus, X, ChevronLeft, ChevronRight, Trash2, Edit2, Check, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoneyFull, formatMoney } from '../lib/helpers'
import {
  getExpenseCategories, getTransactions, createTransaction,
  updateTransaction, deleteTransaction, getExpenseSummary
} from '../lib/expenses'

// ============================================
// HELPER: Lấy ngày đầu/cuối tháng
// ============================================
function getMonthRange(date) {
  const y = date.getFullYear(), m = date.getMonth()
  const start = new Date(y, m, 1).toISOString().split('T')[0]
  const end = new Date(y, m + 1, 0).toISOString().split('T')[0]
  return { start, end }
}

function formatMonthLabel(date) {
  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateStr === today.toISOString().split('T')[0]) return 'Hôm nay'
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Hôm qua'

  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function Expenses() {
  const toast = useToast()

  // Data
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, balance: 0, byCategory: [] })
  const [loading, setLoading] = useState(true)

  // UI
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState('expense') // 'expense' | 'income'
  const [editingTx, setEditingTx] = useState(null)
  const [activeView, setActiveView] = useState('list') // 'list' | 'summary'
  const [filterCategory, setFilterCategory] = useState(null)

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
  // NAVIGATION THÁNG
  // ============================================
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  const nextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    if (next <= new Date()) setCurrentMonth(next)
  }
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear()

  // ============================================
  // GROUP transactions by date
  // ============================================
  const groupedTx = useMemo(() => {
    let filtered = transactions
    if (filterCategory) {
      filtered = transactions.filter(t => t.category_id === filterCategory)
    }

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
  const handleAddTx = (type) => {
    setAddType(type)
    setEditingTx(null)
    setShowAdd(true)
  }

  const handleEditTx = (tx) => {
    setEditingTx(tx)
    setAddType(tx.type)
    setShowAdd(true)
  }

  const handleDeleteTx = async (tx) => {
    if (!confirm(`Xóa "${tx.note || tx.category?.name}"?`)) return
    try {
      await deleteTransaction(tx.id)
      toast.success('Đã xóa')
      loadData()
    } catch { toast.error('Lỗi xóa') }
  }

  const handleSaveTx = async (formData) => {
    try {
      if (editingTx) {
        await updateTransaction(editingTx.id, formData)
        toast.success('Đã cập nhật')
      } else {
        await createTransaction(formData)
        toast.success('Đã thêm')
      }
      setShowAdd(false)
      loadData()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="pb-4">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">💰 Thu Chi</h2>
            <button onClick={() => loadData()} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        {/* MONTH NAVIGATOR */}
        <div className="flex items-center justify-between py-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full active:scale-90 transition-transform">
            <ChevronLeft size={22} className="text-gray-600" />
          </button>
          <span className="font-bold text-gray-700">{formatMonthLabel(currentMonth)}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className={`p-2 rounded-full transition-transform active:scale-90 ${isCurrentMonth ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}>
            <ChevronRight size={22} />
          </button>
        </div>

        {/* SUMMARY CARDS */}
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

        {/* VIEW TABS */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setActiveView('list'); setFilterCategory(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'list' ? 'bg-green-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            Giao dịch
          </button>
          <button onClick={() => setActiveView('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeView === 'summary' ? 'bg-green-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            Tổng hợp
          </button>
        </div>

        {/* CATEGORY FILTER (chỉ hiện ở tab list) */}
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
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-12 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : activeView === 'summary' ? (
          <SummaryView summary={summary} onCategoryClick={(catId) => {
            setFilterCategory(catId)
            setActiveView('list')
          }} />
        ) : groupedTx.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-gray-500 text-sm">
              {filterCategory ? 'Không có giao dịch cho danh mục này' : 'Chưa có giao dịch nào'}
            </p>
            <button onClick={() => handleAddTx('expense')}
              className="mt-3 text-green-600 font-medium text-sm">
              + Thêm giao dịch đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedTx.map(([date, txs]) => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-500">{formatDateLabel(date)}</span>
                  <span className="text-xs text-gray-400">
                    {txs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0) >= 0 ? '+' : ''}
                    {formatMoney(txs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0))}
                  </span>
                </div>

                {/* Transaction items */}
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  {txs.map((tx, i) => (
                    <div key={tx.id}
                      className={`flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors ${i < txs.length - 1 ? 'border-b border-gray-50' : ''}`}
                      onClick={() => handleEditTx(tx)}>
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ backgroundColor: (tx.category?.color || '#6B7280') + '15' }}>
                        {tx.category?.icon || '📦'}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {tx.note || tx.category?.name || 'Giao dịch'}
                        </p>
                        <p className="text-xs text-gray-400">{tx.category?.name}</p>
                      </div>
                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB - 2 buttons */}
      <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-40">
        <button onClick={() => handleAddTx('income')}
          className="w-12 h-12 bg-green-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform">
          <ArrowDownCircle size={24} />
        </button>
        <button onClick={() => handleAddTx('expense')}
          className="w-12 h-12 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform">
          <ArrowUpCircle size={24} />
        </button>
      </div>

      {/* ADD/EDIT MODAL */}
      <TransactionForm
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleSaveTx}
        categories={categories}
        type={addType}
        editingTx={editingTx}
        onDelete={editingTx ? () => { handleDeleteTx(editingTx); setShowAdd(false) } : null}
      />
    </div>
  )
}

// ============================================
// SUMMARY VIEW
// ============================================
function SummaryView({ summary, onCategoryClick }) {
  const expenseCategories = summary.byCategory.filter(c => c.expense > 0)
  const incomeCategories = summary.byCategory.filter(c => c.income > 0)
  const maxExpense = Math.max(...expenseCategories.map(c => c.expense), 1)
  const maxIncome = Math.max(...incomeCategories.map(c => c.income), 1)

  return (
    <div className="space-y-4">
      {/* Chi tiêu theo danh mục */}
      {expenseCategories.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">💸 Chi tiêu theo danh mục</h3>
          <div className="space-y-2.5">
            {expenseCategories.map(c => (
              <button key={c.category.id || 'none'} className="w-full text-left active:bg-gray-50 rounded-lg p-1 -m-1"
                onClick={() => onCategoryClick(c.category.id)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{c.category.icon}</span>
                  <span className="text-xs font-medium text-gray-700 flex-1">{c.category.name}</span>
                  <span className="text-xs font-bold text-red-600">{formatMoney(c.expense)}</span>
                  <span className="text-[10px] text-gray-400">({c.count})</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: `${(c.expense / maxExpense) * 100}%`,
                      backgroundColor: c.category.color || '#EF4444'
                    }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Thu nhập theo danh mục */}
      {incomeCategories.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-3">💰 Thu nhập theo danh mục</h3>
          <div className="space-y-2.5">
            {incomeCategories.map(c => (
              <button key={c.category.id || 'none'} className="w-full text-left active:bg-gray-50 rounded-lg p-1 -m-1"
                onClick={() => onCategoryClick(c.category.id)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{c.category.icon}</span>
                  <span className="text-xs font-medium text-gray-700 flex-1">{c.category.name}</span>
                  <span className="text-xs font-bold text-green-600">{formatMoney(c.income)}</span>
                  <span className="text-[10px] text-gray-400">({c.count})</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(c.income / maxIncome) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {expenseCategories.length === 0 && incomeCategories.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-gray-500 text-sm">Chưa có dữ liệu tháng này</p>
        </div>
      )}
    </div>
  )
}

// ============================================
// TRANSACTION FORM (Add/Edit Modal)
// Mobile-optimized: large touch targets, quick input
// ============================================
function TransactionForm({ isOpen, onClose, onSave, categories, type, editingTx, onDelete }) {
  const [formType, setFormType] = useState(type)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  // Reset form when open
  useEffect(() => {
    if (isOpen) {
      if (editingTx) {
        setFormType(editingTx.type)
        setAmount(String(editingTx.amount))
        setCategoryId(editingTx.category_id || '')
        setNote(editingTx.note || '')
        setDate(editingTx.date)
      } else {
        setFormType(type)
        setAmount('')
        setCategoryId('')
        setNote('')
        setDate(new Date().toISOString().split('T')[0])
      }
    }
  }, [isOpen, editingTx, type])

  // Filter categories by type
  const filteredCats = categories.filter(c => {
    const isIncome = c.metadata?.is_income === true
    return formType === 'income' ? isIncome : !isIncome
  })

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return
    if (!categoryId) return

    setSaving(true)
    await onSave({
      type: formType,
      amount: Number(amount),
      category_id: categoryId,
      note,
      date
    })
    setSaving(false)
  }

  // Quick amount buttons
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

        {/* Amount input - BIG for mobile */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tiền</label>
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className="w-full text-2xl font-bold text-center py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200"
              autoFocus
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">đ</span>
          </div>

          {/* Quick amount buttons */}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {quickAmounts.map(q => (
              <button key={q} onClick={() => setAmount(String(q))}
                className="py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-600 active:scale-95 transition-transform">
                {formatMoney(q)}
              </button>
            ))}
          </div>
        </div>

        {/* Category selection - Grid for mobile */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Danh mục</label>
          <div className="grid grid-cols-4 gap-2">
            {filteredCats.map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all active:scale-95 ${categoryId === c.id ? 'border-green-500 bg-green-50' : 'border-transparent bg-gray-50'}`}>
                <span className="text-xl">{c.icon}</span>
                <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ngày</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {/* Note */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ví dụ: Mua nguyên liệu..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onDelete && (
            <button onClick={onDelete}
              className="px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium">
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm active:scale-98 transition-transform">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={saving || !amount || !categoryId}
            className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md active:scale-98 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? '...' : (editingTx ? 'Cập nhật' : 'Thêm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
