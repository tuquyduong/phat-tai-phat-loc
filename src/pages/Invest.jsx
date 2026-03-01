// ============================================
// INVEST - MODULE ĐẦU TƯ
// Average Cost (giá vốn bình quân)
// Sửa/xóa GD → tự tính lại toàn bộ
// Mobile-first, iOS safe area
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  RefreshCw, Plus, Trash2, Edit2, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, DollarSign, Search, X, BarChart3
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { formatMoney } from '../lib/helpers'
import {
  getStocks, createStock, updateStock, deleteStock,
  addStockTransaction, updateStockTransaction, deleteStockTransaction,
  addDividend, deleteDividend,
  calcStockStats, calcPortfolioStats, recalcStock
} from '../lib/invest'

// ============================================
// HELPERS
// ============================================
const fmtPrice = (v) => {
  const n = Number(v) || 0
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'tr'
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'
  return n.toLocaleString('vi-VN')
}
const fmtPercent = (v) => {
  const n = Number(v) || 0
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
const plColor = (v) => Number(v) >= 0 ? 'text-green-600' : 'text-red-600'
const plBg = (v) => Number(v) >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
const fmtDate = (d) => d ? d.split('-').reverse().join('/') : ''

// ============================================
// MAIN
// ============================================
export default function Invest() {
  const toast = useToast()
  const toastRef = useRef(toast); toastRef.current = toast

  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [showAddStock, setShowAddStock] = useState(false)
  const [showTxForm, setShowTxForm] = useState(null) // { stockId, type, editTx? }
  const [editingStock, setEditingStock] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try { setStocks(await getStocks()) }
    catch (err) { console.error(err); toastRef.current.error('Lỗi tải dữ liệu') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const portfolio = useMemo(() => calcPortfolioStats(stocks), [stocks])

  const filtered = useMemo(() => {
    if (!search) return portfolio.stocks
    const s = search.toLowerCase()
    return portfolio.stocks.filter(st =>
      st.symbol.toLowerCase().includes(s) || st.name?.toLowerCase().includes(s)
    )
  }, [portfolio.stocks, search])

  const activeStocks = filtered.filter(s => s.stats.holdingQty > 0)
  const closedStocks = filtered.filter(s => s.stats.holdingQty === 0)

  const handleDeleteStock = async (s) => {
    if (!confirm(`Xóa "${s.symbol}"? Tất cả giao dịch sẽ bị ẩn.`)) return
    try { await deleteStock(s.id); toast.success('Đã xóa'); loadData() }
    catch { toast.error('Lỗi') }
  }

  const handleUpdatePrice = async (s) => {
    const price = prompt(`Cập nhật giá ${s.symbol}:`, s.current_price || '')
    if (price === null) return
    const num = Number(price)
    if (isNaN(num) || num < 0) { toast.error('Giá không hợp lệ'); return }
    try { await updateStock(s.id, { current_price: num }); toast.success('Đã cập nhật giá'); loadData() }
    catch { toast.error('Lỗi') }
  }

  const handleDeleteTx = async (txId) => {
    if (!confirm('Xóa giao dịch này? Giá vốn TB sẽ được tính lại.')) return
    try { await deleteStockTransaction(txId); toast.success('Đã xóa, đã tính lại giá vốn'); loadData() }
    catch { toast.error('Lỗi') }
  }

  const handleDeleteDiv = async (divId) => {
    if (!confirm('Xóa cổ tức này?')) return
    try { await deleteDividend(divId); toast.success('Đã xóa'); loadData() }
    catch { toast.error('Lỗi') }
  }

  return (
    <div className="pb-4">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">📈 Đầu tư</h2>
          <button onClick={loadData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4">
        {/* PORTFOLIO SUMMARY */}
        <div className="mt-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-white">
          <p className="text-xs text-amber-100 font-medium">Tổng giá trị danh mục</p>
          <p className="text-2xl font-bold mt-0.5">{formatMoney(portfolio.totalMarketValue)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-sm font-bold ${portfolio.totalPL >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {portfolio.totalPL >= 0 ? '▲' : '▼'} {formatMoney(Math.abs(portfolio.totalPL))}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${portfolio.totalPL >= 0 ? 'bg-green-600/30' : 'bg-red-600/30'}`}>
              {fmtPercent(portfolio.totalPLPercent)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniStat label="Vốn đang giữ" value={formatMoney(portfolio.totalInvested)} />
            <MiniStat label="Đã chốt" value={formatMoney(portfolio.totalRealized)} color={plColor(portfolio.totalRealized)} />
            <MiniStat label="Cổ tức" value={formatMoney(portfolio.totalDividends)} />
          </div>
        </div>

        {/* SEARCH */}
        {stocks.length > 0 && (
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã CP..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={16} /></button>}
          </div>
        )}

        {/* STOCK LIST */}
        {loading ? (
          <div className="space-y-3 mt-3">{[1,2,3].map(i =>
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          )}</div>
        ) : stocks.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center mt-4">
            <div className="text-4xl mb-2">📈</div>
            <p className="text-gray-500 text-sm">Chưa có cổ phiếu nào</p>
            <button onClick={() => setShowAddStock(true)}
              className="mt-3 text-amber-600 font-medium text-sm">+ Thêm cổ phiếu đầu tiên</button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {activeStocks.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 mt-2 mb-1">ĐANG GIỮ ({activeStocks.length})</p>
                {activeStocks.map(s => (
                  <StockCard key={s.id} stock={s} isExpanded={expandedId === s.id}
                    onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    onBuy={() => setShowTxForm({ stockId: s.id, type: 'buy' })}
                    onSell={() => setShowTxForm({ stockId: s.id, type: 'sell' })}
                    onDividend={() => setShowTxForm({ stockId: s.id, type: 'dividend' })}
                    onEditTx={(tx) => setShowTxForm({ stockId: s.id, type: tx.type, editTx: tx })}
                    onUpdatePrice={() => handleUpdatePrice(s)}
                    onEdit={() => { setEditingStock(s); setShowAddStock(true) }}
                    onDelete={() => handleDeleteStock(s)}
                    onDeleteTx={handleDeleteTx}
                    onDeleteDiv={handleDeleteDiv}
                    toast={toast} />
                ))}
              </>
            )}
            {closedStocks.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 mt-4 mb-1">ĐÃ BÁN HẾT ({closedStocks.length})</p>
                {closedStocks.map(s => (
                  <StockCard key={s.id} stock={s} isExpanded={expandedId === s.id}
                    onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    onBuy={() => setShowTxForm({ stockId: s.id, type: 'buy' })}
                    onSell={() => {}}
                    onDividend={() => setShowTxForm({ stockId: s.id, type: 'dividend' })}
                    onEditTx={(tx) => setShowTxForm({ stockId: s.id, type: tx.type, editTx: tx })}
                    onUpdatePrice={() => handleUpdatePrice(s)}
                    onEdit={() => { setEditingStock(s); setShowAddStock(true) }}
                    onDelete={() => handleDeleteStock(s)}
                    onDeleteTx={handleDeleteTx}
                    onDeleteDiv={handleDeleteDiv}
                    toast={toast} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => { setEditingStock(null); setShowAddStock(true) }}
        className="fixed right-4 w-12 h-12 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
        <Plus size={24} />
      </button>

      {/* Modals */}
      <StockForm isOpen={showAddStock} onClose={() => { setShowAddStock(false); setEditingStock(null) }}
        stock={editingStock} toast={toast} onSaved={loadData} />

      <TxForm isOpen={!!showTxForm} onClose={() => setShowTxForm(null)}
        config={showTxForm} stocks={stocks} toast={toast} onSaved={loadData} />
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-white/15 rounded-lg p-2 text-center">
      <p className="text-[10px] text-amber-200">{label}</p>
      <p className={`text-xs font-bold ${color || ''}`}>{value}</p>
    </div>
  )
}

// ============================================
// STOCK CARD
// ============================================
function StockCard({ stock, isExpanded, onToggle, onBuy, onSell, onDividend, onEditTx, onUpdatePrice, onEdit, onDelete, onDeleteTx, onDeleteDiv, toast }) {
  const s = stock.stats
  const divs = (stock.dividends || []).sort((a, b) => b.date.localeCompare(a.date))

  // Tách GD mua / bán từ txDetails (đã sắp xếp theo thời gian)
  const buyTxs = (s.txDetails || []).filter(t => t.txType === 'buy').reverse()
  const sellTxs = (s.txDetails || []).filter(t => t.txType === 'sell').reverse()

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header - always visible */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{stock.symbol}</span>
            {stock.name && <span className="text-xs text-gray-400 truncate">{stock.name}</span>}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {s.holdingQty > 0 ? (
              <>
                <span>{s.holdingQty.toLocaleString()} cp</span>
                <span>·</span>
                <span>Vốn: {fmtPrice(s.avgCost)}</span>
                <span>·</span>
                <span>Giá: {fmtPrice(s.currentPrice)}</span>
              </>
            ) : (
              <span className="text-gray-400">Đã bán hết</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {s.holdingQty > 0 ? (
            <>
              <p className="text-sm font-bold text-gray-800">{formatMoney(s.marketValue)}</p>
              <p className={`text-xs font-bold ${plColor(s.unrealizedPL)}`}>
                {s.unrealizedPL >= 0 ? '+' : ''}{formatMoney(s.unrealizedPL)}
                <span className="ml-1">({fmtPercent(s.unrealizedPLPct)})</span>
              </p>
            </>
          ) : (
            <p className={`text-xs font-bold ${plColor(s.totalPL)}`}>
              {s.totalPL >= 0 ? '+' : ''}{formatMoney(s.totalPL)}
            </p>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Giá vốn TB" value={fmtPrice(s.avgCost)} sub="(gồm phí)" />
            <StatBox label="Giá hiện tại" value={fmtPrice(s.currentPrice)} />
            <StatBox label="Đang giữ" value={`${s.holdingQty.toLocaleString()} cp`} />
            <StatBox label="Giá trị" value={formatMoney(s.marketValue)} />
            <StatBox label="Lãi/lỗ chưa chốt" value={`${s.unrealizedPL >= 0 ? '+' : ''}${formatMoney(s.unrealizedPL)}`} className={plColor(s.unrealizedPL)} />
            <StatBox label="Lãi/lỗ đã chốt" value={`${s.realizedPL >= 0 ? '+' : ''}${formatMoney(s.realizedPL)}`} className={plColor(s.realizedPL)} />
            <StatBox label="Cổ tức" value={formatMoney(s.totalDividends)} className="text-amber-600" />
            <StatBox label="Tổng phí GD" value={formatMoney(s.totalFee)} />
          </div>

          {/* Tổng kết */}
          <div className={`border rounded-lg p-2.5 flex items-center justify-between ${plBg(s.totalPL)}`}>
            <span className="text-xs text-gray-600 font-medium">Tổng lãi/lỗ</span>
            <span className={`text-sm font-bold ${plColor(s.totalPL)}`}>
              {s.totalPL >= 0 ? '+' : ''}{formatMoney(s.totalPL)}
              {s.totalInvested > 0 && (
                <span className="text-xs ml-1">({fmtPercent(s.totalPL / s.totalInvested * 100)})</span>
              )}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5 flex-wrap">
            <ActionBtn icon={<TrendingUp size={14} />} label="Mua" bg="bg-green-50 text-green-600 border border-green-200" onClick={onBuy} />
            {s.holdingQty > 0 && <ActionBtn icon={<TrendingDown size={14} />} label="Bán" bg="bg-red-50 text-red-600 border border-red-200" onClick={onSell} />}
            <ActionBtn icon={<DollarSign size={14} />} label="Cổ tức" bg="bg-amber-50 text-amber-600 border border-amber-200" onClick={onDividend} />
            <ActionBtn icon={<BarChart3 size={14} />} label="Cập nhật giá" bg="bg-blue-50 text-blue-600 border border-blue-200" onClick={onUpdatePrice} />
            <div className="ml-auto flex gap-1">
              <button onClick={onEdit} className="p-2 text-gray-400 hover:text-purple-500 active:scale-90"><Edit2 size={14} /></button>
              <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 active:scale-90"><Trash2 size={14} /></button>
            </div>
          </div>

          {/* LỆNH MUA */}
          {buyTxs.length > 0 && (
            <TxSection title="Lệnh mua" count={buyTxs.length} color="green">
              {buyTxs.map(tx => {
                const plVsCurrent = tx.quantity * (s.currentPrice - Number(tx.price))
                const plPctVsCurrent = Number(tx.price) > 0 ? ((s.currentPrice - Number(tx.price)) / Number(tx.price)) * 100 : 0
                return (
                  <TxRow key={tx.id} color="green"
                    date={fmtDate(tx.date)}
                    main={`${tx.quantity.toLocaleString()} cp × ${fmtPrice(tx.price)}`}
                    total={formatMoney(tx.quantity * Number(tx.price))}
                    fee={Number(tx.fee) || 0}
                    sub={s.holdingQty > 0 ? (
                      <span className={plColor(plVsCurrent)}>
                        Hiện: {plVsCurrent >= 0 ? '+' : ''}{formatMoney(plVsCurrent)} ({fmtPercent(plPctVsCurrent)})
                      </span>
                    ) : null}
                    subExtra={<span className="text-gray-400">→ Vốn TB: {fmtPrice(tx.avgCostAfter)}</span>}
                    note={tx.note}
                    onEdit={() => onEditTx(tx)}
                    onDelete={() => onDeleteTx(tx.id)}
                  />
                )
              })}
            </TxSection>
          )}

          {/* LỆNH BÁN */}
          {sellTxs.length > 0 && (
            <TxSection title="Lệnh bán" count={sellTxs.length} color="red">
              {sellTxs.map(tx => (
                <TxRow key={tx.id} color="red"
                  date={fmtDate(tx.date)}
                  main={`${tx.quantity.toLocaleString()} cp × ${fmtPrice(tx.price)}`}
                  total={formatMoney(tx.quantity * Number(tx.price))}
                  fee={Number(tx.fee) || 0}
                  sub={
                    <span className={`font-bold ${plColor(tx.pl)}`}>
                      L/L: {tx.pl >= 0 ? '+' : ''}{formatMoney(tx.pl)} ({fmtPercent(tx.plPct)})
                    </span>
                  }
                  subExtra={<span className="text-gray-400">Vốn tại lúc bán: {fmtPrice(tx.avgCostAtSell)}</span>}
                  note={tx.note}
                  onEdit={() => onEditTx(tx)}
                  onDelete={() => onDeleteTx(tx.id)}
                />
              ))}
            </TxSection>
          )}

          {/* CỔ TỨC */}
          {divs.length > 0 && (
            <TxSection title="Cổ tức" count={divs.length} color="amber">
              {divs.map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs py-2 px-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-amber-500">💰</span>
                    <span className="text-gray-500">{fmtDate(d.date)}</span>
                    {d.note && <span className="text-gray-400">{d.note}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-bold text-amber-600">+{formatMoney(d.amount)}</span>
                    <button onClick={() => onDeleteDiv(d.id)}
                      className="p-1 text-gray-300 hover:text-red-500 active:scale-90"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </TxSection>
          )}

          {/* Note */}
          {stock.note && <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">📝 {stock.note}</p>}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, sub, className = 'text-gray-800' }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2">
      <p className="text-[10px] text-gray-400 leading-tight">{label} {sub && <span>{sub}</span>}</p>
      <p className={`text-xs font-bold mt-0.5 ${className}`}>{value}</p>
    </div>
  )
}

function ActionBtn({ icon, label, bg, onClick }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium active:scale-95 ${bg}`}>
      {icon} {label}
    </button>
  )
}

function TxSection({ title, count, color, children }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 mb-1.5">{title} ({count})</p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">{children}</div>
    </div>
  )
}

function TxRow({ color, date, main, total, fee, sub, subExtra, note, onEdit, onDelete }) {
  const bg = color === 'green' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
  const badge = color === 'green' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  const badgeLabel = color === 'green' ? 'MUA' : 'BÁN'
  return (
    <div className={`text-xs py-2.5 px-3 border rounded-lg ${bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${badge}`}>{badgeLabel}</span>
          <span className="text-gray-500">{date}</span>
          <span className="text-gray-700 font-medium">{main}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          <button onClick={onEdit} className="p-1 text-gray-300 hover:text-blue-500 active:scale-90"><Edit2 size={12} /></button>
          <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-500 active:scale-90"><Trash2 size={12} /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <span className="text-gray-500">GT: {total}</span>
        {fee > 0 && <span className="text-gray-400">Phí: {fmtPrice(fee)}</span>}
        {sub}
      </div>
      {subExtra && <div className="mt-0.5">{subExtra}</div>}
      {note && <p className="text-gray-400 mt-0.5">📝 {note}</p>}
    </div>
  )
}

// ============================================
// STOCK FORM (Add/Edit CP + optional first buy)
// ============================================
function StockForm({ isOpen, onClose, stock, toast, onSaved }) {
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [note, setNote] = useState('')
  const [buyQty, setBuyQty] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyFee, setBuyFee] = useState('')
  const [buyDate, setBuyDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const isEdit = !!stock

  useEffect(() => {
    if (isOpen) {
      if (stock) {
        setSymbol(stock.symbol); setName(stock.name || '')
        setCurrentPrice(String(stock.current_price || '')); setNote(stock.note || '')
      } else {
        setSymbol(''); setName(''); setCurrentPrice(''); setNote('')
        setBuyQty(''); setBuyPrice(''); setBuyFee('')
        setBuyDate(new Date().toISOString().split('T')[0])
      }
    }
  }, [isOpen, stock])

  useEffect(() => {
    if (!isEdit && buyPrice && !currentPrice) setCurrentPrice(buyPrice)
  }, [buyPrice, isEdit, currentPrice])

  const handleSave = async () => {
    if (!symbol.trim()) { toast.error('Nhập mã CP'); return }
    const hasBuy = buyQty && buyPrice
    if (!isEdit && (buyQty || buyPrice)) {
      if (!buyQty || Number(buyQty) <= 0) { toast.error('Nhập số lượng mua'); return }
      if (!buyPrice || Number(buyPrice) <= 0) { toast.error('Nhập giá mua'); return }
    }

    setSaving(true)
    try {
      if (stock) {
        await updateStock(stock.id, { symbol: symbol.toUpperCase().trim(), name, current_price: Number(currentPrice) || 0, note })
        toast.success('Đã cập nhật')
      } else {
        const created = await createStock({
          symbol: symbol.trim(), name,
          current_price: Number(currentPrice) || Number(buyPrice) || 0, note
        })
        if (hasBuy) {
          await addStockTransaction({
            stock_id: created.id, type: 'buy',
            quantity: Number(buyQty), price: Number(buyPrice),
            fee: Number(buyFee) || 0, date: buyDate, note: 'Mua lần đầu'
          })
        }
        toast.success('Đã thêm ' + symbol.toUpperCase())
      }
      onClose(); onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={stock ? 'Sửa cổ phiếu' : '📈 Thêm cổ phiếu'}>
      <div className="space-y-3 p-5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Mã CP *</label>
            <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="VNM" autoFocus maxLength={10}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold uppercase" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Giá hiện tại</label>
            <input type="number" inputMode="numeric" value={currentPrice}
              onChange={e => setCurrentPrice(e.target.value)} placeholder="0"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tên công ty</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Vinamilk..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {!isEdit && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-bold text-green-700">🟢 Mua lần đầu (tùy chọn)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Số lượng (cp)</label>
                <input type="number" inputMode="numeric" value={buyQty}
                  onChange={e => setBuyQty(e.target.value)} placeholder="100"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Giá mua (đ)</label>
                <input type="number" inputMode="numeric" value={buyPrice}
                  onChange={e => setBuyPrice(e.target.value)} placeholder="18900"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Phí GD (đ)</label>
                <input type="number" inputMode="numeric" value={buyFee}
                  onChange={e => setBuyFee(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-0.5 block">Ngày mua</label>
                <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              </div>
            </div>
            {buyQty && buyPrice && (
              <div className="flex justify-between text-xs pt-1 border-t border-green-200">
                <span className="text-green-700">Tổng tiền:</span>
                <span className="font-bold text-green-800">{formatMoney((Number(buyQty) * Number(buyPrice)) + (Number(buyFee) || 0))}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving || !symbol.trim()}
            className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">
            {saving ? '...' : (stock ? 'Cập nhật' : (buyQty && buyPrice ? 'Thêm & Mua' : 'Thêm'))}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// TX FORM (Buy/Sell/Dividend + Edit mode)
// ============================================
function TxForm({ isOpen, onClose, config, stocks, toast, onSaved }) {
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [fee, setFee] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const stock = config ? stocks.find(s => s.id === config.stockId) : null
  const type = config?.type || 'buy'
  const editTx = config?.editTx || null
  const isEdit = !!editTx
  const isDividend = type === 'dividend'
  const stats = stock ? calcStockStats(stock) : null

  useEffect(() => {
    if (isOpen) {
      if (editTx) {
        setQuantity(String(editTx.quantity))
        setPrice(String(editTx.price))
        setFee(String(editTx.fee || 0))
        setDate(editTx.date || new Date().toISOString().split('T')[0])
        setNote(editTx.note || '')
      } else {
        setQuantity(''); setFee(''); setNote('')
        setPrice(isDividend ? '' : String(stock?.current_price || ''))
        setDate(new Date().toISOString().split('T')[0])
      }
    }
  }, [isOpen, stock, isDividend, editTx])

  const qtyPresets = [100, 200, 500, 1000]

  const handleSave = async () => {
    if (isDividend) {
      if (!price || Number(price) <= 0) { toast.error('Nhập số tiền cổ tức'); return }
      setSaving(true)
      try {
        await addDividend({ stock_id: stock.id, amount: Number(price), date, note })
        toast.success('Đã ghi cổ tức')
        onClose(); onSaved()
      } catch (err) { toast.error('Lỗi: ' + err.message) }
      finally { setSaving(false) }
      return
    }

    if (!quantity || Number(quantity) <= 0 || !price || Number(price) <= 0) {
      toast.error('Nhập đầy đủ số lượng và giá'); return
    }
    // Check sell > holding (trừ edit case - trừ số lượng cũ)
    if (type === 'sell' && stats) {
      const available = stats.holdingQty + (isEdit && editTx.type === 'sell' ? editTx.quantity : 0)
      if (Number(quantity) > available) {
        toast.error(`Chỉ đang giữ ${available.toLocaleString()} cp!`); return
      }
    }

    setSaving(true)
    try {
      if (isEdit) {
        await updateStockTransaction(editTx.id, {
          quantity: Number(quantity), price: Number(price),
          fee: Number(fee) || 0, date, note
        })
        toast.success('Đã sửa, giá vốn TB đã tính lại')
      } else {
        await addStockTransaction({
          stock_id: stock.id, type,
          quantity: Number(quantity), price: Number(price),
          fee: Number(fee) || 0, date, note
        })
        toast.success(type === 'buy' ? 'Đã mua' : 'Đã bán')
      }
      onClose(); onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const titles = {
    buy: isEdit ? `✏️ Sửa lệnh mua ${stock?.symbol || ''}` : `🟢 Mua ${stock?.symbol || ''}`,
    sell: isEdit ? `✏️ Sửa lệnh bán ${stock?.symbol || ''}` : `🔴 Bán ${stock?.symbol || ''}`,
    dividend: `💰 Cổ tức ${stock?.symbol || ''}`
  }
  const btnColors = { buy: 'bg-green-500', sell: 'bg-red-500', dividend: 'bg-amber-500' }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titles[type] || ''}>
      <div className="space-y-3 p-5">
        {/* Stock info */}
        {stock && stats && !isDividend && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
            <span>Đang giữ: <b className="text-gray-800">{stats.holdingQty.toLocaleString()} cp</b></span>
            <span>Giá vốn TB: <b>{fmtPrice(stats.avgCost)}</b></span>
            <span>Giá hiện tại: <b>{fmtPrice(stats.currentPrice)}</b></span>
          </div>
        )}

        {!isDividend && (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Số lượng (cp)</label>
              <input type="number" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder="0" autoFocus className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
              <div className="flex gap-1.5 mt-1.5">
                {qtyPresets.map(q => (
                  <button key={q} onClick={() => setQuantity(String(q))}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      String(q) === quantity ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200'
                    }`}>{q}</button>
                ))}
              </div>
            </div>

            {type === 'sell' && stats && stats.holdingQty > 0 && !isEdit && (
              <button onClick={() => setQuantity(String(stats.holdingQty))}
                className="text-xs text-red-500 font-medium hover:underline">
                Bán hết ({stats.holdingQty.toLocaleString()} cp)
              </button>
            )}
          </>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">{isDividend ? 'Số tiền cổ tức (đ)' : 'Giá/cp (đ)'}</label>
          <input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
            placeholder="0" autoFocus={isDividend}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {!isDividend && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Phí giao dịch (đ)</label>
            <input type="number" inputMode="numeric" value={fee} onChange={e => setFee(e.target.value)}
              placeholder="0" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ngày</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>

        {/* Summary */}
        {!isDividend && quantity && price && (
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Giá trị:</span>
              <span className="text-gray-700">{formatMoney(Number(quantity) * Number(price))}</span>
            </div>
            {Number(fee) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Phí:</span>
                <span className="text-gray-700">{formatMoney(Number(fee))}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1">
              <span className="text-gray-700">{type === 'sell' ? 'Thu về:' : 'Tổng chi:'}</span>
              <span className="text-gray-800">
                {formatMoney(type === 'sell'
                  ? Number(quantity) * Number(price) - (Number(fee) || 0)
                  : Number(quantity) * Number(price) + (Number(fee) || 0)
                )}
              </span>
            </div>
            {type === 'sell' && stats && stats.avgCost > 0 && (
              <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                <span className="text-gray-500">Lãi/lỗ ước tính:</span>
                {(() => {
                  const pl = Number(quantity) * (Number(price) - stats.avgCost) - (Number(fee) || 0)
                  return <span className={`font-bold ${plColor(pl)}`}>{pl >= 0 ? '+' : ''}{formatMoney(pl)}</span>
                })()}
              </div>
            )}
            {type === 'buy' && stats && (
              <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                <span className="text-gray-500">Vốn TB mới:</span>
                <span className="font-medium text-gray-700">
                  {(() => {
                    const newCost = stats.investedInHolding + Number(quantity) * Number(price) + (Number(fee) || 0)
                    const newQty = stats.holdingQty + Number(quantity)
                    return fmtPrice(newQty > 0 ? newCost / newQty : 0)
                  })()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className={`flex-1 py-3 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98 ${btnColors[type]}`}>
            {saving ? '...' : (isEdit ? 'Lưu thay đổi' : isDividend ? 'Ghi nhận' : type === 'buy' ? 'Mua' : 'Bán')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
