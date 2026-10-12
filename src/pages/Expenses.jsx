// ============================================
// EXPENSES PAGE - v3
// + TM/CK/TD, Lũy kế, Chuyển nội bộ, Trả nợ TD
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw, ChevronLeft, ChevronRight, Trash2,
  ArrowUpCircle, ArrowDownCircle, Settings, Plus, X, Edit2, ArrowLeftRight, CreditCard,
  Search
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoney, moneyFull, getLocalDateString, stripVN } from '../lib/helpers'
import {
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getExpenseSummary, getRunningBalance, getInitialBalances, saveInitialBalances,
  getCards, saveCard, archiveCard, getUnassignedCredit, suggestCard, assignCard, reconcile, previewReconcile, closeCardBooks, getCardCutoff,
  getReconState, backdateWarnings, warnText, getHealth, convertToPayCredit, keepAsExpense
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
const ICON_GROUPS = [
  { label: 'Ăn uống',    icons: ['🍜','🍚','🍲','🥘','🍖','🍗','🐟','🦐','🥗','🥬','🍅','🍎','🍌','🥭','☕','🍵','🧋','🍺','🍷','🥤','🍰','🍪','🍫','🧊'] },
  { label: 'Nhà cửa',    icons: ['🏠','🏡','🛏️','🛋️','🚿','🚽','🧹','🧽','🧴','🧺','💡','🔌','🔧','🔨','🪑','🪟','🌡️','🧯','🗑️','📦'] },
  { label: 'Đi lại',     icons: ['🚗','🏍️','🚲','🚕','🚌','🚂','✈️','⛽','🛣️','🅿️','🛵','🚢','🎫','🗺️'] },
  { label: 'Sức khoẻ',   icons: ['💊','💉','🏥','🩺','🦷','👓','🧘','🏃','🏋️','⚕️','🩹','🌿','🧪','🔬'] },
  { label: 'Mua sắm',    icons: ['🛒','🛍️','👕','👗','👖','👟','👜','💄','💍','⌚','🕶️','🧢','🧦','🎒'] },
  { label: 'Công việc',  icons: ['💼','📱','💻','🖨️','📞','📧','📊','📈','📝','🗂️','🖇️','📌','🏢','🏭','🔖'] },
  { label: 'Tiền bạc',   icons: ['💰','💵','💳','🏦','🧾','💸','🪙','📉','🤝','📃','🔐','🎰'] },
  { label: 'Gia đình',   icons: ['👶','🧒','👦','👧','🧑','👩','👨','👵','👴','🐾','🐶','🐱','🎂','🎁','💐','🧸'] },
  { label: 'Học & chơi', icons: ['🎓','📚','📖','✏️','🎮','🎬','🎵','🎨','⚽','🏸','🎣','🎯','🎪','🎤'] },
  { label: 'Tâm linh',   icons: ['🕯️','🙏','🧧','🏮','⛩️','🪷','📿','🎎','🍀','☯️'] },
  { label: 'Khác',       icons: ['📦','⭐','❗','❓','🔔','🔑','✂️','🧰','♻️','🆕','🔴','🟡','🟢','🔵','🟣','⚫'] },
]
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
  const [search, setSearch] = useState('')
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showPayCredit, setShowPayCredit] = useState(false)
  const [showInitBal, setShowInitBal] = useState(false)
  const [cards, setCards] = useState([])
  const [showCards, setShowCards] = useState(false)
  const [recon, setRecon] = useState(null)              // { kind, cardId } đang đối soát
  const [reconLast, setReconLast] = useState({})        // mốc đối soát gần nhất của từng tài khoản
  const [showHealth, setShowHealth] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getMonthRange(currentMonth)
      const [cats,txs,sum,running,initBal,cds,rl] = await Promise.all([
        getExpenseCategories(), getTransactions({startDate:start,endDate:end}),
        getExpenseSummary(start,end), getRunningBalance(start), getInitialBalances(), getCards(), getReconState()
      ])
      setCategories(cats); setTransactions(txs); setSummary(sum); setRunningBal(running); setInitialBal(initBal); setCards(cds); setReconLast(rl)
    } catch(err) { console.error(err); toast.error('Lỗi tải dữ liệu') }
    finally { setLoading(false) }
  }, [currentMonth, toast])

  useEffect(() => { loadData() }, [loadData])

  // Balances
  const openBal = useMemo(() => ({
    cash: initialBal.cash + runningBal.cash,
    transfer: initialBal.transfer + runningBal.transfer,
    credit: initialBal.credit + runningBal.credit, // nợ TD
    cards: { ...(runningBal.cards || {}), none: ((runningBal.cards || {}).none || 0) + initialBal.credit },
    get total() { return this.cash + this.transfer - this.credit }
  }), [initialBal, runningBal])

  const monthMoves = useMemo(() => {
    let c2t=0, t2c=0, payCreditCash=0, payCreditTransfer=0, refundCredit=0, creditSpend=0, adjCash=0, adjTransfer=0, adjCredit=0
    const cardMv = {}, card = (id, d) => { const k = id || 'none'; cardMv[k] = (cardMv[k] || 0) + d }
    transactions.forEach(t => {
      const amt = Number(t.amount), m = t.payment_method||'cash'
      if (t.type==='transfer') { if(m==='cash') c2t+=amt; else t2c+=amt }
      else if (t.type==='pay_credit') { if(m==='cash') payCreditCash+=amt; else if(m==='transfer') payCreditTransfer+=amt; else refundCredit+=amt; card(t.card_id, -amt) }   // 'credit' = hoàn tiền về thẻ
      else if (t.type==='expense' && m==='credit') { creditSpend+=amt; card(t.card_id, amt) }
      else if (t.type==='adjust') { if(m==='cash') adjCash+=amt; else if(m==='transfer') adjTransfer+=amt; else if(m==='credit') { adjCredit+=amt; card(t.card_id, amt) } }
    })
    return { c2t, t2c, payCreditCash, payCreditTransfer, refundCredit, creditSpend, adjCash, adjTransfer, adjCredit, cardMv }
  }, [transactions])

  const closeBal = useMemo(() => {
    const m = summary.byMethod||{cash:{income:0,expense:0},transfer:{income:0,expense:0},credit:{income:0,expense:0}}
    const mv = monthMoves
    return {
      cash: openBal.cash + m.cash.income - m.cash.expense - mv.c2t + mv.t2c - mv.payCreditCash + mv.adjCash,
      transfer: openBal.transfer + m.transfer.income - m.transfer.expense - mv.t2c + mv.c2t - mv.payCreditTransfer + mv.adjTransfer,
      credit: openBal.credit + mv.creditSpend - mv.payCreditCash - mv.payCreditTransfer - mv.refundCredit + mv.adjCredit,
      cards: Object.fromEntries([...new Set([...Object.keys(openBal.cards), ...Object.keys(mv.cardMv)])].map(k => [k, (openBal.cards[k] || 0) + (mv.cardMv[k] || 0)])),
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
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      // Gõ số thì tìm cả theo số tiền: "1650000", "1.650.000" hay "1650" đều ra
      const num = q.replace(/[^\d]/g, '')
      f = f.filter(t =>
        (t.note || '').toLowerCase().includes(q) ||
        (t.category?.name || '').toLowerCase().includes(q) ||
        (num && String(Math.round(Number(t.amount) || 0)).includes(num))
      )
    }
    const g = {}
    f.forEach(tx => { if(!g[tx.date]) g[tx.date]=[]; g[tx.date].push(tx) })
    return Object.entries(g).sort(([a],[b]) => b.localeCompare(a))
  }, [transactions, filterCategory, filterMethod, search])

  // Tổng của phần đang xem — để biết nhóm giao dịch vừa lọc cộng lại bao nhiêu
  const searchTotal = useMemo(() => {
    if (!search.trim() && !filterCategory && !filterMethod) return null
    let thu = 0, chi = 0
    groupedTx.forEach(([, list]) => list.forEach(t => {
      const a = Number(t.amount) || 0
      if (t.type === 'income') thu += a; else if (t.type === 'expense') chi += a   // trả thẻ, chuyển, điều chỉnh không phải chi
    }))
    return { thu, chi, count: groupedTx.reduce((s, [, l]) => s + l.length, 0) }
  }, [groupedTx, search, filterCategory, filterMethod])

  // Handlers
  const handleAddTx = (type) => { setAddType(type); setEditingTx(null); setShowAdd(true) }
  const handleEditTx = (tx) => { if(tx.type==='transfer'||tx.type==='pay_credit'||tx.type==='adjust') return; setEditingTx(tx); setAddType(tx.type); setShowAdd(true) }
  const handleDeleteTx = async (tx) => {
    if(!confirm(`Xóa "${tx.note||tx.category?.name||'giao dịch'}"?`)) return
    const ws = backdateWarnings(tx, reconLast, cards); if (ws.length && !confirm(warnText(ws))) return
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
    if(tx.type==='pay_credit') return tx.payment_method==='credit' ? '🎁' : '💳'
    if(tx.type==='adjust') return '⚖️'
    return tx.category?.icon||'📦'
  }
  const txBg = (tx) => {
    if(tx.type==='transfer') return '#E0E7FF'
    if(tx.type==='pay_credit') return '#F3E8FF'
    if(tx.type==='adjust') return '#F3F4F6'
    return (tx.category?.color||'#6B7280')+'15'
  }
  const txLabel = (tx) => {
    if(tx.type==='transfer') return `Chuyển ${(tx.payment_method||'cash')==='cash'?'TM → CK':'CK → TM'}`
    if(tx.type==='pay_credit') return tx.payment_method==='credit' ? `Hoàn tiền về thẻ ${cardName(tx.card_id)||''}`.trim() : `Trả nợ TD từ ${(tx.payment_method||'cash')==='cash'?'TM':'CK'}`
    if(tx.type==='adjust') return `Điều chỉnh đối soát · ${tx.payment_method==='cash'?'TM':tx.payment_method==='transfer'?'CK':'thẻ '+(cardName(tx.card_id)||'chưa phân')}`
    return tx.note||tx.category?.name||'Giao dịch'
  }
  const txColor = (tx) => {
    if(tx.type==='income') return 'text-green-600'
    if(tx.type==='expense') return 'text-red-600'
    if(tx.type==='pay_credit') return 'text-purple-600'
    if(tx.type==='adjust') return 'text-gray-600'
    return 'text-indigo-600'
  }
  const txPrefix = (tx) => tx.type==='income'?'+':tx.type==='expense'?'-':tx.type==='adjust'&&Number(tx.amount)>0?'+':''
  const isSpecialTx = (tx) => tx.type==='transfer'||tx.type==='pay_credit'||tx.type==='adjust'
  const cardName = (id) => id ? cards.find(c => c.id === id)?.name : null

  return (
    <div className="pb-4">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">💰 Thu Chi</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHealth(true)} aria-label="Sức khoẻ sổ" className="p-2 text-gray-400 hover:text-gray-600 rounded-lg text-base">🩺</button>
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
          {/* Tiền đang có = tiền mặt + chuyển khoản (chưa trừ nợ thẻ) */}
          <div className="flex items-end justify-between gap-3 mb-2">
            <div className="min-w-0"><p className="text-[11px] text-gray-300">💰 {isCurMonth ? 'Tiền đang có' : 'Tiền có cuối tháng'} · TM + CK</p>
              <p className={`text-2xl font-bold leading-tight ${closeBal.cash + closeBal.transfer >= 0 ? 'text-white' : 'text-red-300'}`}>{moneyFull(closeBal.cash + closeBal.transfer)}</p></div>
            <div className="text-right flex-shrink-0"><p className="text-[11px] text-gray-400">Trừ nợ thẻ còn</p>
              <p className={`text-sm font-bold ${closeBal.total>=0?'text-green-300':'text-red-300'}`}>{moneyFull(closeBal.total)}</p></div>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">Ròng đầu tháng {moneyFull(openBal.total)} → cuối tháng {moneyFull(closeBal.total)}</p>
          <div className="flex gap-1.5">
            <button onClick={() => setRecon({ kind: 'cash' })} aria-label="Đối soát tiền mặt" className="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-center active:bg-white/20">
              <p className="text-[9px] text-gray-400">💵 TM ⚖️</p>
              <p className={`text-xs font-bold ${closeBal.cash>=0?'text-amber-300':'text-red-300'}`}>{formatMoney(closeBal.cash)}</p>
            </button>
            <button onClick={() => setRecon({ kind: 'transfer' })} aria-label="Đối soát chuyển khoản" className="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-center active:bg-white/20">
              <p className="text-[9px] text-gray-400">🏦 CK ⚖️</p>
              <p className={`text-xs font-bold ${closeBal.transfer>=0?'text-blue-300':'text-red-300'}`}>{formatMoney(closeBal.transfer)}</p>
            </button>
            <button onClick={() => setShowCards(true)} aria-label="Thẻ tín dụng" className="flex-1 bg-white/10 rounded-lg px-2 py-1.5 text-center active:bg-white/20">
              <p className="text-[9px] text-gray-400">💳 Nợ TD ›</p>
              <p className={`text-xs font-bold ${closeBal.credit<=0?'text-green-300':'text-red-300'}`}>{closeBal.credit>0?'-':''}{formatMoney(Math.abs(closeBal.credit))}</p>
            </button>
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
            {/* Tìm kiếm */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm ghi chú, danh mục, số tiền..."
                className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl bg-white
                  focus:outline-none focus:border-green-400"/>
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 p-0.5 active:scale-90">
                  <X size={15}/>
                </button>
              )}
            </div>

            {/* Tổng của phần đang xem */}
            {searchTotal && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs">
                <span className="text-gray-500">{searchTotal.count} giao dịch</span>
                {searchTotal.thu > 0 && (
                  <span className="text-green-600 font-semibold">+{formatMoney(searchTotal.thu)}</span>
                )}
                {searchTotal.chi > 0 && (
                  <span className="text-red-500 font-semibold">−{formatMoney(searchTotal.chi)}</span>
                )}
                <button onClick={() => { setSearch(''); setFilterCategory(null); setFilterMethod(null) }}
                  className="ml-auto text-gray-400 active:scale-95">Bỏ lọc</button>
              </div>
            )}

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
                    style={filterCategory===c.id?{backgroundColor:c.color}:{}}>
{c.icon} {c.name}</button>
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
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${mBadge(tx.payment_method||'cash')}`}>{mShort(tx.payment_method||'cash')}{(tx.payment_method==='credit'||tx.type==='pay_credit') && cardName(tx.card_id) ? '·' + cardName(tx.card_id) : ''}</span>
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

      <TransactionForm isOpen={showAdd} onClose={() => setShowAdd(false)} onSave={handleSaveTx} cards={cards} reconLast={reconLast}
        categories={categories} type={addType} editingTx={editingTx}
        onDelete={editingTx?() => { handleDeleteTx(editingTx); setShowAdd(false) }:null} />
      <TransferForm isOpen={showTransfer} onClose={() => setShowTransfer(false)} toast={toast} onSaved={loadData} closeBal={closeBal} reconLast={reconLast} />
      <PayCreditForm isOpen={showPayCredit} onClose={() => setShowPayCredit(false)} toast={toast} onSaved={loadData} closeBal={closeBal} cards={cards} reconLast={reconLast} />
      <CardsSheet isOpen={showCards} onClose={() => setShowCards(false)} cards={cards} cardDebts={closeBal.cards || {}} toast={toast} onSaved={loadData}
        onReconcile={t => { setShowCards(false); setRecon(t) }} />
      <ReconcileForm target={recon} cards={cards} toast={toast} onClose={() => setRecon(null)} onSaved={loadData} />
      <HealthSheet isOpen={showHealth} onClose={() => setShowHealth(false)} cards={cards} reconLast={reconLast} toast={toast} onSaved={loadData}
        onReconcile={t => { setShowHealth(false); setRecon(t) }} onOpenCards={() => { setShowHealth(false); setShowCards(true) }} />
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
function TransactionForm({ isOpen, onClose, onSave, categories, type, editingTx, onDelete, cards = [], reconLast = {} }) {
  const toast = useToast()
  const [formType, setFormType] = useState(type)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(getLocalDateString())
  const [pm, setPm] = useState('cash')
  const [cardId, setCardId] = useState('')               // thẻ nào (khi trả bằng TD)
  const [saving, setSaving] = useState(false); const busyRef = useRef(false)   // chặn bấm đúp ngay lần chạm đầu

  const filteredCats = categories.filter(c => { const isInc=c.metadata?.is_income===true; return formType==='income'?isInc:!isInc })

  useEffect(() => {
    if(isOpen) {
      if(editingTx) { setFormType(editingTx.type); setAmount(String(editingTx.amount)); setCategoryId(editingTx.category_id||''); setNote(editingTx.note||''); setDate(editingTx.date); setPm(editingTx.payment_method||'cash'); setCardId(editingTx.card_id||'') }
      else { setFormType(type); setAmount(''); setCategoryId(''); setNote(''); setDate(getLocalDateString()); setPm('cash'); setCardId((()=>{try{return localStorage.getItem('thuchi_last_card')||''}catch{return ''}})()) }
    }
  }, [isOpen, editingTx, type])

  useEffect(() => { if(!isOpen||editingTx) return; if(filteredCats.length===1) setCategoryId(filteredCats[0].id) }, [isOpen, formType, filteredCats.length])   // eslint-disable-line react-hooks/exhaustive-deps -- chỉ tự chọn danh mục khi mở hoặc đổi loại

  const handleSubmit = async () => {
    if(!amount||Number(amount)<=0) { toast.error('Nhập số tiền'); return }
    if(!categoryId) { toast.error('Chọn danh mục'); return }
    const useCard = pm==='credit' && cards.length > 0
    if(useCard && !cards.some(c => c.id === cardId)) { toast.error('Chọn thẻ tín dụng'); return }
    if (busyRef.current) return
    { const next = { type: formType, payment_method: pm, card_id: pm==='credit' ? (cardId || null) : null, date }
      // Sửa mà không đổi tiền, ngày, loại, nguồn, thẻ (vd chỉ sửa ghi chú) → số dư không đổi, không cần hỏi
      const same = editingTx && editingTx.type === formType && Number(editingTx.amount) === Number(amount) && editingTx.date === date
        && (editingTx.payment_method || 'cash') === pm && (pm !== 'credit' || (editingTx.card_id || '') === (cardId || ''))
      const ws = same ? [] : [...backdateWarnings(next, reconLast, cards), ...(editingTx ? backdateWarnings(editingTx, reconLast, cards) : [])]
      const uniq = ws.filter((w, i) => ws.findIndex(x => x.key === w.key) === i)
      if (uniq.length && !confirm(warnText(uniq))) return }
    busyRef.current = true; setSaving(true)
    if (useCard) { try { localStorage.setItem('thuchi_last_card', cardId) } catch { /* bỏ qua */ } }
    await onSave({ type:formType, amount:Number(amount), category_id:categoryId, note, date, payment_method:pm, ...(cards.length ? { card_id: pm==='credit' ? (cardId || null) : null } : {}) })   // chỉ gửi cột thẻ khi đã có thẻ (an toàn nếu chưa chạy SQL)
    setSaving(false); busyRef.current = false
  }

  // Thu không cho chọn TD
  const pmOptions = formType==='income'
    ? [{v:'cash',l:'💵 TM',active:'border-amber-400 bg-amber-50 text-amber-700'},{v:'transfer',l:'🏦 CK',active:'border-blue-400 bg-blue-50 text-blue-700'}]
    : [{v:'cash',l:'💵 TM',active:'border-amber-400 bg-amber-50 text-amber-700'},{v:'transfer',l:'🏦 CK',active:'border-blue-400 bg-blue-50 text-blue-700'},{v:'credit',l:'💳 TD',active:'border-purple-400 bg-purple-50 text-purple-700'}]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingTx?'Sửa giao dịch':(formType==='income'?'💰 Thêm thu':'💸 Thêm chi')}>
      <div className="space-y-4 p-5">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => { setFormType('expense'); /* chi được trả bằng TM, CK hoặc thẻ — giữ nguyên nguồn đang chọn */ }} className={`flex-1 py-2.5 rounded-lg text-sm font-bold ${formType==='expense'?'bg-red-500 text-white shadow':'text-gray-500'}`}>💸 Chi</button>
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
          {pm==='credit' && cards.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">
            {cards.map(c => <button key={c.id} onClick={() => setCardId(c.id)}
              className={`px-3 py-2 rounded-full text-xs font-bold border-2 ${cardId===c.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
              style={cardId===c.id ? { background: c.color, borderColor: c.color } : {}}>💳 {c.name}{c.last4 ? ' ·' + c.last4 : ''}</button>)}
          </div>}
          {pm==='credit' && cards.length === 0 && <p className="text-[11px] text-purple-600 mt-1.5">Mẹo: bấm ô "Nợ TD" trên đầu để thêm các thẻ, theo dõi riêng từng thẻ.</p>}
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
function TransferForm({ isOpen, onClose, toast, onSaved, closeBal, reconLast = {} }) {
  const [amount, setAmount] = useState(''); const [dir, setDir] = useState('cash')
  const [date, setDate] = useState(getLocalDateString()); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false); const busyRef = useRef(false)   // chặn bấm đúp ngay lần chạm đầu
  useEffect(() => { if(isOpen) { setAmount(''); setNote(''); setDir('cash'); setDate(getLocalDateString()) } }, [isOpen])

  const handleSave = async () => {
    if(!amount||Number(amount)<=0) { toast.error('Nhập số tiền'); return }
    { const ws = backdateWarnings({ type: 'transfer', payment_method: dir, date }, reconLast); if (ws.length && !confirm(warnText(ws))) return }
    if (busyRef.current) return
    busyRef.current = true; setSaving(true)
    try { await createTransaction({ type:'transfer', amount:Number(amount), payment_method:dir, date, note:note||(dir==='cash'?'Chuyển TM → CK':'Chuyển CK → TM'), category_id:null }); toast.success('Đã chuyển'); onClose(); onSaved() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false); busyRef.current = false }
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
function PayCreditForm({ isOpen, onClose, toast, onSaved, closeBal, cards = [], reconLast = {} }) {
  const [amount, setAmount] = useState(''); const [source, setSource] = useState('transfer')
  const [date, setDate] = useState(getLocalDateString()); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false); const busyRef = useRef(false)   // chặn bấm đúp ngay lần chạm đầu
  const [cardId, setCardId] = useState('')
  useEffect(() => { if(isOpen) { setAmount(''); setNote(''); setSource('transfer'); setDate(getLocalDateString()); setCardId(cards.length === 1 ? cards[0].id : '') } }, [isOpen])   // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đặt lại khi MỞ form

  const card = cards.find(c => c.id === cardId)
  const creditDebt = cards.length ? Math.round((closeBal?.cards||{})[cardId || 'none'] || 0) : (closeBal?.credit||0)

  const handleSave = async () => {
    if(!amount||Number(amount)<=0) { toast.error('Nhập số tiền'); return }
    if(cards.length && !card) { toast.error('Chọn thẻ đang trả'); return }
    if (busyRef.current) return
    { const ws = backdateWarnings({ type: 'pay_credit', payment_method: source, card_id: card ? card.id : null, date }, reconLast, cards); if (ws.length && !confirm(warnText(ws))) return }
    busyRef.current = true; setSaving(true)
    try { await createTransaction({ type:'pay_credit', amount:Number(amount), payment_method:source, date, note:note||(source==='credit' ? `Hoàn tiền thẻ ${card ? card.name : 'TD'}` : `Trả thẻ ${card ? card.name : 'TD'} từ ${source==='cash'?'TM':'CK'}`), category_id:null, ...(card ? { card_id: card.id } : {}) }); toast.success('Đã trả nợ TD'); onClose(); onSaved() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false); busyRef.current = false }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💳 Trả nợ thẻ tín dụng">
      <div className="space-y-4 p-5">
        {cards.length > 0 && <div className="flex flex-wrap gap-1.5">{cards.map(c => <button key={c.id} onClick={() => setCardId(c.id)}
          className={`px-3 py-2 rounded-full text-xs font-bold border-2 ${cardId===c.id ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
          style={cardId===c.id ? { background: c.color, borderColor: c.color } : {}}>💳 {c.name}</button>)}</div>}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-xs text-purple-600">{card ? `Nợ thẻ ${card.name} hiện tại` : 'Nợ TD hiện tại'}</p>
          <p className={`text-xl font-bold ${creditDebt>0?'text-red-600':'text-green-600'}`}>{creditDebt>0?'-':''}{moneyFull(Math.abs(creditDebt))}</p>
        </div>

        {creditDebt<=0 && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">App đang ghi nhận thẻ này không có nợ. Nếu bạn vừa trả thật, vẫn ghi bình thường — rồi dùng ⚖️ Đối soát để khớp với sao kê.</p>}
        {(<>
          <div><label className="text-xs text-gray-500 mb-1.5 block">Nguồn</label>
            <div className="flex gap-2">
              <button onClick={() => setSource('transfer')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 active:scale-95 ${source==='transfer'?'border-blue-400 bg-blue-50 text-blue-700':'border-gray-200 text-gray-500'}`}>🏦 CK ({formatMoney(closeBal?.transfer||0)})</button>
              <button onClick={() => setSource('cash')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 active:scale-95 ${source==='cash'?'border-amber-400 bg-amber-50 text-amber-700':'border-gray-200 text-gray-500'}`}>💵 TM ({formatMoney(closeBal?.cash||0)})</button>
            </div>
            <button onClick={() => setSource('credit')} className={`w-full mt-2 py-2.5 rounded-xl text-sm font-bold border-2 active:scale-95 ${source==='credit'?'border-pink-400 bg-pink-50 text-pink-700':'border-gray-200 text-gray-500'}`}>🎁 Hoàn tiền từ chương trình thẻ</button>
            {source==='credit' && <p className="text-[11px] text-pink-700 mt-1.5">Chỉ giảm nợ thẻ. Tiền mặt, CK và Thu Chi không đổi.</p>}
          </div>

          <div><label className="text-xs text-gray-500 mb-1 block">{source==='credit' ? 'Số tiền được hoàn' : 'Số tiền trả'}</label>
            <div className="relative"><input type="text" inputMode="numeric" value={amount?Number(amount).toLocaleString('vi-VN'):''} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" autoFocus className="w-full text-xl font-bold text-center py-3 border-2 border-gray-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div>
            {creditDebt > 0 && <button onClick={() => setAmount(String(creditDebt))} className="mt-1.5 text-xs text-purple-600 font-medium hover:underline">Trả hết ({moneyFull(creditDebt)})</button>}
            {creditDebt > 0 && Number(amount) > creditDebt && <p className="mt-1 text-xs text-amber-700">Số trả lớn hơn nợ app đang ghi — vẫn lưu được, nhớ đối soát sau.</p>}
          </div>

          <div><label className="text-xs text-gray-500 mb-1 block">Ngày</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Ghi chú</label><input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: Trả bill VISA tháng 3" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"/></div>

          {amount && Number(amount)>0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs space-y-0.5">
              {source!=='credit' && <p className="text-purple-700 font-medium">{source==='cash'?'💵 TM':'🏦 CK'}: {moneyFull(closeBal?.[source]||0)} → {moneyFull((closeBal?.[source]||0)-Number(amount))}</p>}
              <p className="text-purple-700 font-medium">💳 {card ? 'Nợ thẻ ' + card.name : 'Nợ TD'}: {moneyFull(creditDebt)} → {moneyFull(creditDebt-Number(amount))}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">{saving?'...':source==='credit'?'Ghi hoàn tiền':'Trả nợ'}</button>
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
  const [cash, setCash] = useState(''); const [transfer, setTransfer] = useState(''); const [credit, setCredit] = useState(''); const [saving, setSaving] = useState(false); const busyRef = useRef(false)   // chặn bấm đúp ngay lần chạm đầu
  useEffect(() => { if(isOpen) { setCash(String(initialBal.cash||'')); setTransfer(String(initialBal.transfer||'')); setCredit(String(initialBal.credit||'')) } }, [isOpen, initialBal])

  const handleSave = async () => {
    if (busyRef.current) return
    busyRef.current = true; setSaving(true)
    try { await saveInitialBalances(Number(cash)||0, Number(transfer)||0, Number(credit)||0, initialBal.id); toast.success('Đã lưu'); onClose(); onSaved() }
    catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false); busyRef.current = false }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Số dư ban đầu">
      <div className="space-y-4 p-5">
        <p className="text-xs text-gray-500">Nhập số dư thực tế khi bắt đầu dùng app.</p>
        <div><label className="text-xs text-gray-500 mb-1 block">💵 Tiền mặt</label><div className="relative"><input type="text" inputMode="numeric" value={cash?Number(cash).toLocaleString('vi-VN'):''} onChange={e => setCash(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full text-lg font-bold text-center py-3 border-2 border-amber-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div><label className="text-xs text-gray-500 mb-1 block">🏦 Chuyển khoản</label><div className="relative"><input type="text" inputMode="numeric" value={transfer?Number(transfer).toLocaleString('vi-VN'):''} onChange={e => setTransfer(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full text-lg font-bold text-center py-3 border-2 border-blue-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div><label className="text-xs text-gray-500 mb-1 block">💳 Nợ thẻ tín dụng hiện tại</label><div className="relative"><input type="text" inputMode="numeric" value={credit?Number(credit).toLocaleString('vi-VN'):''} onChange={e => setCredit(e.target.value.replace(/[^0-9]/g,''))} placeholder="0" className="w-full text-lg font-bold text-center py-3 border-2 border-purple-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-xs text-gray-500">Tài sản ròng ban đầu</p><p className="text-lg font-bold text-gray-800">{moneyFull((Number(cash)||0)+(Number(transfer)||0)-(Number(credit)||0))}</p></div>
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
// Icon danh mục
function CatIcon({ icon, color, size = 36, text = 'text-lg' }) {
  return (
    <div style={{ width: size, height: size, backgroundColor: (color || '#6B7280') + '20' }}
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${text}`}>
      {icon || '📦'}
    </div>
  )
}

function CategoryManager({ isOpen, onClose, categories, onChanged }) {
  const toast = useToast()
  const [showForm, setShowForm] = useState(false); const [editingCat, setEditingCat] = useState(null)
  const [fd, setFd] = useState({ name:'', icon:'📦', color:'#3B82F6', is_income:false })
  const [saving, setSaving] = useState(false); const busyRef = useRef(false)   // chặn bấm đúp ngay lần chạm đầu
  const [iconSearch, setIconSearch] = useState('')

  // Lọc nhóm icon theo từ khoá — bỏ dấu để gõ "an uong" cũng ra "Ăn uống"
  const shownGroups = useMemo(() => {
    const q = iconSearch.trim().toLowerCase()
    if (!q) return ICON_GROUPS
    const qs = stripVN(q)
    return ICON_GROUPS.filter(g => stripVN(g.label).includes(qs))
  }, [iconSearch])
  const expCats = categories.filter(c => !c.metadata?.is_income), incCats = categories.filter(c => c.metadata?.is_income===true)

  const openAdd = (isInc) => { setEditingCat(null); setFd({name:'',icon:'📦',color:'#3B82F6',is_income:isInc}); setShowForm(true) }
  const openEdit = (cat) => { setEditingCat(cat); setFd({name:cat.name,icon:cat.icon,color:cat.color,is_income:cat.metadata?.is_income||false}); setShowForm(true) }

  const handleSave = async () => {
    if(!fd.name.trim() || busyRef.current) return; busyRef.current = true; setSaving(true)
    try {
      if(editingCat) {
        await updateExpenseCategory(editingCat.id,{name:fd.name.trim(),icon:fd.icon,color:fd.color,metadata:{is_income:fd.is_income}}); toast.success('✓ Đã cập nhật')
      }
      else { await createExpenseCategory({name:fd.name.trim(),icon:fd.icon,color:fd.color,metadata:{is_income:fd.is_income},sort_order:categories.length+1}); toast.success('✓ Đã thêm') }
      setShowForm(false); onChanged()
    } catch(err) { toast.error('Lỗi: '+err.message) } finally { setSaving(false); busyRef.current = false }
  }

  const handleDel = async (cat) => {
    if(!confirm(`Xóa "${cat.name}"?`)) return
    try {
      await deleteExpenseCategory(cat.id)
      toast.success('✓ Đã xoá'); onChanged()
    } catch (err) { toast.error('✕ Không xoá được: ' + (err.message || 'lỗi không rõ')) }
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
            <CatIcon icon={cat.icon} color={cat.color} size={36}/>
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
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Icon</label>

            {/* Tìm nhanh trong 169 icon */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={iconSearch} onChange={e => setIconSearch(e.target.value)}
                placeholder="Tìm nhóm: ăn uống, nhà cửa, đi lại..."
                className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50
                  focus:outline-none focus:border-green-400"/>
              {iconSearch && (
                <button onClick={() => setIconSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5">
                  <X size={13}/>
                </button>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto pr-1 space-y-2.5">
              {shownGroups.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Không có nhóm nào khớp</p>
              ) : shownGroups.map(g => (
                <div key={g.label}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                    {g.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.icons.map(ic => (
                      <button key={ic} onClick={() => setFd({...fd, icon: ic})}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg active:scale-90
                          ${fd.icon===ic ? 'bg-green-100 ring-2 ring-green-500' : 'bg-gray-50'}`}>
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1.5 block">Màu</label><div className="flex flex-wrap gap-2">{COLORS.map(cl => <button key={cl} onClick={() => setFd({...fd,color:cl})} className={`w-9 h-9 rounded-full active:scale-90 ${fd.color===cl?'ring-2 ring-offset-2 ring-gray-400 scale-110':''}`} style={{backgroundColor:cl}}/>)}</div></div>
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
            <CatIcon icon={fd.icon} color={fd.color} size={40} text="text-xl"/>
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

// ============================================
// THẺ TÍN DỤNG & ĐỐI SOÁT
// ============================================
const CARD_COLORS = ['#7C3AED', '#2563EB', '#DC2626', '#059669', '#D97706', '#DB2777', '#0891B2', '#4B5563']
const kindLabel = k => k === 'cash' ? '💵 Tiền mặt' : k === 'transfer' ? '🏦 Chuyển khoản' : '💳 Nợ thẻ'

// Đối soát một nguồn tiền: gõ số thực tế → app ghi 1 dòng điều chỉnh cho phần chênh
function ReconcileForm({ target, cards, toast, onClose, onSaved }) {
  const [date, setDate] = useState(getLocalDateString()), [actual, setActual] = useState(''), [note, setNote] = useState('')
  const [recorded, setRecorded] = useState(null), [saving, setSaving] = useState(false); const busyRef = useRef(false)
  const card = target?.cardId ? cards.find(c => c.id === target.cardId) : null
  useEffect(() => {
    if (!target) return
    let alive = true; setRecorded(null)
    previewReconcile({ kind: target.kind, cardId: target.cardId || null, date }).then(v => { if (alive) setRecorded(Math.round(v)) }).catch(() => {})
    return () => { alive = false }
  }, [target, date])
  useEffect(() => { if (target) { setActual(''); setNote(''); setDate(getLocalDateString()) } }, [target])
  if (!target) return null
  const diff = actual === '' || recorded === null ? null : Number(actual) * (target.neg ? -1 : 1) - recorded
  const save = async () => {
    if (actual === '' || busyRef.current) return
    busyRef.current = true; setSaving(true)
    try {
      const r = await reconcile({ kind: target.kind, cardId: target.cardId || null, actual: Number(actual) * (target.neg ? -1 : 1), date, note })
      toast.success(r.diff === 0 ? 'Đã khớp — không cần điều chỉnh' : `Đã điều chỉnh ${r.diff > 0 ? '+' : ''}${moneyFull(r.diff)}`)
      onClose(); onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) } finally { setSaving(false); busyRef.current = false }
  }
  const title = target.kind === 'credit' ? `⚖️ Đối soát thẻ ${card ? card.name : '(chưa phân thẻ)'}` : `⚖️ Đối soát ${kindLabel(target.kind)}`
  return (
    <Modal isOpen={!!target} onClose={onClose} title={title}>
      <div className="space-y-4 p-5">
        <p className="text-xs text-gray-500">Mở app ngân hàng (hoặc đếm tiền mặt), gõ số thực tế. App ghi một dòng <b>điều chỉnh</b> cho phần chênh — không sửa giao dịch cũ nào.</p>
        <div><label className="text-xs text-gray-500 mb-1 block">Tính tới hết ngày</label>
          <input type="date" value={date} max={getLocalDateString()} onChange={e => e.target.value && setDate(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base"/></div>
        <div className="bg-gray-50 rounded-xl p-3 flex justify-between text-sm"><span className="text-gray-500">Theo app</span>
          <b>{recorded === null ? '…' : moneyFull(target.neg ? -recorded : recorded)}</b></div>
        <div><label className="text-xs text-gray-500 mb-1 block">{target.kind === 'credit' ? 'Dư nợ thực tế trên app ngân hàng' : 'Số dư thực tế'}</label>
          <div className="relative"><input type="text" inputMode="numeric" value={actual === '' ? '' : Number(actual).toLocaleString('vi-VN')}
            onChange={e => setActual(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" aria-label="Số thực tế"
            className="w-full text-xl font-bold text-center py-3 border-2 border-gray-200 rounded-xl"/><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">đ</span></div></div>
        {diff !== null && <div className={`rounded-xl p-3 text-sm font-medium ${diff === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>
          {diff === 0 ? '✓ Khớp — không cần điều chỉnh' : <>Chênh {diff > 0 ? '+' : ''}{moneyFull(target.neg ? -diff : diff)} → sẽ ghi 1 dòng điều chỉnh</>}</div>}
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú (tuỳ chọn), ví dụ: theo sao kê kỳ 10" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base"/>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={save} disabled={saving || actual === ''} className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold text-sm disabled:opacity-40">{saving ? '...' : 'Đối soát'}</button>
        </div>
      </div>
    </Modal>
  )
}

function CardForm({ initial, toast, onClose, onSaved }) {
  const [f, setF] = useState(initial || { name: '', last4: '', keywords: '', color: CARD_COLORS[0], credit_limit: '', statement_day: '', due_day: '' })
  const [saving, setSaving] = useState(false); const busyRef = useRef(false)
  const save = async () => {
    if (!f.name.trim()) { toast.error('Nhập tên thẻ'); return }
    if (busyRef.current) return; busyRef.current = true; setSaving(true)
    try { await saveCard(f); toast.success('Đã lưu thẻ'); onSaved() } catch (err) { toast.error('Lỗi: ' + err.message) } finally { setSaving(false); busyRef.current = false }
  }
  const inp = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-base'
  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
      <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Tên thẻ, ví dụ: VIB, VPB Mai" className={inp} aria-label="Tên thẻ"/>
      <div className="flex gap-2">
        <input value={f.last4 || ''} onChange={e => setF({ ...f, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })} inputMode="numeric" placeholder="4 số cuối" className={inp}/>
        <input value={f.credit_limit ? Number(f.credit_limit).toLocaleString('vi-VN') : ''} onChange={e => setF({ ...f, credit_limit: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="Hạn mức" className={inp}/>
      </div>
      <div className="flex gap-2">
        <input value={f.statement_day || ''} onChange={e => setF({ ...f, statement_day: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="Ngày sao kê" className={inp}/>
        <input value={f.due_day || ''} onChange={e => setF({ ...f, due_day: e.target.value.replace(/\D/g, '').slice(0, 2) })} inputMode="numeric" placeholder="Hạn thanh toán" className={inp}/>
      </div>
      <input value={f.keywords || ''} onChange={e => setF({ ...f, keywords: e.target.value })} placeholder="Từ khoá nhận diện, ví dụ: vp, 4438" className={inp}/>
      <div className="flex gap-2">{CARD_COLORS.map(c => <button key={c} onClick={() => setF({ ...f, color: c })} aria-label={'Màu ' + c}
        className="w-7 h-7 rounded-full" style={{ background: c, outline: f.color === c ? '2px solid #111' : 'none', outlineOffset: 2 }}/>)}</div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 bg-white text-gray-600 rounded-xl text-sm">Hủy</button>
        <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm disabled:opacity-50">{saving ? '...' : 'Lưu thẻ'}</button>
      </div>
    </div>
  )
}

// Bảng thẻ: nợ từng thẻ, đối soát, chốt sổ, phân thẻ cho giao dịch quên chọn thẻ
function CardsSheet({ isOpen, onClose, cards, cardDebts, toast, onSaved, onReconcile }) {
  const [edit, setEdit] = useState(null)          // null | 'new' | thẻ
  const [closing, setClosing] = useState(false), [actuals, setActuals] = useState({}), [saving, setSaving] = useState(false)
  const [cutoff, setCutoff] = useState(null), [unassigned, setUnassigned] = useState(null)
  const busyRef = useRef(false)
  const loadUn = useCallback(async () => {
    const c = await getCardCutoff().catch(() => null); setCutoff(c)
    setUnassigned(c ? await getUnassignedCredit(c).catch(() => []) : null)
  }, [])
  useEffect(() => { if (isOpen) { setEdit(null); setClosing(false); setActuals({}); loadUn() } }, [isOpen, loadUn])
  const none = Math.round(cardDebts.none || 0)
  const total = Object.values(cardDebts).reduce((a, v) => a + v, 0)
  const doClose = async () => {
    if (busyRef.current) return; busyRef.current = true; setSaving(true)
    try {
      await closeCardBooks({ actuals: Object.fromEntries(Object.entries(actuals).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])), date: getLocalDateString() })
      toast.success('Đã chốt sổ thẻ — từ nay mỗi thẻ khớp sao kê'); setClosing(false); onSaved(); loadUn()
    } catch (err) { toast.error('Lỗi: ' + err.message) } finally { setSaving(false); busyRef.current = false }
  }
  const assign = async (ids, cardId) => {
    try { await assignCard(ids, cardId); toast.success(`Đã gán ${ids.length} giao dịch`); onSaved(); loadUn() } catch (err) { toast.error('Lỗi: ' + err.message) }
  }
  const sugg = (unassigned || []).map(t => [t, suggestCard(t, cards)])
  const byCard = cards.map(c => ({ c, ids: sugg.filter(([, s]) => s?.id === c.id).map(([t]) => t.id) })).filter(x => x.ids.length)
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💳 Thẻ tín dụng">
      <div className="space-y-3 p-5">
        <div className="bg-purple-50 rounded-xl p-3 flex justify-between items-baseline"><span className="text-sm text-purple-700">Tổng nợ thẻ</span>
          <b className="text-lg text-purple-800">{moneyFull(total)}</b></div>

        {cards.map(c => { const d = Math.round(cardDebts[c.id] || 0)
          return edit && edit !== 'new' && edit.id === c.id ? <CardForm key={c.id} initial={c} toast={toast} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onSaved() }}/> : (
          <div key={c.id} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }}/>
              <button onClick={() => setEdit(c)} className="flex-1 text-left"><b className="text-sm">{c.name}</b>{c.last4 && <span className="text-xs text-gray-400"> ·{c.last4}</span>}
                {(c.statement_day || c.due_day) && <span className="block text-[11px] text-gray-400">{c.statement_day && `sao kê ngày ${c.statement_day}`}{c.statement_day && c.due_day && ' · '}{c.due_day && `hạn trả ngày ${c.due_day}`}</span>}</button>
              <b className={`text-sm ${d > 0 ? 'text-red-600' : 'text-green-600'}`}>{moneyFull(d)}</b>
            </div>
            {c.credit_limit > 0 && <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: Math.min(100, Math.max(0, d / c.credit_limit * 100)) + '%', background: c.color }}/></div>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => onReconcile({ kind: 'credit', cardId: c.id })} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-medium">⚖️ Đối soát</button>
              <button onClick={async () => { if (confirm(`Ẩn thẻ ${c.name}? Giao dịch cũ vẫn giữ nguyên.`)) { await archiveCard(c.id); onSaved() } }} className="py-2 px-3 bg-gray-50 rounded-lg text-xs text-gray-400">Ẩn</button>
            </div>
          </div>) })}

        {Math.abs(none) > 0 && <div className="border border-dashed border-amber-300 bg-amber-50 rounded-xl p-3">
          <div className="flex justify-between"><span className="text-sm text-amber-800">Chưa phân thẻ{!cutoff && ' (dữ liệu cũ)'}</span><b className="text-sm text-amber-800">{moneyFull(none)}</b></div>
          {!cutoff && <p className="text-[11px] text-amber-700 mt-1">Giao dịch cũ không ghi rõ thẻ. Thêm các thẻ rồi bấm <b>Chốt sổ</b> để bắt đầu theo dõi từng thẻ đúng với sao kê.</p>}
        </div>}

        {edit === 'new' ? <CardForm toast={toast} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onSaved() }}/>
          : <button onClick={() => setEdit('new')} className="w-full py-2.5 border-2 border-dashed border-purple-200 text-purple-700 rounded-xl text-sm font-medium">+ Thêm thẻ</button>}

        {cards.length > 0 && !closing && <button onClick={() => setClosing(true)} className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-bold">📒 {cutoff ? 'Chốt sổ lại' : 'Chốt sổ thẻ — bắt đầu theo dõi từng thẻ'}</button>}
        {closing && <div className="bg-purple-50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-purple-800">Mở app từng ngân hàng, gõ <b>dư nợ hiện tại</b> của mỗi thẻ. Thẻ nào để trống thì giữ nguyên. Phần "chưa phân thẻ" sẽ về 0. Không giao dịch cũ nào bị sửa.</p>
          {cards.map(c => <div key={c.id} className="flex items-center gap-2"><span className="w-20 text-sm font-medium truncate">{c.name}</span>
            <input inputMode="numeric" value={actuals[c.id] ? Number(actuals[c.id]).toLocaleString('vi-VN') : ''} onChange={e => setActuals({ ...actuals, [c.id]: e.target.value.replace(/\D/g, '') })}
              placeholder="Dư nợ thực tế" aria-label={'Dư nợ ' + c.name} className="flex-1 min-w-0 px-3 py-2 border border-purple-200 rounded-lg text-base text-right"/></div>)}
          <div className="flex justify-between text-sm pt-1"><span className="text-purple-700">Tổng nợ sau chốt sổ</span>
            <b>{moneyFull(cards.reduce((a, c) => a + (actuals[c.id] !== undefined && actuals[c.id] !== '' ? Number(actuals[c.id]) : Math.round(cardDebts[c.id] || 0)), 0))}</b></div>
          <div className="flex gap-2"><button onClick={() => setClosing(false)} className="flex-1 py-2.5 bg-white rounded-xl text-sm">Hủy</button>
            <button onClick={doClose} disabled={saving} className="flex-1 py-2.5 bg-purple-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">{saving ? '...' : 'Chốt sổ'}</button></div>
        </div>}

        {cutoff && unassigned && unassigned.length > 0 && <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">⚠️ {unassigned.length} giao dịch thẻ từ {cutoff.split('-').reverse().join('/')} chưa chọn thẻ</p>
          {byCard.map(({ c, ids }) => <button key={c.id} onClick={() => assign(ids, c.id)} className="w-full mb-1.5 py-2 bg-purple-50 text-purple-800 rounded-lg text-xs font-medium">Gán {ids.length} giao dịch nhắc tới "{c.name}" vào thẻ {c.name}</button>)}
          {sugg.slice(0, 30).map(([t, s]) => <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 text-xs">
            <span className="flex-1 min-w-0 truncate">{t.date.slice(8)}/{t.date.slice(5, 7)} · {t.note || t.category?.name || (t.type === 'pay_credit' ? 'Trả thẻ' : 'Quẹt thẻ')}</span>
            <b>{formatMoney(t.amount)}</b>
            <select value="" onChange={e => e.target.value && assign([t.id], e.target.value)} className="text-xs border rounded px-1 py-1 bg-white" aria-label="Chọn thẻ">
              <option value="">{s ? `→ ${s.name}?` : 'Thẻ…'}</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>)}
        </div>}
      </div>
    </Modal>
  )
}

// ============================================
// 🩺 SỨC KHOẺ SỔ — mỗi tài khoản một dòng ✓/⚠, kèm nút xử lý
// ============================================
function HealthSheet({ isOpen, onClose, cards, reconLast, toast, onSaved, onReconcile, onOpenCards }) {
  const [h, setH] = useState(null), [showMis, setShowMis] = useState(false), [pick, setPick] = useState({}), [busy, setBusy] = useState(false)
  const load = useCallback(() => { getHealth(cards).then(setH).catch(e => toast.error('Lỗi: ' + e.message)) }, [cards])   // eslint-disable-line react-hooks/exhaustive-deps -- toast cố định; thêm vào có thể gây tải lặp
  useEffect(() => { if (isOpen) { setH(null); setShowMis(false); setPick({}) } }, [isOpen])   // chỉ gập lại khi MỞ màn này
  useEffect(() => { if (isOpen) load() }, [isOpen, load])                         // tải lại số liệu, giữ nguyên chỗ đang xem
  const dmy = s => s ? s.split('-').reverse().join('/') : ''
  const icon = k => k === 'cash' ? '💵' : k === 'transfer' ? '🏦' : '💳'
  const name = a => a.key === 'cash' ? 'Tiền mặt' : a.key === 'transfer' ? 'Chuyển khoản' : 'Thẻ ' + a.card.name
  const convert = async (t) => {
    const cardId = pick[t.id] ?? (suggestCard(t, cards)?.id || '')
    const ws = backdateWarnings({ type: 'pay_credit', payment_method: t.payment_method, card_id: cardId || null, date: t.date }, reconLast, cards)
    if (ws.length && !confirm(warnText(ws))) return
    setBusy(true)
    try { await convertToPayCredit(t.id, cardId || null); toast.success('Đã chuyển thành trả thẻ'); onSaved(); load() } catch (e) { toast.error('Lỗi: ' + e.message) } finally { setBusy(false) }
  }
  const keep = async (t) => { setBusy(true); try { await keepAsExpense([t.id]); load() } catch (e) { toast.error('Lỗi: ' + e.message) } finally { setBusy(false) } }
  const issues = h ? h.accounts.filter(a => !a.last || a.backdated.length || a.statementDue).length + (h.unassigned ? 1 : 0) + (h.misrecorded.length ? 1 : 0) : 0
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🩺 Sức khoẻ sổ">
      <div className="p-5 space-y-2">
        {!h ? <p className="text-center text-sm text-gray-400 py-6">Đang kiểm tra…</p> : <>
          <p className={`text-sm font-semibold rounded-xl px-3 py-2 ${issues ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>{issues ? `${issues} việc nên xử lý` : '✓ Sổ khoẻ — mọi tài khoản đã đối soát, không có gì bất thường'}</p>
          {h.accounts.map(a => {
            const bad = !a.last || a.backdated.length || a.statementDue
            const why = !a.last ? 'Chưa đối soát lần nào' : a.backdated.length ? `${a.backdated.length} khoản ghi lùi ngày sau lần đối soát ${dmy(a.last.date)}` : a.statementDue ? `Đã tới kỳ sao kê ${dmy(a.statementDate)} — nên đối soát` : `Đối soát ${dmy(a.last.date)}`
            return (
              <div key={a.key} className="flex items-center gap-2.5 py-2 border-b border-gray-50">
                <span className="text-lg">{icon(a.key)}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-800">{name(a)}</p>
                  <p className={`text-xs ${bad ? 'text-amber-700' : 'text-gray-400'}`}>{bad ? '⚠ ' : '✓ '}{why}</p></div>
                <button onClick={() => onReconcile({ kind: a.key.startsWith('card:') ? 'credit' : a.key, cardId: a.card?.id || null })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${bad ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>Đối soát</button>
              </div>)
          })}
          {h.unassigned > 0 && <button onClick={onOpenCards} className="w-full flex items-center gap-2.5 py-2.5 border-b border-gray-50 text-left">
            <span className="text-lg">🏷️</span><span className="flex-1 text-sm text-amber-700">⚠ {h.unassigned} giao dịch thẻ chưa chọn thẻ</span><span className="text-gray-300">›</span></button>}
          {h.misrecorded.length > 0 && <>
            <button onClick={() => setShowMis(!showMis)} className="w-full flex items-center gap-2.5 py-2.5 text-left">
              <span className="text-lg">🔁</span><span className="flex-1 text-sm text-amber-700">⚠ {h.misrecorded.length} khoản giống trả thẻ nhưng đang ghi là Chi</span><span className="text-gray-300">{showMis ? '▴' : '▾'}</span></button>
            {showMis && <div className="bg-gray-50 rounded-xl p-2.5 space-y-2">
              <p className="text-[11px] text-gray-500">Chuyển thành <b>Trả nợ thẻ</b>: tiền mặt/CK giữ nguyên, nợ thẻ giảm, và không còn bị tính vào Chi. Nên làm <b>trước khi chốt sổ</b>.</p>
              {h.misrecorded.map(t => { const s = suggestCard(t, cards)
                return (
                  <div key={t.id} className="bg-white rounded-lg p-2">
                    <div className="flex justify-between text-xs"><span className="truncate">{dmy(t.date)} · {t.note || t.category?.name}</span><b>{formatMoney(t.amount)}</b></div>
                    <div className="flex gap-1.5 mt-1.5">
                      <select value={pick[t.id] ?? (s?.id || '')} onChange={e => setPick({ ...pick, [t.id]: e.target.value })} aria-label="Thẻ" className="flex-1 min-w-0 text-xs border rounded-lg px-1.5 py-1.5 bg-white">
                        <option value="">Chưa rõ thẻ</option>{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                      <button disabled={busy} onClick={() => convert(t)} className="px-2.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">→ Trả thẻ</button>
                      <button disabled={busy} onClick={() => keep(t)} className="px-2.5 py-1.5 bg-gray-100 rounded-lg text-xs disabled:opacity-50">Giữ là Chi</button>
                    </div>
                  </div>)
              })}
            </div>}
          </>}
        </>}
      </div>
    </Modal>
  )
}
