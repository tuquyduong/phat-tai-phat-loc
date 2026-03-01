// ============================================
// INVEST - MODULE ĐẦU TƯ (Phase 3)
// Mobile-first, touch-friendly
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
  addStockTransaction, deleteStockTransaction,
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
  const [showTxForm, setShowTxForm] = useState(null) // { stockId, type: 'buy'|'sell'|'dividend' }
  const [editingStock, setEditingStock] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getStocks()
      setStocks(data)
    } catch (err) {
      console.error(err)
      toastRef.current.error('Lỗi tải dữ liệu')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Portfolio stats
  const portfolio = useMemo(() => calcPortfolioStats(stocks), [stocks])

  // Filter
  const filtered = useMemo(() => {
    if (!search) return portfolio.stocks
    const s = search.toLowerCase()
    return portfolio.stocks.filter(st => st.symbol.toLowerCase().includes(s) || st.name?.toLowerCase().includes(s))
  }, [portfolio.stocks, search])

  // Active stocks (đang giữ) vs closed
  const activeStocks = filtered.filter(s => s.stats.holdingQty > 0)
  const closedStocks = filtered.filter(s => s.stats.holdingQty === 0)

  // Handlers
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

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <p className="text-[10px] text-amber-200">Vốn đầu tư</p>
              <p className="text-xs font-bold">{formatMoney(portfolio.totalInvested)}</p>
            </div>
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <p className="text-[10px] text-amber-200">Đã chốt lời</p>
              <p className="text-xs font-bold">{formatMoney(portfolio.totalRealized)}</p>
            </div>
            <div className="bg-white/15 rounded-lg p-2 text-center">
              <p className="text-[10px] text-amber-200">Cổ tức</p>
              <p className="text-xs font-bold">{formatMoney(portfolio.totalDividends)}</p>
            </div>
          </div>
        </div>

        {/* SEARCH */}
        {stocks.length > 0 && (
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã CP..." className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm" />
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
            {/* Đang giữ */}
            {activeStocks.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 mt-2 mb-1">ĐANG GIỮ ({activeStocks.length})</p>
                {activeStocks.map(s => (
                  <StockCard key={s.id} stock={s} isExpanded={expandedId === s.id}
                    onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    onBuy={() => setShowTxForm({ stockId: s.id, type: 'buy' })}
                    onSell={() => setShowTxForm({ stockId: s.id, type: 'sell' })}
                    onDividend={() => setShowTxForm({ stockId: s.id, type: 'dividend' })}
                    onUpdatePrice={() => handleUpdatePrice(s)}
                    onEdit={() => { setEditingStock(s); setShowAddStock(true) }}
                    onDelete={() => handleDeleteStock(s)}
                    onDeleteTx={async (txId) => { await deleteStockTransaction(txId); loadData() }}
                    onDeleteDiv={async (divId) => { await deleteDividend(divId); loadData() }}
                    toast={toast}
                  />
                ))}
              </>
            )}

            {/* Đã bán hết */}
            {closedStocks.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-500 mt-4 mb-1">ĐÃ BÁN HẾT ({closedStocks.length})</p>
                {closedStocks.map(s => (
                  <StockCard key={s.id} stock={s} isExpanded={expandedId === s.id}
                    onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                    onBuy={() => setShowTxForm({ stockId: s.id, type: 'buy' })}
                    onSell={() => {}}
                    onDividend={() => setShowTxForm({ stockId: s.id, type: 'dividend' })}
                    onUpdatePrice={() => handleUpdatePrice(s)}
                    onEdit={() => { setEditingStock(s); setShowAddStock(true) }}
                    onDelete={() => handleDeleteStock(s)}
                    onDeleteTx={async (txId) => { await deleteStockTransaction(txId); loadData() }}
                    onDeleteDiv={async (divId) => { await deleteDividend(divId); loadData() }}
                    toast={toast}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => { setEditingStock(null); setShowAddStock(true) }}
        className="fixed bottom-20 right-4 w-12 h-12 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform z-40">
        <Plus size={24} />
      </button>

      {/* Add/Edit Stock */}
      <StockForm isOpen={showAddStock} onClose={() => { setShowAddStock(false); setEditingStock(null) }}
        stock={editingStock} toast={toast} onSaved={loadData} />

      {/* Transaction Form */}
      <TxForm isOpen={!!showTxForm} onClose={() => setShowTxForm(null)}
        config={showTxForm} stocks={stocks} toast={toast} onSaved={loadData} />
    </div>
  )
}

// ============================================
// STOCK CARD
// ============================================
function StockCard({ stock, isExpanded, onToggle, onBuy, onSell, onDividend, onUpdatePrice, onEdit, onDelete, onDeleteTx, onDeleteDiv, toast }) {
  const s = stock.stats
  const buys = (stock.transactions || []).filter(t => t.type === 'buy').sort((a, b) => b.date.localeCompare(a.date))
  const sells = (stock.transactions || []).filter(t => t.type === 'sell').sort((a, b) => b.date.localeCompare(a.date))
  const divs = (stock.dividends || []).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800">{stock.symbol}</span>
            {stock.name && <span className="text-xs text-gray-400 truncate">{stock.name}</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {s.holdingQty > 0 ? `${s.holdingQty} cp • TB: ${fmtPrice(s.avgBuyPrice)}` : 'Đã bán hết'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {s.holdingQty > 0 ? (
            <>
              <p className="text-sm font-bold text-gray-800">{formatMoney(s.marketValue)}</p>
              <p className={`text-xs font-bold ${plColor(s.unrealizedPL)}`}>
                {s.unrealizedPL >= 0 ? '+' : ''}{formatMoney(s.unrealizedPL)} ({fmtPercent(s.unrealizedPLPercent)})
              </p>
            </>
          ) : (
            <p className={`text-xs font-bold ${plColor(s.totalPL)}`}>
              Tổng: {s.totalPL >= 0 ? '+' : ''}{formatMoney(s.totalPL)}
            </p>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </div>

      {/* Expanded */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`border rounded-lg p-2 ${plBg(s.unrealizedPL)}`}>
              <p className="text-[10px] text-gray-500">Lãi/lỗ chưa chốt</p>
              <p className={`text-sm font-bold ${plColor(s.unrealizedPL)}`}>{formatMoney(s.unrealizedPL)}</p>
            </div>
            <div className={`border rounded-lg p-2 ${plBg(s.realizedPL)}`}>
              <p className="text-[10px] text-gray-500">Đã chốt lời</p>
              <p className={`text-sm font-bold ${plColor(s.realizedPL)}`}>{formatMoney(s.realizedPL)}</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
              <p className="text-[10px] text-gray-500">Giá hiện tại</p>
              <p className="text-sm font-bold text-gray-700">{fmtPrice(s.currentPrice)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
              <p className="text-[10px] text-gray-500">Cổ tức</p>
              <p className="text-sm font-bold text-amber-600">{formatMoney(s.totalDividends)}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={onBuy}
              className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-medium active:scale-95">
              <TrendingUp size={14} /> Mua
            </button>
            {s.holdingQty > 0 && (
              <button onClick={onSell}
                className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium active:scale-95">
                <TrendingDown size={14} /> Bán
              </button>
            )}
            <button onClick={onDividend}
              className="flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium active:scale-95">
              <DollarSign size={14} /> Cổ tức
            </button>
            <button onClick={onUpdatePrice}
              className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium active:scale-95">
              <BarChart3 size={14} /> Giá
            </button>
            <button onClick={onEdit}
              className="px-2 py-2 text-gray-400 hover:text-purple-500 active:scale-90 ml-auto">
              <Edit2 size={14} />
            </button>
            <button onClick={onDelete}
              className="px-2 py-2 text-gray-400 hover:text-red-500 active:scale-90">
              <Trash2 size={14} />
            </button>
          </div>

          {/* Transaction history */}
          {(buys.length > 0 || sells.length > 0) && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5">Lịch sử giao dịch</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {[...buys.map(t => ({ ...t, _type: 'buy' })), ...sells.map(t => ({ ...t, _type: 'sell' }))]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(t => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-gray-50 rounded-lg group">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${t._type === 'buy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {t._type === 'buy' ? 'M' : 'B'}
                        </span>
                        <span className="text-gray-500">{t.date.split('-').reverse().join('/')}</span>
                        <span className="text-gray-700">{t.quantity} cp × {fmtPrice(t.price)}</span>
                        {Number(t.fee) > 0 && <span className="text-gray-400">(phí {fmtPrice(t.fee)})</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-700">{formatMoney(t.quantity * Number(t.price))}</span>
                        <button onClick={() => { if (confirm('Xóa giao dịch này?')) onDeleteTx(t.id) }}
                          className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Dividends */}
          {divs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1.5">Cổ tức</p>
              <div className="space-y-1">
                {divs.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-amber-50 rounded-lg group">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500">💰</span>
                      <span className="text-gray-500">{d.date.split('-').reverse().join('/')}</span>
                      {d.note && <span className="text-gray-400">{d.note}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-amber-600">+{formatMoney(d.amount)}</span>
                      <button onClick={() => { if (confirm('Xóa cổ tức này?')) onDeleteDiv(d.id) }}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stock.note && <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">📝 {stock.note}</p>}
        </div>
      )}
    </div>
  )
}

// ============================================
// STOCK FORM (Add/Edit)
// ============================================
function StockForm({ isOpen, onClose, stock, toast, onSaved }) {
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (stock) {
        setSymbol(stock.symbol); setName(stock.name || '')
        setCurrentPrice(String(stock.current_price || '')); setNote(stock.note || '')
      } else { setSymbol(''); setName(''); setCurrentPrice(''); setNote('') }
    }
  }, [isOpen, stock])

  const handleSave = async () => {
    if (!symbol.trim()) { toast.error('Nhập mã CP'); return }
    setSaving(true)
    try {
      if (stock) {
        await updateStock(stock.id, { symbol: symbol.toUpperCase().trim(), name, current_price: Number(currentPrice) || 0, note })
        toast.success('Đã cập nhật')
      } else {
        await createStock({ symbol: symbol.trim(), name, current_price: Number(currentPrice) || 0, note })
        toast.success('Đã thêm ' + symbol.toUpperCase())
      }
      onClose(); onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={stock ? 'Sửa cổ phiếu' : '📈 Thêm cổ phiếu'}>
      <div className="space-y-3">
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
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Ghi chú</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Ghi chú..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving || !symbol.trim()}
            className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98">
            {saving ? '...' : (stock ? 'Cập nhật' : 'Thêm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// TRANSACTION FORM (Buy/Sell/Dividend)
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
  const isDividend = type === 'dividend'
  const stats = stock ? calcStockStats(stock) : null

  useEffect(() => {
    if (isOpen && stock) {
      setQuantity(''); setPrice(String(stock.current_price || '')); setFee(''); setNote('')
      setDate(new Date().toISOString().split('T')[0])
    }
  }, [isOpen, stock])

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

    // Check sell quantity
    if (type === 'sell' && stats && Number(quantity) > stats.holdingQty) {
      toast.error(`Chỉ đang giữ ${stats.holdingQty} cp!`); return
    }

    setSaving(true)
    try {
      await addStockTransaction({
        stock_id: stock.id, type, quantity: Number(quantity),
        price: Number(price), fee: Number(fee) || 0, date, note
      })
      // Recalc stock
      const updated = await getStocks()
      const s = updated.find(u => u.id === stock.id)
      if (s) await recalcStock(s.id, s)

      toast.success(type === 'buy' ? 'Đã mua' : 'Đã bán')
      onClose(); onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const titles = { buy: `🟢 Mua ${stock?.symbol || ''}`, sell: `🔴 Bán ${stock?.symbol || ''}`, dividend: `💰 Cổ tức ${stock?.symbol || ''}` }
  const btnColors = { buy: 'bg-green-500', sell: 'bg-red-500', dividend: 'bg-amber-500' }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titles[type] || ''}>
      <div className="space-y-3">
        {/* Info */}
        {stock && stats && !isDividend && (
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
            Đang giữ: <b className="text-gray-800">{stats.holdingQty} cp</b> • TB: <b>{fmtPrice(stats.avgBuyPrice)}</b>
          </div>
        )}

        {!isDividend && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Số lượng (cp)</label>
            <input type="number" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder="0" autoFocus className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
          </div>
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
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tổng tiền:</span>
              <span className="font-bold text-gray-800">
                {formatMoney(Number(quantity) * Number(price) + (Number(fee) || 0))}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm">Hủy</button>
          <button onClick={handleSave} disabled={saving}
            className={`flex-1 py-3 text-white rounded-xl font-bold text-sm shadow-md disabled:opacity-50 active:scale-98 ${btnColors[type]}`}>
            {saving ? '...' : (isDividend ? 'Ghi nhận' : type === 'buy' ? 'Mua' : 'Bán')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
