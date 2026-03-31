// ============================================
// EXPENSES PAGE - v3
// + TM/CK/TD, Lũy kế, Chuyển nội bộ, Trả nợ TD
// ============================================
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  RefreshCw, ChevronLeft, ChevronRight, Trash2,
  ArrowUpCircle, ArrowDownCircle, Settings, Plus, X, Edit2, ArrowLeftRight, CreditCard
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoney, getLocalDateString } from '../lib/helpers'
import {
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getExpenseSummary, getRunningBalance, getInitialBalances, saveInitialBalances
} from '../lib/expenses'

// Helpers
function getMonthRange(date) {
  const y = date.getFullYear(), m = date.getMonth()
  return { 
    start: getLocalDateString(new Date(y, m, 1)), 
    end: getLocalDateString(new Date(y, m + 1, 0)) 
  }
}
function formatMonthLabel(d) { return `Tháng ${d.getMonth()+1}/${d.getFullYear()}` }
function formatDateLabel(ds) {
  const d = new Date(ds+'T00:00:00')
  const today = getLocalDateString(new Date())
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1)
  if (ds === today) return 'Hôm nay'
  if (ds === getLocalDateString(yesterday)) return 'Hôm qua'
  return `${['CN','T2','T3','T4','T5','T6','T7'][d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}`
}
const mBadge = (m) => m==='credit'?'bg-purple-50 text-purple-600 border-purple-200':m==='transfer'?'bg-blue-50 text-blue-600 border-blue-200':'bg-amber-50 text-amber-600 border-amber-200'
const mShort = (m) => m==='credit'?'TD':m==='transfer'?'CK':'TM'
const ICONS = ['🏠','🍜','🚗','💼','🧪','💊','📦','🛒','👕','📱','🎓','🎮','✂️','🧴','💡','🏥','🎁','☕','🍺','💄','👶','🐾','✈️','🎬','📚']
const COLORS = ['#3B82F6','#EF4444','#F59E0B','#10B981','#8B5CF6','#EC4899','#14B8A6','#6366F1','#F97316','#06B6D4','#84CC16','#A855F7']

// ============================================
// MAIN
// ============================================
export default function Expenses() {
  const toast = useToast()
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({ totalIncome:0, totalExpense:0, balance:0, byCategory:[], byMethod:{cash:{income:0,expense:0},transfer:{income:0,expense:0},credit:{income:0,expense:0}} })
  const [runningBal, setRunningBal] = useState({ cash:0, transfer:0, credit:0, total:0 })
  const [initialBal, setInitialBal] = useState({ cash:0, transfer:0, credit:0, id:null })
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState('expense')
  const [editingTx, setEditingTx] = useState(null)
  const [activeView, setActiveView] = useState('list')
  const [filterCategory, setFilterCategory] = useState(null)
  const [filterMethod, setFilterMethod] = useState(null)
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showPayCredit, setShowPayCredit] = useState(false)
  const [showInitBal, setShowInitBal] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getMonthRange(currentMonth)
      const [cats,txs,sum,running,initBal] = await Promise.all([
        getExpenseCategories(), getTransactions({startDate:start,endDate:end}),
        getExpenseSummary(start,end), getRunningBalance(start), getInitialBalances()
      ])
      setCategories(cats); setTransactions(txs); setSummary(sum); setRunningBal(running); setInitialBal(initBal)
    } catch(err) { console.error(err); toast.error('Lỗi tải dữ liệu') }
    finally { setLoading(false) }
  }, [currentMonth, toast])

  useEffect(() => { loadData() }, [loadData])

  // Balances
  const openBal = useMemo(() => ({
    cash: initialBal.cash + runningBal.cash,
    transfer: initialBal.transfer + runningBal.transfer,
    credit: initialBal.credit + runningBal.credit, // nợ TD
    get total() { return this.cash + this.transfer - this.credit }
  }), [initialBal, runningBal])

  const monthMoves = useMemo(() => {
    let c2t=0, t2c=0, payCreditCash=0, payCreditTransfer=0, creditSpend=0
    transactions.forEach(t => {
      const amt = Number(t.amount), m = t.payment_method||'cash'
      if (t.type==='transfer') { if(m==='cash') c2t+=amt; else t2c+=amt }
      else if (t.type==='pay_credit') { if(m==='cash') payCreditCash+=amt; else payCreditTransfer+=amt }
      else if (t.type==='expense' && m==='credit') creditSpend+=amt
    })
    return { c2t, t2c, payCreditCash, payCreditTransfer, creditSpend }
  }, [transactions])

  const closeBal = useMemo(() => {
    const m = summary.byMethod||{cash:{income:0,expense:0},transfer:{income:0,expense:0},credit:{income:0,expense:0}}
    const mv = monthMoves
    return {
      cash: openBal.cash + m.cash.income - m.cash.expense - mv.c2t + mv.t2c - mv.payCreditCash,
      transfer: openBal.transfer + m.transfer.income - m.transfer.expense - mv.t2c + mv.c2t - mv.payCreditTransfer,
      credit: openBal.credit + mv.creditSpend - mv.payCreditCash - mv.payCreditTransfer,
      get total() { return this.cash + this.transfer - this.credit }
    }
  }, [openBal, summary, monthMoves])

  // Month nav
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth()-1))
  const nextMonth = () => { const n=new Date(currentMonth.getFullYear(), currentMonth.getMonth()+1); if(n<=new Date()) setCurrentMonth(n) }
  const isCurMonth = currentMonth.getMonth()===new Date().getMonth() && currentMonth.getFullYear()===new Date().getFullYear()

  // Group by date
  const groupedTx = useMemo(() => {
    let f = transactions
    if (filterCategory) f = f.filter(t => t.category_id===filterCategory)
    if (filterMethod) f = f.filter(t => (t.payment_method||'cash')===filterMethod)
    const g = {}
    f.forEach(tx => { if(!g[tx.date]) g[tx.date]=[]; g[tx.date].push(tx) })
    return Object.entries(g).sort(([a],[b]) => b.localeCompare(a))
  }, [transactions, filterCategory, filterMethod])

  // Handlers
  const handleAddTx = (type) => { setAddType(type); setEditingTx(null); setShowAdd(true) }
  const handleEditTx = (tx) => { if(tx.type==='transfer'||tx.type==='pay_credit') return; setEditingTx(tx); setAddType(tx.type); setShowAdd(true) }
  const handleDeleteTx = async (tx) => {
    if(!confirm(`Xóa "${tx.note||tx.category?.name||'giao dịch'}"?`)) return
    try { await deleteTransaction(tx.id); toast.success('Đã xóa'); loadData() } catch { toast.error('Lỗi xóa') }
  }
  const handleSaveTx = async (fd) => {
    try {
      if(editingTx) { await updateTransaction(editingTx.id, fd); toast.success('Đã cập nhật') }
      else { await createTransaction(fd); toast.success('Đã thêm') }
      setShowAdd(false); loadData()
    } catch(err) { toast.error('Lỗi: '+err.message) }
  }

  // TX display helpers
  const txIcon = (tx) => {
    if(tx.type==='transfer') return '🔄'
    if(tx.type==='pay_credit') return '💳'
    return tx.category?.icon||'📦'
  }
  const txBg = (tx) => {
    if(tx.type==='transfer') return '#E0E7FF'
    if(tx.type==='pay_credit') return '#F3E8FF'
    return (tx.category?.color||'#6B7280')+'15'
  }
  const txLabel = (tx) => {
    if(tx.type==='transfer') return `Chuyển ${(tx.payment_method||'cash')==='cash'?'TM → CK':'CK → TM'}`
    if(tx.type==='pay_credit') return `Trả nợ TD từ ${(tx.payment_method||'cash')==='cash'?'TM':'CK'}`
    return tx.note||tx.category?.name||'Giao dịch'
  }
  const txColor = (tx) => {
    if(tx.type==='income') return 'text-green-600'
    if(tx.type==='expense') return 'text-red-600'
    if(tx.type==='pay_credit') return 'text-purple-600'
    return 'text-indigo-600'
  }
  const txPrefix = (tx) => tx.type==='income'?'+':tx.type==='expense'?'-':''
  const isSpecialTx = (tx) => tx.type==='transfer'||tx.type==='pay_credit'

  return (
    <div className="pb-4">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">💰 Thu Chi</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowInitBal(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg text-base">💰</button>
            <button onClick={() => setShowCatMgr(true)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><Settings size={18}/></button>
            <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><RefreshCw size={18} className={loading?'animate-spin':''}/></button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        {/* Month nav */}
        <div className="flex items-center justify-between py-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full active:scale-90"><ChevronLeft size={22} className="text-gray-600"/></button>
          <span className="font-bold text-gray-700">{formatMonthLabel(currentMonth)}</span>
          <button onClick={nextMonth} disabled={isCurMonth} className={`p-2 rounded-full active:scale-90 ${isCurMonth?'text-gray-300':'hover:bg-gray-100 text-gray-600'}`}><ChevronRight size={22}/></button>
        </div>

        {/* Balance bar */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl p-3 mb-3 text-white">
          <div className="flex items-center justify-between text-xs mb-2">
            <div><p className="text-gray-400">Đầu kỳ</p><p className={`text-sm font-bold ${openBal.total>=0?'text-white':'text-red-300'}`}>{formatMoney(openBal.total)}</p></div>
            <div className="text-gray-500">──→</div>
            <div className="text-right"><p className="text-gray-400">Cuối kỳ</p><p className={`text-sm font-bold ${closeBal.total>=0?'text-green-300':'text-red-300'}`}>{formatMoney(closeBal.total)}</p></div>
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[9px] text-gray-400">💵 TM</p>
              <p className={`text-xs font-bold ${closeBal.cash>=0?'text-amber-300':'text-red-300'}`}>{formatMoney(closeBal.cash)}</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[9px] text-gray-400">🏦 CK</p>
              <p className={`text-xs font-bold ${closeBal.transfer>=0?'text-blue-300':'text-red-300'}`}>{formatMoney(closeBal.transfer)}</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[9px] text-gray-400">💳 Nợ TD</p>
              <p className={`text-xs font-bold ${closeBal.credit<=0?'text-green-300':'text-red-300'}`}>{closeBal.credit>0?'-':''}{formatMoney(Math.abs(closeBal.credit))}</p>
            </div>
          </div>
        </div>

        {/* Thu/Chi/Cân đối */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-green-600 font-medium">Thu</p>
            <p className="text-sm font-bold text-green-700 mt-0.5">{formatMoney(summary.totalIncome)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-red-600 font-medium">Chi</p>
            <p className="text-sm font-bold text-red-700 mt-0.5">{formatMoney(summary.totalExpense)}</p>
          </div>
          <div className={`border rounded-xl p-2.5 text-center ${summary.balance>=0?'bg-blue-50 border-blue-200':'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] font-medium ${summary.balance>=0?'text-blue-600':'text-amber-600'}`}>Tháng này</p>
            <p className={`text-sm font-bold mt-0.5 ${summary.balance>=0?'text-blue-700':'text-amber-700'}`}>{summary.balance>=0?'+':''}{formatMoney(summary.balance)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-3">
          <button onClick={() => { setActiveView('list'); setFilterCategory(null); setFilterMethod(null) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView==='list'?'bg-green-500 text-white shadow-md':'bg-white text-gray-600'}`}>Giao dịch</button>
          <button onClick={() => setActiveView('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeView==='summary'?'bg-green-500 text-white shadow-md':'bg-white text-gray-600'}`}>Tổng hợp</button>
        </div>

        {/* Filters */}
        {activeView==='list' && (
          <div className="space-y-2 mb-3">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[{v:null,l:'Tất cả'},{v:'cash',l:'💵 TM'},{v:'transfer',l:'🏦 CK'},{v:'credit',l:'💳 TD'}].map(f => (
                <button key={f.v||'all'} onClick={() => setFilterMethod(f.v)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${filterMethod===f.v?'bg-gray-800 text-white':'bg-gray-100 text-gray-600'}`}>{f.l}</button>
              ))}
            </div>
            {categories.length>0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button onClick={() => setFilterCategory(null)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${!filterCategory?'bg-green-600 text-white':'bg-gray-100 text-gray-600'}`}>Tất cả DM</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setFilterCategory(filterCategory===c.id?null:c.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${filterCategory===c.id?'text-white':'bg-gray-100 text-gray-600'}`}
                    style={filterCategory===c.id?{backgroundColor:c.color}:{}}>{c.icon} {c.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/3 mb-3"/><div className="h-12 bg-gray-100 rounded"/></div>)}</div>
        ) : activeView==='summary' ? (
          <SummaryView summary={summary} onCatClick={(id) => { setFilterCategory(id); setActiveView('list') }} />
        ) : groupedTx.length===0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-gray-500 text-sm">{filterCategory||filterMethod?'Không có giao dịch phù hợp':'Chưa có giao dịch nào'}</p>
            <button onClick={() => handleAddTx('expense')} className="mt-3 text-green-600 font-medium text-sm">+ Thêm giao dịch đầu tiên</button>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {groupedTx.map(([date, txs]) => (
              <div key={date}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-500">{formatDateLabel(date)}</span>
                  <span className="text-xs text-gray-400">
                    {(() => { const v=txs.reduce((s,t)=>s+(t.type==='income'?Number(t.amount):t.type==='expense'?-Number(t.amount):0),0); return v!==0?(v>=0?'+':'')+formatMoney(v):'' })()}
                  </span>
                </div>
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  {txs.map((tx,i) => (
                    <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 active:bg-gray-50 cursor-pointer ${i<txs.length-1?'border-b border-gray-50':''}`}
                      onClick={() => handleEditTx(tx)}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg" style={{backgroundColor:txBg(tx)}}>{txIcon(tx)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{txLabel(tx)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {!isSpecialTx(tx) && <span className="text-xs text-gray-400">{tx.category?.name}</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${mBadge(tx.payment_method||'cash')}`}>{mShort(tx.payment_method||'cash')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <p className={`text-sm font-bold ${txColor(tx)}`}>{txPrefix(tx)}{formatMoney(tx.amount)}</p>
                        {isSpecialTx(tx) && (
                          <button onClick={(e) => {e.stopPropagation(); handleDeleteTx(tx)}} className="p-1 text-gray-300 hover:text-red-500 active:scale-90 ml-1"><Trash2 size={14}/></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FABs */}
      <div className="fixed right-4 flex flex-col gap-2 z-40" style={{bottom:'calc(4.5rem + env(safe-area-inset-bottom, 0px))'}}>
        <button onClick={() => setShowTransfer(true)} className="w-11 h-11 bg-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90"><ArrowLeftRight size={18}/></button>
        <button onClick={() => setShowPayCredit(true)} className="w-11 h-11 bg-purple-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90"><CreditCard size={18}/></button>
        <button onClick={() => handleAddTx('income')} className="w-12 h-12 bg-green-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90"><ArrowDownCircle size={24}/></button>
        <button onClick={() => handleAddTx('expense')} className="w-12 h-12 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90"><ArrowUpCircle size={24}/></button>
      </div>

      <TransactionForm isOpen={showAdd} onClose={() => setShowAdd(false)} onSave={handleSaveTx}
        categories={categories} type={addType} editingTx={editingTx}
        onDelete={editingTx?() => { handleDeleteTx(editingTx); setShowAdd(false) }:null} />
      <TransferForm isOpen={showTransfer} onClose={() => setShowTransfer(false)} toast={toast} onSaved={loadData} closeBal={closeBal} />
      <PayCreditForm isOpen={showPayCredit} onClose={() => setShowPayCredit(false)} toast={toast} onSaved={loadData} closeBal={closeBal} />
      <InitialBalanceForm isOpen={showInitBal} onClose={() => setShowInitBal(false)} initialBal={initialBal} toast={toast} onSaved={loadData} />
      <CategoryManager isOpen={showCatMgr} onClose={() => setShowCatMgr(false)} categories={categories} onChanged={loadData} />
    </div>
  )
}

// ============================================
// SUMMARY VIEW
// ============================================
function SummaryView({ summary, onCatClick }) {
  const exp = summary.byCategory.filter(c => c.expense>0)
  const inc = summary.byCategory.filter(c => c.income>0)
  const maxE = Math.max(...exp.map(c=>c.expense),1), maxI = Math.max(...inc.map(c=>c.income),1)
  const m = summary.byMethod||{cash:{income:0,expense:0},transfer:{income:0,expense:0},credit:{income:0,expense:0}}

  const renderList = (items,field,max,color) => (
    <div className="space-y-2.5">{items.map(c => (
      <button key={c.category.id||'x'} className="w-full text-left active:bg-gray-50 rounded-lg p-1 -m-1" onClick={() => onCatClick(c.category.id)}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{c.category.icon}</span>
          <span className="text-xs font-medium text-gray-700 flex-1">{c.category.name}</span>
          <span className={`text-xs font-bold ${color}`}>{formatMoney(c[field])}</span>
          <span className="text-[10px] text-gray-400">({c.count})</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${(c[field]/max)*100}%`,backgroundColor:c.category.color||'#EF4444'}}/></div>
      </button>
    ))}</div>
  )

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-700 mb-3">💳 Theo phương thức</h3>
        <div className="space-y-2">
          {[{k:'cash',ic:'💵',l:'Tiền mặt',bg:'bg-amber-50'},{k:'transfer',ic:'🏦',l:'Chuyển khoản',bg:'bg-blue-50'},{k:'credit',ic:'💳',l:'Thẻ tín dụng',bg:'bg-purple-50'}].map(({k,ic,l,bg}) => (
            <div key={k} className={`flex items-center gap-3 ${bg} rounded-lg px-3 py-2.5`}>
              <span className="text-lg">{ic}</span>
              <span className="text-xs font-medium text-gray-700 flex-1">{l}</span>
              <div className="text-right">
                {k!=='credit' && <><span className="text-xs text-green-600">+{formatMoney(m[k].income)}</span><span className="text-xs text-gray-400 mx-1">/</span></>}
                <span className="text-xs text-red-600">-{formatMoney(m[k].expense)}</span>
                {k!=='credit' && <span className="text-xs font-bold ml-1.5" style={{color:m[k].income-m[k].expense>=0?'#059669':'#DC2626'}}>= {formatMoney(m[k].income-m[k].expense)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {exp.length>0 && <div className="bg-white rounded-xl p-4 shadow-sm"><h3 className="text-sm font-bold text-gray-700 mb-3">💸 Chi tiêu theo danh mục</h3>{renderList(exp,'expense',maxE,'text-red-600')}</div>}
      {inc.length>0 && <div className="bg-white rounded-xl p-4 shadow-sm"><h3 className="text-sm font-bold text-gray-700 mb-3">💰 Thu nhập theo danh mục</h3>{renderList(inc,'income',maxI,'text-green-600')}</div>}
      {exp.length===0 && inc.length===0 && <div className="bg-white rounded-xl p-8 text-center"><div className="text-4xl mb-2">📊</div><p className="text-gray-500 text-sm">Chưa có dữ liệu tháng này</p></div>}
    </div>
  )
}

// ============================================
// TRANSACTION FORM - TM/CK/TD
// ============================================
function TransactionForm({ isOpen, onClose, onSave, categories, type, editingTx, onDelete }) {
  const toast = useToast()
  const [formType, setFormType] = useState(type)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(getLocalDateString())
  const [pm, setPm] = useState('cash')
  const [saving, setSaving] = useState(false)

  const filteredCats = categories.filter(c => { const isInc=c.metadata?.is_income===true; return formType==='income'?isInc:!isInc })

  useEffect(() => {
    if(isOpen) {
      if(editingTx) { setFormType(editingTx.type); setAmount(String(editingTx.amount)); setCategoryId(editingTx.category_id||''); setNote(editingTx.note||''); setDate(editingTx.date); setPm(editingTx.payment_method||'cash') }
      else { setFormType(type); setAmount(''); setCategoryId(''); setNote(''); setDate(getLocalDateString()); setPm('cash') }
    }
  }, [isOpen, editingTx, type])

  useEffect(() => { if(!isOpen||editingTx) return; if(filteredCats.length===1) setCategoryId(filteredCats[0].id) }, [isOpen, formType, filteredCats.length])

  const handleSubmit = async () => {
    if(!amount||Number(amount)<=0) { toast.error('Nhập số tiền'); return }
    if(!categoryId) { toast.error('Chọn danh mục'); return }
    setSaving(true)
    await onSave({ type:formType, amount:Number(amount), category_id:categoryId, note, date, payment_method:pm })
    setSaving(false)
  }

  // Thu không cho chọn TD
  const pmOptions = formType==='income'
    ? [{v:'cash',l:'💵 TM',active:'border-amber-400 bg-amber-50 text-amber-700'},{v:'transfer',l:'🏦 CK',active:'border-blue-400 bg-blue-50 text-blue-700'}]
    : [{v:'cash',l:'💵 TM',active:'border-amber-400 bg-amber-50 text-amber-700'},{v:'transfer',l:'🏦 CK',active:'border-blue-400 bg-blue-50 text-blue-700'},{v:'credit',l:'💳 TD',active:'border-purple-400 bg-purple-50 text-purple-700'}]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingTx?'Sửa giao dịch':(formType==='income'?'💰 Thêm thu':'💸 Thêm chi')}>
      <div className="space-y-4 p-5">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => { setFormType('expense'); if(pm==='credit'&&false) setPm('cash') }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${formType==='expense'?'bg-red-500 text-white shadow':'text-gray-500'}`}>💸 Chi</button>
          <button onClick={() => { setFormType('income'); if(pm==='credit') setPm('cash') }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${formType==='income'?'bg-green-500 text-white shadow':'text-gray-500'}`}>💰 Thu</button>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tiền</label>
          <div className="relative">
            <input type="text" inputMode="numeric" value={amount?Number(amount).toLocaleString('vi-VN'):''}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" autoFocus
              className="w-full text-2xl font-bold text-center py-4 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-200"/>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">đ</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {[10000,20000,50000,100000,200000,500000].map(q => (
              <button key={q} onClick={() => setAmount(String(q))} className="py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-medium text-gray-600 active:scale-95">{formatMoney(q)}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Phương thức</label>
          <div className="flex gap-2">
            {pmOptions.map(o => (
              <button key={o.v} onClick={() => setPm(o.v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 active:scale-95 ${pm===o.v?o.active:'border-gray-200 bg-white text-gray-500'}`}>{o.l}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1.5 block">Danh mục</label>
          {filteredCats.length===0 ? <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">Chưa có danh mục. Bấm ⚙️ để thêm.</p> : (
            <div className="grid grid-cols-4 gap-2">{filteredCats.map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 active:scale-95 ${categoryId===c.id?'border-green-500 bg-green-50':'border-transparent bg-gray-50'}`}>
                <span className="text-xl">{c.icon}</span>
                <span className="text-[10px] font-medium text-gray-600 truncate w-full text-center">{c.name}</span>
              </button>
            ))}</div>
          )}
        </div>

        <div><label className="text-xs text-gray-500 mb-1 block">Ngày</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Mua nguyên liệu..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>

        <div className="flex gap-2 pt-2">
          {onDelete && <button onClick={onDelete} className="px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={18}/></button>}
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':(editingTx?'Cập nhật':'Thêm')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// TRANSFER FORM (TM↔CK)
// ============================================
function TransferForm({ isOpen, onClose, toast, onSaved, closeBal }) {
  const [amount, setAmount] = useState(''); const [dir, setDir] = useState('cash')
  const [date, setDate] = useState(getLocalDateString()); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { if(isOpen) { setAmount(''); setNote(''); setDir('cash'); setDate(getLocalDateString()) } }, [isOpen])

  const handleSave = async () => {
    if(!amount||Number(amount)<=0) { toast.error('Nhập số tiền'); return }
    setSaving(true)
    try { await createTransaction({ type:'transfer', amount:Number(amount), payment_method:dir, date, note:note||(dir==='cash'?'Chuyển TM → CK':'Chuyển CK → TM'), category_id:null }); toast.success('Đã chuyển'); onClose(); onSaved() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Chuyển tiền nội bộ">
      <div className="space-y-4 p-5">
        <div className="flex gap-2">
          <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center"><p className="text-[10px] text-amber-600">💵 TM</p><p className="text-sm font-bold text-amber-700">{formatMoney(closeBal?.cash||0)}</p></div>
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center"><p className="text-[10px] text-blue-600">🏦 CK</p><p className="text-sm font-bold text-blue-700">{formatMoney(closeBal?.transfer||0)}</p></div>
        </div>
        <div><label className="text-xs text-gray-500 mb-1.5 block">Hướng chuyển</label>
          <div className="flex gap-2">
            <button onClick={() => setDir('cash')} className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 active:scale-95 ${dir==='cash'?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-gray-200 text-gray-500'}`}>💵 → 🏦</button>
            <button onClick={() => setDir('transfer')} className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 active:scale-95 ${dir==='transfer'?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-gray-200 text-gray-500'}`}>🏦 → 💵</button>
          </div>
        </div>
        <div><label className="text-xs text-gray-500 mb-1 block">Số tiền</label><div className="relative"><input type="text" inputMode="numeric" value={amount?Number(amount).toLocaleString('vi-VN'):''} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" autoFocus className="w-full text-xl font-bold text-center py-3 border-2 border-gray-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Ngày</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={dir==='cash'?'Nạp tiền vào bank':'Rút ATM'} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':'Chuyển'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// PAY CREDIT FORM (Trả nợ TD)
// ============================================
function PayCreditForm({ isOpen, onClose, toast, onSaved, closeBal }) {
  const [amount, setAmount] = useState(''); const [source, setSource] = useState('transfer')
  const [date, setDate] = useState(getLocalDateString()); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { if(isOpen) { setAmount(''); setNote(''); setSource('transfer'); setDate(getLocalDateString()) } }, [isOpen])

  const creditDebt = closeBal?.credit||0

  const handleSave = async () => {
    if(!amount||Number(amount)<=0) { toast.error('Nhập số tiền'); return }
    setSaving(true)
    try { await createTransaction({ type:'pay_credit', amount:Number(amount), payment_method:source, date, note:note||`Trả nợ TD từ ${source==='cash'?'TM':'CK'}`, category_id:null }); toast.success('Đã trả nợ TD'); onClose(); onSaved() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💳 Trả nợ thẻ tín dụng">
      <div className="space-y-4 p-5">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-xs text-purple-600">Nợ TD hiện tại</p>
          <p className={`text-xl font-bold ${creditDebt>0?'text-red-600':'text-green-600'}`}>{creditDebt>0?'-':''}{formatMoney(Math.abs(creditDebt))}</p>
        </div>

        {creditDebt<=0 ? (
          <div className="text-center py-4"><p className="text-gray-500 text-sm">Không có nợ TD cần trả 🎉</p></div>
        ) : (<>
          <div><label className="text-xs text-gray-500 mb-1.5 block">Trả từ</label>
            <div className="flex gap-2">
              <button onClick={() => setSource('transfer')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 active:scale-95 ${source==='transfer'?'border-blue-400 bg-blue-50 text-blue-700':'border-gray-200 text-gray-500'}`}>🏦 CK ({formatMoney(closeBal?.transfer||0)})</button>
              <button onClick={() => setSource('cash')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 active:scale-95 ${source==='cash'?'border-amber-400 bg-amber-50 text-amber-700':'border-gray-200 text-gray-500'}`}>💵 TM ({formatMoney(closeBal?.cash||0)})</button>
            </div>
          </div>

          <div><label className="text-xs text-gray-500 mb-1 block">Số tiền trả</label>
            <div className="relative"><input type="text" inputMode="numeric" value={amount?Number(amount).toLocaleString('vi-VN'):''} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" autoFocus className="w-full text-xl font-bold text-center py-3 border-2 border-gray-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div>
            <button onClick={() => setAmount(String(creditDebt))} className="mt-1.5 text-xs text-purple-600 font-medium hover:underline">Trả hết ({formatMoney(creditDebt)})</button>
          </div>

          <div><label className="text-xs text-gray-500 mb-1 block">Ngày</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Trả bill VISA tháng 3" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>

          {amount && Number(amount)>0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs space-y-0.5">
              <p className="text-purple-700 font-medium">{source==='cash'?'💵 TM':'🏦 CK'}: {formatMoney(closeBal?.[source]||0)} → {formatMoney((closeBal?.[source]||0)-Number(amount))}</p>
              <p className="text-purple-700 font-medium">💳 Nợ TD: {formatMoney(creditDebt)} → {formatMoney(creditDebt-Number(amount))}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':'Trả nợ'}</button>
          </div>
        </>)}
      </div>
    </Modal>
  )
}

// ============================================
// INITIAL BALANCE FORM
// ============================================
function InitialBalanceForm({ isOpen, onClose, initialBal, toast, onSaved }) {
  const [cash, setCash] = useState(''); const [transfer, setTransfer] = useState(''); const [credit, setCredit] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { if(isOpen) { setCash(String(initialBal.cash||'')); setTransfer(String(initialBal.transfer||'')); setCredit(String(initialBal.credit||'')) } }, [isOpen, initialBal])

  const handleSave = async () => {
    setSaving(true)
    try { await saveInitialBalances(Number(cash)||0, Number(transfer)||0, Number(credit)||0, initialBal.id); toast.success('Đã lưu'); onClose(); onSaved() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Số dư ban đầu">
      <div className="space-y-4 p-5">
        <p className="text-xs text-gray-500">Nhập số dư thực tế khi bắt đầu dùng app.</p>
        <div><label className="text-xs text-gray-500 mb-1 block">💵 Tiền mặt</label><div className="relative"><input type="text" inputMode="numeric" value={cash?Number(cash).toLocaleString('vi-VN'):''} onChange={e => setCash(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full text-lg font-bold text-center py-3 border-2 border-amber-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div><label className="text-xs text-gray-500 mb-1 block">🏦 Chuyển khoản</label><div className="relative"><input type="text" inputMode="numeric" value={transfer?Number(transfer).toLocaleString('vi-VN'):''} onChange={e => setTransfer(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full text-lg font-bold text-center py-3 border-2 border-blue-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div><label className="text-xs text-gray-500 mb-1 block">💳 Nợ thẻ tín dụng hiện tại</label><div className="relative"><input type="text" inputMode="numeric" value={credit?Number(credit).toLocaleString('vi-VN'):''} onChange={e => setCredit(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full text-lg font-bold text-center py-3 border-2 border-purple-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Tài sản ròng ban đầu</p><p className="text-lg font-bold text-gray-800">{formatMoney((Number(cash)||0)+(Number(transfer)||0)-(Number(credit)||0))}</p></div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':'Lưu'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// CATEGORY MANAGER
// ============================================
function CategoryManager({ isOpen, onClose, categories, onChanged }) {
  const toast = useToast()
  const [showForm, setShowForm] = useState(false); const [editingCat, setEditingCat] = useState(null)
  const [fd, setFd] = useState({ name:'', icon:'📦', color:'#3B82F6', is_income:false }); const [saving, setSaving] = useState(false)
  const expCats = categories.filter(c => !c.metadata?.is_income), incCats = categories.filter(c => c.metadata?.is_income===true)

  const openAdd = (isInc) => { setEditingCat(null); setFd({name:'',icon:'📦',color:'#3B82F6',is_income:isInc}); setShowForm(true) }
  const openEdit = (cat) => { setEditingCat(cat); setFd({name:cat.name,icon:cat.icon,color:cat.color,is_income:cat.metadata?.is_income||false}); setShowForm(true) }

  const handleSave = async () => {
    if(!fd.name.trim()) return; setSaving(true)
    try {
      if(editingCat) { await updateExpenseCategory(editingCat.id,{name:fd.name.trim(),icon:fd.icon,color:fd.color,metadata:{is_income:fd.is_income}}); toast.success('Đã cập nhật') }
      else { await createExpenseCategory({name:fd.name.trim(),icon:fd.icon,color:fd.color,metadata:{is_income:fd.is_income},sort_order:categories.length+1}); toast.success('Đã thêm') }
      setShowForm(false); onChanged()
    } catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false) }
  }

  const handleDel = async (cat) => {
    if(!confirm(`Xóa "${cat.name}"?`)) return
    try { await deleteExpenseCategory(cat.id); toast.success('Đã xóa'); onChanged() } catch { toast.error('Lỗi') }
  }

  const renderList = (list, label, isInc) => (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-gray-700">{label}</h4>
        <button onClick={() => openAdd(isInc)} className="flex items-center gap-1 text-xs text-green-600 font-medium px-2 py-1 hover:bg-green-50 rounded-lg active:scale-95"><Plus size={14}/> Thêm</button>
      </div>
      {list.length===0 ? <p className="text-xs text-gray-400 py-3 text-center">Chưa có</p> : (
        <div className="space-y-1">{list.map(cat => (
          <div key={cat.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0" style={{backgroundColor:cat.color+'20'}}>{cat.icon}</div>
            <span className="text-sm font-medium text-gray-800 flex-1">{cat.name}</span>
            <button onClick={() => openEdit(cat)} className="p-2 text-gray-400 hover:text-blue-500 active:scale-90"><Edit2 size={16}/></button>
            <button onClick={() => handleDel(cat)} className="p-2 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={16}/></button>
          </div>
        ))}</div>
      )}
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Quản lý danh mục">
      {!showForm ? (
        <div className="p-5">{renderList(expCats,'💸 Danh mục chi',false)}{renderList(incCats,'💰 Danh mục thu',true)}</div>
      ) : (
        <div className="space-y-4 p-5">
          <button onClick={() => setShowForm(false)} className="flex items-center gap-1 text-sm text-gray-500"><ChevronLeft size={16}/> Quay lại</button>
          <h4 className="font-bold text-gray-700">{editingCat?`Sửa "${editingCat.name}"`:`Thêm danh mục ${fd.is_income?'thu':'chi'}`}</h4>
          <div><label className="text-xs text-gray-500 mb-1 block">Tên</label><input type="text" value={fd.name} onChange={e => setFd({...fd,name:e.target.value})} placeholder="Ví dụ: Ăn uống" autoFocus className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
          <div><label className="text-xs text-gray-500 mb-1.5 block">Icon</label><div className="flex flex-wrap gap-2">{ICONS.map(ic => <button key={ic} onClick={() => setFd({...fd,icon:ic})} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg active:scale-90 ${fd.icon===ic?'bg-green-100 ring-2 ring-green-500':'bg-gray-50'}`}>{ic}</button>)}</div></div>
          <div><label className="text-xs text-gray-500 mb-1.5 block">Màu</label><div className="flex flex-wrap gap-2">{COLORS.map(cl => <button key={cl} onClick={() => setFd({...fd,color:cl})} className={`w-9 h-9 rounded-full active:scale-90 ${fd.color===cl?'ring-2 ring-offset-2 ring-gray-400 scale-110':''}`} style={{backgroundColor:cl}}/>)}</div></div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{backgroundColor:fd.color+'20'}}>{fd.icon}</div>
            <span className="text-sm font-medium">{fd.name||'Tên danh mục'}</span>
            <span className={`text-xs ml-auto px-2 py-0.5 rounded-full ${fd.is_income?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{fd.is_income?'Thu':'Chi'}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
            <button onClick={handleSave} disabled={saving||!fd.name.trim()} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':(editingCat?'Cập nhật':'Thêm')}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
