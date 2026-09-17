// ============================================
// JEWELRY MODULE - Quản lý Trang Sức
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Diamond, Plus, Trash2, Edit2, ChevronDown, ChevronLeft, Settings,
  RefreshCw, Tag, Package, Search, X, Check, Truck, Wallet, AlertCircle, PackageCheck,
  Camera, Clock, FileSpreadsheet, Upload, Download, AlertTriangle,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { getLocalDateString } from '../lib/helpers'
import MountsTab from './JewelryMounts'
import {
  getJewelry, createJewelry, updateJewelry, deleteJewelry,
  getJewelrySales, createSale, deleteSale, updateSaleStatus, updateSale,
  receiveOrder,
  getJewelryTrips, createJewelryTrip, updateJewelryTrip, deleteJewelryTrip,
  getJewelryCategories, saveJewelryCategories, DEFAULT_CATEGORIES,
  CSV_COLUMNS, downloadCsvTemplate, parseCsv, bulkCreateJewelry,
  getCustomerNotes, saveCustomerNote,
  getSuppliers,
  getActiveTrip, setActiveTrip,
  uploadImage, thumbUrl, resizeImage,
  calcStats, getCustomerNames, fmtMoney, fmtInput, parseInput, todayLocal,
} from '../lib/jewelry'

// ============================================
// MAIN
// ============================================
export default function Jewelry() {
  const toast = useToast()
  const [jewelry,  setJewelry]  = useState([])
  const [sales,    setSales]    = useState([])
  const [trips,    setTrips]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modTab,   setModTab]   = useState('kho')
  const [khoView,  setKhoView]  = useState('stock')   // stock | incoming
  const [banView,  setBanView]  = useState('orders')  // orders | customers
  const [soView,   setSoView]   = useState('report')  // report | trips
  const [detail,   setDetail]   = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [sellItem, setSellItem] = useState(null)
  const [editSale, setEditSale] = useState(null)
  const [addMode,  setAddMode]  = useState('in_stock')  // in_stock | ordered
  const [activeTrip, setActiveTripState] = useState(() => getActiveTrip())
  const [showTripPicker, setShowTripPicker] = useState(false)
  const [categories,    setCategories]    = useState(DEFAULT_CATEGORIES)
  const [showCatMgr,    setShowCatMgr]    = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [customerNotes, setCustomerNotes] = useState({})
  const [suppliers,     setSuppliers]     = useState([])

  useEffect(() => {
    getJewelryCategories().then(setCategories).catch(() => {})
    getCustomerNotes().then(setCustomerNotes).catch(() => {})
    getSuppliers().then(setSuppliers).catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [j, s, t] = await Promise.all([getJewelry(), getJewelrySales(), getJewelryTrips()])
      setJewelry(j); setSales(s); setTrips(t)
    } catch { toast.error('Lỗi tải dữ liệu') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const stats    = useMemo(() => calcStats(jewelry, sales), [jewelry, sales])
  const custNames = useMemo(() => getCustomerNames(sales), [sales])

  const handleSetTrip = (trip) => {
    setActiveTrip(trip); setActiveTripState(trip); setShowTripPicker(false)
  }
  const handleEndTrip = () => {
    if (!confirm('Kết thúc nhập hàng chuyến này?')) return
    setActiveTrip(null); setActiveTripState(null)
  }
  const handleDelete = async (item) => {
    const pending = sales.filter(s => s.jewelry_id === item.id && !s.delivered)
    const msg = pending.length > 0
      ? `Xoá "${item.code}"?\n\nĐang có ${pending.length} đơn CHƯA GIAO cho món này — xoá sẽ mất luôn các đơn đó.`
      : `Xoá "${item.code}"? Lịch sử bán sẽ xoá theo.`
    if (!confirm(msg)) return
    try { await deleteJewelry(item.id); toast.success('Đã xoá'); loadData() }
    catch { toast.error('Lỗi') }
  }

  return (
    <div className="min-h-screen bg-gray-50"
      style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom,0px))' }}>

      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          {detail ? (
            <button onClick={() => setDetail(null)} className="p-1 -ml-1 text-purple-600">
              <ChevronLeft size={22}/>
            </button>
          ) : <Diamond size={20} className="text-purple-600"/>}
          <h1 className="flex-1 text-base font-semibold text-gray-800">
            {detail ? `${detail.code}${detail.name ? ' · ' + detail.name : ''}` : 'Trang sức'}
          </h1>
          <button onClick={loadData} className="p-2 text-gray-400">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''}/>
          </button>
          {!detail && (
            <>
              {modTab === 'kho' && (
                <button onClick={() => setShowImport(true)} className="p-2 text-gray-400" title="Nhập từ file">
                  <FileSpreadsheet size={17}/>
                </button>
              )}
              <button onClick={() => setShowCatMgr(true)} className="p-2 text-gray-400" title="Quản lý loại">
                <Settings size={17}/>
              </button>
              <button onClick={() => { setEditing(null); setShowAdd(true) }} className="p-2 text-gray-400">
                <Plus size={19}/>
              </button>
            </>
          )}
        </div>
        {!detail && (
          <div className="flex border-t border-gray-100 overflow-x-auto" style={{scrollbarWidth:'none'}}>
            {[['kho','Kho'],['ban','Bán'],['omau','Ổ mẫu'],['so','Sổ sách']].map(([id,label]) => (
              <button key={id} onClick={() => setModTab(id)}
                className={`flex-1 px-2 py-2.5 text-xs text-center border-b-2
                  ${modTab===id ? 'border-purple-600 text-purple-600 font-semibold' : 'border-transparent text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {/* Thanh lọc trong tab — dính cùng header */}
        {!detail && modTab === 'kho' && (
          <SubFilter value={khoView} onChange={setKhoView} options={[
            ['stock',    `Trong kho (${stats.inStock})`],
            ['incoming', `Đang về (${stats.incomingCount})`],
          ]}/>
        )}
        {!detail && modTab === 'ban' && (
          <SubFilter value={banView} onChange={setBanView} options={[
            ['orders',    `Đơn hàng (${sales.length})`],
            ['customers', `Khách (${stats.customers.length})`],
          ]}/>
        )}
        {!detail && modTab === 'so' && (
          <SubFilter value={soView} onChange={setSoView} options={[
            ['report', 'Báo cáo'],
            ['trips',  `Chuyến (${trips.length})`],
          ]}/>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={24} className="animate-spin"/>
        </div>
      ) : detail ? (
        <DetailPanel item={detail} sales={sales.filter(s => s.jewelry_id === detail.id)}
          trips={trips}
          onSell={() => { setDetail(null); setSellItem(detail) }}
          onEdit={() => { setDetail(null); setEditing(detail); setShowAdd(true) }}
          onDelete={() => { handleDelete(detail); setDetail(null) }}/>
      ) : modTab === 'kho' ? (
        khoView === 'stock' ? (
            <KhoTab items={stats.withDays}
              categories={categories}
              onSelect={setDetail}
              onAdd={() => { setEditing(null); setAddMode('in_stock'); setShowAdd(true) }}
              onEdit={item => { setEditing(item); setAddMode(item.status || 'in_stock'); setShowAdd(true) }}
              onDelete={handleDelete}
              activeTrip={activeTrip}
              onPickTrip={() => setShowTripPicker(true)}
              onEndTrip={handleEndTrip}/>
          ) : (
            <NhapTab stats={stats} sales={sales}
              onAdd={() => { setEditing(null); setAddMode('ordered'); setShowAdd(true) }}
              onEdit={item => { setEditing(item); setAddMode('ordered'); setShowAdd(true) }}
              onDelete={handleDelete}
              onRefresh={loadData}
              toast={toast}/>
        )
      ) : modTab === 'ban' ? (
        banView === 'orders' ? (
            <BanTab sales={sales} stats={stats}
              onRefresh={loadData}
              onEdit={s => setEditSale(s)}
              toast={toast}/>
          ) : (
            <KhachTab customers={stats.customers}
              sales={sales}
              customerNotes={customerNotes}
              onNoteSaved={async (name, note) => {
                try {
                  await saveCustomerNote(name, note)
                  const updated = await getCustomerNotes()
                  setCustomerNotes(updated)
                } catch { toast.error('Lỗi lưu ghi chú') }
              }}/>
        )
      ) : modTab === 'omau' ? (
        <MountsTab toast={toast}/>
      ) : (
        soView === 'report'
          ? <BcTab stats={stats}/>
          : <TripsTab trips={trips} jewelry={jewelry}
              activeTrip={activeTrip}
              onSelect={handleSetTrip}
              onRefresh={loadData}
              toast={toast}/>
      )}

      {/* FAB */}
      {!detail && modTab === 'kho' && (
        <button onClick={() => {
            setEditing(null)
            setAddMode(khoView === 'incoming' ? 'ordered' : 'in_stock')
            setShowAdd(true)
          }}
          className="fixed right-4 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center z-20"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px))' }}>
          <Plus size={22}/>
        </button>
      )}
      {!detail && modTab === 'ban' && banView === 'orders' && (
        <button onClick={() => setSellItem('new')}
          className="fixed right-4 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center z-20"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px))' }}>
          <Plus size={22}/>
        </button>
      )}

      {/* Modals */}
      <JewelryForm isOpen={showAdd}
        onClose={() => { setShowAdd(false); setEditing(null) }}
        item={editing}
        mode={addMode}
        trips={trips}
        categories={categories}
        suppliers={suppliers}
        activeTrip={activeTrip}
        onSaved={() => { setShowAdd(false); setEditing(null); loadData(); getSuppliers().then(setSuppliers).catch(()=>{}) }}
        toast={toast}/>
      <ImportModal isOpen={showImport}
        existingCodes={jewelry.map(j => j.code)}
        categories={categories}
        defaultStatus={modTab === 'kho' && khoView === 'incoming' ? 'ordered' : 'in_stock'}
        activeTrip={activeTrip}
        onClose={() => setShowImport(false)}
        onRefresh={loadData}
        toast={toast}/>
      <CategoryManager isOpen={showCatMgr}
        categories={categories}
        jewelry={jewelry}
        onClose={() => setShowCatMgr(false)}
        onSaved={cats => { setCategories(cats); setShowCatMgr(false) }}
        toast={toast}/>
      <SaleForm isOpen={!!sellItem || !!editSale}
        item={sellItem && sellItem !== 'new' ? sellItem : null}
        editSale={editSale}
        jewelry={jewelry}
        allSales={sales}
        customerNames={custNames}
        onClose={() => { setSellItem(null); setEditSale(null) }}
        onSaved={() => { setSellItem(null); setEditSale(null); loadData() }}
        toast={toast}/>
      <TripPickerModal isOpen={showTripPicker} trips={trips}
        activeTrip={activeTrip}
        onSelect={handleSetTrip}
        onClose={() => setShowTripPicker(false)}
        onCreated={async (trip) => { await loadData(); handleSetTrip(trip) }}
        toast={toast}/>
    </div>
  )
}

// ============================================
// SUB FILTER — nút lọc trong tab
// ============================================
function SubFilter({ value, onChange, options }) {
  return (
    <div className="flex gap-2 px-3 py-2 bg-white border-b border-gray-100">
      {options.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          className={`flex-1 py-2 rounded-xl text-[11px] font-medium border transition-colors active:scale-98
            ${value === id
              ? 'bg-purple-600 text-white border-purple-600 font-semibold'
              : 'bg-white text-gray-500 border-gray-200'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

// ============================================
// KHO TAB
// ============================================
function KhoTab({ items: jewelry, categories = DEFAULT_CATEGORIES, onSelect, onAdd, onEdit, onDelete, activeTrip, onPickTrip, onEndTrip }) {
  const [cat,    setCat]    = useState('Tất cả')
  const [sort,   setSort]   = useState('new')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = cat === 'Tất cả' ? jewelry : jewelry.filter(j => j.category === cat)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j =>
        j.code.toLowerCase().includes(q) ||
        j.name?.toLowerCase().includes(q) ||
        j.supplier_name?.toLowerCase().includes(q) ||
        j.trip_name?.toLowerCase().includes(q)
      )
    }
    switch(sort) {
      case 'slow':    return [...list].sort((a,b) => b.days_in_stock - a.days_in_stock)
      case 'stock':   return [...list].sort((a,b) => b.available - a.available)
      case 'price_h': return [...list].sort((a,b) => (b.sell_price||0) - (a.sell_price||0))
      case 'price_l': return [...list].sort((a,b) => (a.sell_price||0) - (b.sell_price||0))
      case 'nophoto': return [...list].sort((a,b) =>
        (a.image_url ? 1 : 0) - (b.image_url ? 1 : 0) ||
        new Date(b.created_at) - new Date(a.created_at))
      default:        return [...list].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    }
  }, [jewelry, cat, sort, search])

  const newCount     = useMemo(() => jewelry.filter(j => j.is_new).length, [jewelry])
  const noPhotoCount = useMemo(() => jewelry.filter(j => j.needs_photo).length, [jewelry])

  const fmtDay = d => {
    if (!d) return ''
    const [y, m, day] = String(d).slice(0, 10).split('-')
    return `${day}/${m}`
  }

  const catCounts = useMemo(() => {
    const counts = { 'Tất cả': jewelry.length }
    categories.forEach(c => { counts[c] = jewelry.filter(j => j.category === c).length })
    return counts
  }, [jewelry])

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {[
          ['Tổng SP', jewelry.length, 'text-purple-600'],
          ['Còn bán được', jewelry.filter(j=>j.available>0).length, 'text-green-600'],
          ['Có đơn chờ giao', jewelry.filter(j=>j.reserved>0).length, 'text-red-600'],
          ['Tồn lâu >30n', jewelry.filter(j=>j.available>0&&j.days_in_stock>=30).length, 'text-amber-600'],
        ].map(([l,v,c]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="text-[10px] text-gray-500">{l}</div>
            <div className={`text-lg font-semibold mt-0.5 ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      {/* Active trip banner */}
      {activeTrip ? (
        <div className="mx-3 mb-1 rounded-xl overflow-hidden">
          <div className="bg-green-600 px-3 py-2 flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm flex-shrink-0">✈️</div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-green-100 font-medium">Đang nhập hàng</div>
              <div className="text-xs font-bold text-white truncate">{activeTrip.name}</div>
            </div>
            <button onClick={onEndTrip} className="text-[10px] font-semibold px-2 py-1 bg-white/20 text-white rounded-full flex-shrink-0">
              Kết thúc ✕
            </button>
          </div>
        </div>
      ) : (
        <button onClick={onPickTrip}
          className="mx-3 mb-1 w-[calc(100%-24px)] flex items-center gap-2.5 px-3 py-2 bg-white
            border border-dashed border-gray-300 rounded-xl active:scale-98">
          <div className="w-7 h-7 bg-purple-50 rounded-full flex items-center justify-center flex-shrink-0">
            <Package size={14} className="text-purple-500"/>
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-purple-600">Bắt đầu nhập hàng</div>
            <div className="text-[10px] text-gray-400">Chọn chuyến để gắn tự động</div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 bg-purple-600 text-white rounded-full flex-shrink-0">Chọn</span>
        </button>
      )}

      {/* Search */}
      <div className="px-3 pb-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã, tên, NCC, chuyến..."
            className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50
              focus:outline-none focus:border-purple-400"/>
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5">
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex overflow-x-auto bg-white border-b border-gray-100 px-1" style={{scrollbarWidth:'none'}}>
        {['Tất cả', ...categories].map(c => (
          catCounts[c] > 0 || c === 'Tất cả' ? (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 flex-shrink-0
                ${cat===c ? 'border-purple-600 text-purple-600 font-semibold' : 'border-transparent text-gray-400'}`}>
              {c} {catCounts[c]>0 && `(${catCounts[c]})`}
            </button>
          ) : null
        ))}
      </div>

      {/* Sort bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-400">
            {filtered.length} sản phẩm{search && ` · "${search}"`}
          </span>
          {newCount > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">
              {newCount} mới
            </span>
          )}
          {noPhotoCount > 0 && (
            <button onClick={() => setSort('nophoto')}
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 active:scale-95">
              {noPhotoCount} thiếu ảnh
            </button>
          )}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="new">Mới nhập trước</option>
          <option value="nophoto">Chưa có ảnh trước</option>
          <option value="slow">Tồn lâu nhất</option>
          <option value="stock">Tồn kho nhiều</option>
          <option value="price_h">Giá cao → thấp</option>
          <option value="price_l">Giá thấp → cao</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 && search ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Search size={32} className="mb-2 opacity-40"/>
          <p className="text-sm">Không tìm thấy "{search}"</p>
          <button onClick={() => setSearch('')} className="mt-2 text-xs text-purple-500">Xoá tìm kiếm</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 p-3">
          {filtered.map(item => {
            const st  = item.stock_state
            const sold = item.reserved                    // đã bán, chưa giao
            const total = Number(item.stock_qty) || 0     // tổng còn trong tủ
            // Có đơn chưa giao → nhãn chính là tỉ lệ đã bán (đỏ)
            const badgeCls = sold > 0
              ? 'bg-red-100 text-red-700'
              : st === 'out'        ? 'bg-red-100 text-red-600'
              : item.available <= 1 ? 'bg-amber-100 text-amber-700'
              :                       'bg-green-100 text-green-700'
            const badgeText = sold > 0
              ? `Đã bán ${sold}/${total}`
              : st === 'out' ? 'Hết' : `Còn ${item.available}`
            return (
              <div key={item.id}
                className={`bg-white rounded-xl overflow-hidden border
                  ${item.is_new ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-100'}`}>
                <div onClick={() => onSelect(item)}
                  className={`aspect-square relative flex items-center justify-center overflow-hidden cursor-pointer
                    ${item.image_url ? 'bg-gray-50' : 'bg-gradient-to-br from-purple-50 to-purple-200'}`}>
                  {item.image_url
                    ? <img src={thumbUrl(item.image_url, 400)} alt={item.code} className="w-full h-full object-contain"/>
                    : <Diamond size={34} className="text-purple-300"/>
                  }
                  <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                    {badgeText}
                  </span>
                  {sold > 0 && (
                    <span className="absolute top-7 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Chờ giao
                    </span>
                  )}
                  {item.is_new ? (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-600 text-white">
                      MỚI
                    </span>
                  ) : item.days_in_stock >= 30 && item.available > 0 ? (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                      {item.days_in_stock}n
                    </span>
                  ) : null}
                  {item.needs_photo && (
                    <span className="absolute inset-x-0 bottom-0 py-1 bg-black/45 text-white text-[9px] text-center font-medium">
                      Chưa có ảnh — bấm để thêm
                    </span>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-black/40 text-white">
                    {item.category}
                  </span>
                  {item.trip_name && (
                    <span className="absolute bottom-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-green-600/80 text-white">
                      ✈
                    </span>
                  )}
                </div>
                <div className="px-2 pt-2 pb-1 cursor-pointer" onClick={() => onSelect(item)}>
                  <div className="text-[11px] font-semibold text-gray-800">{item.code}</div>
                  {item.name && <div className="text-[10px] text-gray-500 truncate">{item.name}</div>}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.sell_price > 0 && (
                      <span className="text-[10px] text-purple-600 font-medium">{fmtMoney(item.sell_price)}</span>
                    )}
                    {item.size && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                        {item.size}
                      </span>
                    )}
                  </div>
                  {item.entry_date && (
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      Nhập {fmtDay(item.entry_date)}
                    </div>
                  )}
                </div>
                <div className="flex border-t border-gray-100">
                  <button onClick={() => onEdit(item)}
                    className="flex-1 py-1.5 text-[10px] text-gray-500 flex items-center justify-center gap-0.5 border-r border-gray-100 active:bg-gray-50">
                    <Edit2 size={11}/> Sửa
                  </button>
                  <button onClick={() => onDelete(item)}
                    className="flex-1 py-1.5 text-[10px] text-red-400 flex items-center justify-center gap-0.5 active:bg-red-50">
                    <Trash2 size={11}/> Xoá
                  </button>
                </div>
              </div>
            )
          })}
          <div onClick={onAdd} className="aspect-square rounded-xl border-2 border-dashed border-gray-200
            flex flex-col items-center justify-center gap-1.5 cursor-pointer text-gray-400 active:scale-95">
            <Plus size={22}/><span className="text-[11px]">Thêm mới</span>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================
// NHẬP HÀNG TAB — hàng đang về
// ============================================
function NhapTab({ stats, sales, onAdd, onEdit, onDelete, onRefresh, toast }) {
  const [recvItem, setRecvItem] = useState(null)
  const [search,   setSearch]   = useState('')
  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }
  const today10 = todayLocal()

  const list = useMemo(() => {
    let base = stats.incoming
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(j =>
        j.code.toLowerCase().includes(q) ||
        j.name?.toLowerCase().includes(q) ||
        j.supplier_name?.toLowerCase().includes(q) ||
        j.tracking_number?.toLowerCase().includes(q)
      )
    }
    return [...base].sort((a,b) => (a.eta_date||'9999').localeCompare(b.eta_date||'9999'))
  }, [stats.incoming, search])

  // Đếm số đã bán trước cho từng món
  const soldAhead = useMemo(() => {
    const m = {}
    sales.filter(s => !s.delivered && s.jewelry_id).forEach(s => {
      m[s.jewelry_id] = (m[s.jewelry_id] || 0) + (Number(s.qty) || 0)
    })
    return m
  }, [sales])

  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Đang về</div>
          <div className="text-lg font-semibold text-purple-600 mt-0.5">{stats.incomingCount} món</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Tiền hàng chờ về</div>
          <div className="text-lg font-semibold text-amber-600 mt-0.5">{fmtMoney(stats.incomingValue)}</div>
        </div>
      </div>

      {stats.incomingLate > 0 && (
        <div className="mx-3 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 flex-shrink-0"/>
          <span className="text-xs text-amber-800 flex-1">{stats.incomingLate} món quá hẹn về</span>
        </div>
      )}

      <div className="px-3 pb-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm mã, tên, NCC, mã vận đơn..."
            className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50
              focus:outline-none focus:border-purple-400"/>
          {search && (
            <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5">
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package size={32} className="mb-2 opacity-30"/>
          <p className="text-sm">{search ? `Không tìm thấy "${search}"` : 'Không có hàng nào đang về'}</p>
          {!search && (
            <button onClick={onAdd} className="mt-3 text-xs text-purple-600 font-semibold">
              + Thêm hàng đang về
            </button>
          )}
        </div>
      ) : list.map(j => {
        const ahead = soldAhead[j.id] || 0
        const late  = j.eta_date && j.eta_date < today10
        const cost  = (Number(j.stock_qty)||0) * (Number(j.cost_price)||0)

        return (
          <div key={j.id} className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-purple-50
                flex items-center justify-center">
                {j.image_url
                  ? <img src={thumbUrl(j.image_url, 120)} alt="" className="w-full h-full object-cover"/>
                  : <Diamond size={18} className="text-purple-200"/>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-800 truncate">
                      {j.code}{j.name ? ` · ${j.name}` : ''}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {j.stock_qty} cái
                      {j.supplier_name && ` · ${j.supplier_name}`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-gray-800">{fmtMoney(cost)}</div>
                    {j.order_date && <div className="text-[9px] text-gray-400">Đặt {fmtDate(j.order_date)}</div>}
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {j.tracking_number && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 font-mono">
                      {j.tracking_number}
                    </span>
                  )}
                  {late && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                      Quá hẹn {fmtDate(j.eta_date)}
                    </span>
                  )}
                  {!late && j.eta_date && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Dự kiến {fmtDate(j.eta_date)}
                    </span>
                  )}
                  {j.trip_name && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                      ✈ {j.trip_name}
                    </span>
                  )}
                  {ahead > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      Đã bán trước {ahead}
                    </span>
                  )}
                </div>

                {j.note && <div className="text-[10px] text-gray-400 italic mt-1">💬 {j.note}</div>}

                <div className="flex gap-2 mt-2">
                  <button onClick={() => setRecvItem({ ...j, soldAhead: ahead })}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center
                      justify-center gap-1 bg-green-50 text-green-700 border border-green-200 active:scale-95">
                    <PackageCheck size={11}/> Hàng đã về
                  </button>
                  <button onClick={() => onEdit(j)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 active:scale-95">
                    <Edit2 size={11}/>
                  </button>
                  <button onClick={() => {
                      if (ahead > 0 && !confirm(
                        `"${j.code}" đã bán trước ${ahead} cái.\nXoá món này sẽ xoá cả các đơn đó. Tiếp tục?`
                      )) return
                      onDelete(j)
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-red-400 active:scale-95">
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <ReceiveModal item={recvItem}
        onClose={() => setRecvItem(null)}
        onDone={() => { setRecvItem(null); onRefresh() }}
        toast={toast}/>
      <div className="h-4"/>
    </>
  )
}

// ============================================
// RECEIVE MODAL — xác nhận hàng về
// ============================================
function ReceiveModal({ item, onClose, onDone, toast }) {
  const [qty,    setQty]    = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (item) setQty(Number(item.stock_qty) || 0) }, [item])

  if (!item) return null

  const ordered = Number(item.stock_qty) || 0
  const ahead   = item.soldAhead || 0
  const short   = ordered - qty
  const tooFew  = qty < ahead

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const r = await receiveOrder(item.id, qty)
      toast.success(r.soldAhead > 0
        ? `${item.code} đã vào kho — còn ${r.available} cái bán được`
        : `${item.code} đã vào kho`)
      onDone()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={!!item} onClose={onClose} title="Xác nhận hàng về">
      <div className="px-5 pb-6 space-y-3">
        <div className="text-center">
          <div className="text-3xl mb-1">📦</div>
          <div className="text-sm font-semibold text-gray-800">
            {item.code}{item.name ? ` · ${item.name}` : ''}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Số lượng đặt</span>
            <span className="text-sm font-semibold text-gray-800">{ordered} cái</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Thực nhận</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(v => Math.max(0, v - 1))}
                className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-700 text-lg
                  flex items-center justify-center active:scale-90">−</button>
              <input type="number" min="0" value={qty}
                onChange={e => setQty(Math.max(0, Number(e.target.value) || 0))}
                className="w-16 text-center text-sm font-semibold py-1.5 border border-gray-200 rounded-lg"/>
              <button onClick={() => setQty(v => v + 1)}
                className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-700 text-lg
                  flex items-center justify-center active:scale-90">+</button>
            </div>
          </div>
          {ahead > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
              <span className="text-xs text-gray-500">Đã bán trước</span>
              <span className="text-sm font-semibold text-amber-600">{ahead} cái</span>
            </div>
          )}
        </div>

        {tooFew && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 leading-relaxed">
            Đã bán trước {ahead} cái — số thực nhận không được nhỏ hơn.
          </div>
        )}
        {!tooFew && short > 0 && (
          <div className="px-3 py-2 bg-amber-50 rounded-xl text-[11px] text-amber-800 leading-relaxed">
            Thiếu <b>{short}</b> cái so với đơn đặt. Kho ghi nhận đúng {qty} cái thực nhận.
          </div>
        )}

        <div className="px-3 py-2 bg-gray-50 rounded-xl text-[11px] text-gray-500 leading-relaxed">
          Món này chuyển sang <b>Kho hàng</b>, giữ nguyên ảnh, giá, NCC và chuyến.
          {ahead > 0 && ` ${ahead} cái đã bán trước sẽ tự trừ — còn ${Math.max(0, qty - ahead)} cái bán tiếp.`}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Huỷ</button>
          <button onClick={handleConfirm} disabled={saving || tooFew}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? '...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// BÁN HÀNG TAB — theo dõi đơn
// ============================================
function BanTab({ sales, stats, onRefresh, onEdit, toast }) {
  const [view,   setView]   = useState('pending')   // pending | done | all
  const [search, setSearch] = useState('')
  const [busy,   setBusy]   = useState(null)

  const fmtDate = d => { if(!d) return ''; const [y,mo,day]=d.split('-'); return `${day}/${mo}/${y.slice(2)}` }
  const today10 = todayLocal()

  const list = useMemo(() => {
    let base = view === 'pending' ? stats.pending
             : view === 'done'    ? stats.done
             : sales
    if (search.trim()) {
      const q = search.toLowerCase()
      base = base.filter(s =>
        (s.customer_name || '').toLowerCase().includes(q) ||
        (s.customer_phone || '').includes(q) ||
        (s.item_name || '').toLowerCase().includes(q) ||
        (s.jewelry?.code || '').toLowerCase().includes(q) ||
        (s.jewelry?.name || '').toLowerCase().includes(q)
      )
    }
    return [...base].sort((a,b) => (b.sold_at||'').localeCompare(a.sold_at||''))
  }, [sales, stats, view, search])

  const toggle = async (sale, field) => {
    setBusy(sale.id + field)
    try {
      await updateSaleStatus(sale.id, field, !sale[field])
      onRefresh()
    } catch (err) { toast.error(err.message) }
    finally { setBusy(null) }
  }

  const handleDelete = async (sale) => {
    if (!confirm('Xoá đơn này? Hàng có sẵn đã giao sẽ được hoàn về kho.')) return
    try { await deleteSale(sale.id); toast.success('Đã xoá đơn'); onRefresh() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Thực thu tháng</div>
          <div className="text-lg font-semibold text-green-600 mt-0.5">{fmtMoney(stats.monthActual)}</div>
          {stats.monthRevenue > stats.monthActual && (
            <div className="text-[9px] text-gray-400">/{fmtMoney(stats.monthRevenue)} ghi nhận</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Khách còn nợ</div>
          <div className={`text-lg font-semibold mt-0.5 ${stats.totalDebt > 0 ? 'text-red-500' : 'text-gray-300'}`}>
            {fmtMoney(stats.totalDebt)}
          </div>
        </div>
      </div>

      {/* Cảnh báo đơn trễ hẹn */}
      {stats.overdueCount > 0 && (
        <div className="mx-3 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 flex-shrink-0"/>
          <span className="text-xs text-amber-800 flex-1">
            {stats.overdueCount} đơn quá hẹn giao
          </span>
          <button onClick={() => setView('pending')} className="text-[10px] font-semibold text-amber-700">
            Xem
          </button>
        </div>
      )}

      {/* Search */}
      <div className="px-3 pb-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm khách, SĐT, tên hàng..."
            className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50
              focus:outline-none focus:border-purple-400"/>
          {search && (
            <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5">
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {/* View tabs */}
      <div className="flex bg-white border-b border-gray-100">
        {[
          ['pending', `Đang xử lý (${stats.pendingCount})`],
          ['done',    `Hoàn tất (${stats.done.length})`],
          ['all',     `Tất cả (${sales.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-1 py-2 text-xs border-b-2
              ${view===id ? 'border-purple-600 text-purple-600 font-semibold' : 'border-transparent text-gray-400'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Danh sách đơn */}
      {list.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          {view === 'pending' ? 'Không có đơn nào đang xử lý 👍'
           : search ? `Không tìm thấy "${search}"` : 'Chưa có đơn nào'}
        </div>
      ) : list.map(s => {
        const total   = Number(s.qty) * Number(s.sell_price)
        const dep     = Number(s.deposit) || 0
        const owed    = total - dep
        const isOrder = !s.jewelry_id
        const late    = !s.delivered && s.due_date && s.due_date < today10
        const name    = s.jewelry?.code
          ? `${s.jewelry.code}${s.jewelry.name ? ' · ' + s.jewelry.name : ''}`
          : (s.item_name || 'Hàng order')

        return (
          <div key={s.id} className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex gap-3">
              {/* Ảnh */}
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-purple-50
                flex items-center justify-center">
                {(s.item_image || s.jewelry?.image_url)
                  ? <img src={thumbUrl(s.item_image || s.jewelry.image_url, 120)} alt=""
                      className="w-full h-full object-cover"/>
                  : <Diamond size={18} className="text-purple-200"/>
                }
              </div>

              <div className="flex-1 min-w-0">
                {/* Hàng 1: tên + tổng tiền */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-gray-800 truncate">{name}</div>
                    <div className="text-[10px] text-gray-400">
                      {s.customer_name || 'Khách lẻ'}
                      {s.customer_phone && ` · ${s.customer_phone}`}
                      {' · '}{s.qty} cái
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-gray-800">{fmtMoney(total)}</div>
                    <div className="text-[9px] text-gray-400">{fmtDate(s.sold_at)}</div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {isOrder && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                      Order
                    </span>
                  )}
                  {late && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                      Trễ hẹn {fmtDate(s.due_date)}
                    </span>
                  )}
                  {!late && s.due_date && !s.delivered && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Hẹn {fmtDate(s.due_date)}
                    </span>
                  )}
                  {dep > 0 && !s.paid && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      Cọc {fmtMoney(dep)} · còn {fmtMoney(owed)}
                    </span>
                  )}
                  {!s.paid && dep === 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                      Nợ {fmtMoney(total)}
                    </span>
                  )}
                </div>

                {s.note && <div className="text-[10px] text-gray-400 italic mt-1">💬 {s.note}</div>}

                {/* Tick trạng thái */}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => toggle(s, 'delivered')} disabled={busy === s.id + 'delivered'}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center
                      justify-center gap-1 active:scale-95 transition-colors border
                      ${s.delivered
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white text-gray-400 border-gray-200'}`}>
                    {s.delivered ? <Check size={11}/> : <Truck size={11}/>}
                    {s.delivered ? 'Đã giao' : 'Chưa giao'}
                  </button>
                  <button onClick={() => toggle(s, 'paid')} disabled={busy === s.id + 'paid'}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold flex items-center
                      justify-center gap-1 active:scale-95 transition-colors border
                      ${s.paid
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white text-gray-400 border-gray-200'}`}>
                    {s.paid ? <Check size={11}/> : <Wallet size={11}/>}
                    {s.paid ? 'Đã thu' : 'Chưa thu'}
                  </button>
                  <button onClick={() => onEdit(s)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 active:scale-95">
                    <Edit2 size={11}/>
                  </button>
                  <button onClick={() => handleDelete(s)}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-red-400 active:scale-95">
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <div className="h-4"/>
    </>
  )
}

// ============================================
// KHÁCH HÀNG TAB
// ============================================
function KhachTab({ customers, sales, customerNotes, onNoteSaved }) {
  const [sort,       setSort]       = useState('revenue')
  const [search,     setSearch]     = useState('')
  const [openCust,   setOpenCust]   = useState(null)  // tên khách đang xem chi tiết
  const [editNote,   setEditNote]   = useState(null)  // tên khách đang sửa note
  const [noteVal,    setNoteVal]    = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const sorted = useMemo(() => {
    let list = [...customers]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q))
    }
    switch(sort) {
      case 'count':    return list.sort((a,b) => b.count - a.count)
      case 'recent':   return list.sort((a,b) => a.daysSinceLast - b.daysSinceLast)
      case 'inactive': return list.sort((a,b) => b.daysSinceLast - a.daysSinceLast)
      default:         return list.sort((a,b) => b.revenue - a.revenue)
    }
  }, [customers, sort, search])

  const initials = name => name.split(' ').slice(-2).map(w=>w[0]).join('').toUpperCase().slice(0,2)
  const fmtDate  = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }

  const custSales = (name) => sales
    .filter(s => s.customer_name === name)
    .sort((a,b) => (b.sold_at||'').localeCompare(a.sold_at||''))

  const handleSaveNote = async (name) => {
    setSavingNote(true)
    try { await onNoteSaved(name, noteVal); setEditNote(null) }
    catch {}
    finally { setSavingNote(false) }
  }

  return (
    <>
      {/* Sort + Search */}
      <div className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[10px] text-gray-400">Sắp xếp:</span>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600">
            <option value="revenue">Chi tiêu nhiều nhất</option>
            <option value="count">Mua nhiều đơn nhất</option>
            <option value="recent">Mới mua gần nhất</option>
            <option value="inactive">Lâu chưa quay lại</option>
          </select>
        </div>
        <div className="px-3 pb-2 relative">
          <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm tên khách..."
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50
              focus:outline-none focus:border-purple-400"/>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Tổng khách</div>
          <div className="text-lg font-semibold text-purple-600 mt-0.5">{customers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Quay lại ≥2 lần</div>
          <div className="text-lg font-semibold text-green-600 mt-0.5">{customers.filter(c=>c.count>=2).length}</div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Không tìm thấy khách</div>
      ) : sorted.map(c => {
        const isOpen = openCust === c.name
        const note   = customerNotes[c.name] || ''
        const cSales = isOpen ? custSales(c.name) : []

        return (
          <div key={c.name} className="border-b border-gray-100">
            {/* Khách row */}
            <div className="bg-white px-4 py-2.5 flex items-center gap-3 cursor-pointer"
              onClick={() => setOpenCust(isOpen ? null : c.name)}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                ${c.daysSinceLast >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
                {initials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800">{c.name}</div>
                <div className="text-[10px] text-gray-400">
                  {c.count} đơn · {fmtDate(c.lastDate)}
                  {note && <span className="ml-1 text-purple-400">· 📝</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0 mr-1">
                <div className="text-sm font-bold text-green-600">{fmtMoney(c.revenue)}</div>
                {c.daysSinceLast >= 30 && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {c.daysSinceLast}n
                  </span>
                )}
              </div>
              <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen?'rotate-180':''}`}/>
            </div>

            {/* Chi tiết mở rộng */}
            {isOpen && (
              <div className="bg-gray-50">
                {/* Ghi chú */}
                <div className="px-4 py-2 border-b border-gray-200">
                  {editNote === c.name ? (
                    <div className="flex gap-2 items-center">
                      <input value={noteVal} onChange={e=>setNoteVal(e.target.value)}
                        placeholder="Ghi chú về khách..."
                        className="flex-1 text-xs px-2 py-1.5 border border-purple-300 rounded-lg focus:outline-none"
                        autoFocus
                        onKeyDown={e => e.key==='Enter' && handleSaveNote(c.name)}/>
                      <button onClick={() => handleSaveNote(c.name)} disabled={savingNote}
                        className="text-[11px] font-semibold text-purple-600 px-2 py-1 bg-purple-50 rounded-lg active:scale-95">
                        {savingNote ? '...' : 'Lưu'}
                      </button>
                      <button onClick={() => setEditNote(null)} className="text-[11px] text-gray-400 active:scale-95">Huỷ</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2" onClick={() => { setEditNote(c.name); setNoteVal(note) }}>
                      <span className="text-[10px] text-gray-400 flex-1">
                        {note || '+ Thêm ghi chú (size thường, sở thích...)'}
                      </span>
                      <Edit2 size={12} className="text-gray-400 flex-shrink-0"/>
                    </div>
                  )}
                </div>

                {/* Lịch sử mua */}
                <div className="px-4 py-1.5">
                  <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                    Lịch sử mua ({cSales.length} đơn)
                  </div>
                  {cSales.map(s => (
                    <div key={s.id} className="flex items-center gap-2.5 py-1.5 border-b border-gray-200 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-700 truncate">
                          {s.jewelry?.code}{s.jewelry?.name ? ` · ${s.jewelry.name}` : ''}
                          {s.jewelry?.size ? ` · size ${s.jewelry.size}` : ''}
                        </div>
                        <div className="text-[10px] text-gray-400">{fmtDate(s.sold_at)} · {s.qty} cái</div>
                        {s.note && <div className="text-[10px] text-gray-400 italic">💬 {s.note}</div>}
                      </div>
                      <div className="text-xs font-semibold text-green-600 flex-shrink-0">
                        {fmtMoney(Number(s.qty)*Number(s.sell_price))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
      <div className="h-4"/>
    </>
  )
}

// ============================================
// BÁO CÁO TAB
// ============================================
function BcTab({ stats }) {
  const [bcTab, setBcTab] = useState('tong')
  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }

  return (
    <>
      <div className="flex bg-gray-100 rounded-xl p-1 mx-3 mt-3 gap-1">
        {[['tong','Tổng hợp'],['no','Công nợ'],['chay','Bán chạy'],['ton','Tồn lâu']].map(([id,label]) => (
          <button key={id} onClick={() => setBcTab(id)}
            className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-colors
              ${bcTab===id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {bcTab === 'tong' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 mx-3 mt-3 overflow-hidden">
            {[
              ['Thực thu tháng này', fmtMoney(stats.monthActual), 'text-green-600'],
              ['Ghi nhận tháng này', fmtMoney(stats.monthRevenue), 'text-gray-600'],
              ['Tổng doanh thu', fmtMoney(stats.totalRevenue), 'text-green-600'],
              ['Khách còn nợ', fmtMoney(stats.totalDebt), stats.totalDebt > 0 ? 'text-red-500' : 'text-gray-300'],
              ['Tiền cọc đang giữ', fmtMoney(stats.heldDeposit), 'text-amber-600'],
              ['Đơn đang xử lý', `${stats.pendingCount} đơn`, stats.pendingCount > 0 ? 'text-blue-600' : 'text-gray-300'],
              ['Đơn quá hẹn giao', `${stats.overdueCount} đơn`, stats.overdueCount > 0 ? 'text-red-500' : 'text-gray-300'],
              ['Số món đã bán', `${stats.totalSold} món`, 'text-purple-600'],
              ['Còn tồn kho', `${stats.inStock} món`, 'text-amber-600'],
              ['Tồn lâu >30 ngày', `${stats.slowMovingCount} món`, 'text-red-500'],
              ['Giá trị tồn ước tính', fmtMoney(stats.stockValue), 'text-amber-600'],
            ].map(([l,v,c]) => (
              <div key={l} className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 last:border-0">
                <span className="text-xs text-gray-500">{l}</span>
                <span className={`text-xs font-semibold ${c}`}>{v}</span>
              </div>
            ))}
          </div>
          {/* Revenue by category */}
          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Doanh thu theo loại</div>
          {Object.entries(stats.catRevenue)
            .sort((a,b) => b[1]-a[1])
            .map(([cat, rev]) => {
              const maxRev = Math.max(...Object.values(stats.catRevenue))
              const pct = maxRev > 0 ? rev/maxRev*100 : 0
              return (
                <div key={cat} className="bg-white border-b border-gray-100 px-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{cat}</span>
                    <span className="text-xs font-semibold text-green-600">{fmtMoney(rev)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{width:`${pct}%`}}/>
                  </div>
                </div>
              )
            })
          }
        </>
      )}

      {bcTab === 'chay' && (
        <>
          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Xếp hạng doanh thu</div>
          {stats.bestSellers.length === 0
            ? <div className="text-center py-10 text-gray-400 text-sm">Chưa có dữ liệu</div>
            : stats.bestSellers.map((j,i) => (
              <div key={j.id} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${i===0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>{i+1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">
                    {j.code}{j.name ? ` · ${j.name}` : ''}
                  </div>
                  <div className="text-[10px] text-gray-400">{j.qty} bán · {j.category}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-semibold text-green-600">{fmtMoney(j.revenue)}</div>
                  <div className="text-[10px] text-gray-400">{j.qty} món</div>
                </div>
              </div>
            ))
          }
        </>
      )}

      {bcTab === 'ton' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 mx-3 mt-3 overflow-hidden">
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Số món tồn lâu</span>
              <span className="text-xs font-semibold text-red-500">{stats.slowMovingCount} món</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-xs text-gray-500">Giá trị tồn lâu</span>
              <span className="text-xs font-semibold text-amber-600">
                {fmtMoney(stats.slowMoving.reduce((s,j)=>s+(j.available*(j.sell_price||0)),0))}
              </span>
            </div>
          </div>
          {stats.slowMoving.length === 0
            ? <div className="text-center py-6 text-gray-400 text-sm mt-4">Không có món tồn lâu 👍</div>
            : stats.slowMoving.map(j => (
              <div key={j.id} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                  ${j.days_in_stock>=45 ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <Clock size={14} className={j.days_in_stock>=45 ? 'text-red-500' : 'text-amber-600'}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800 truncate">
                    {j.code}{j.name ? ` · ${j.name}` : ''}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Tồn {j.available} · {j.supplier_name || 'NCC chưa ghi'}
                    {j.trip_name && ` · ✈ ${j.trip_name}`}
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                  ${j.days_in_stock>=45 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                  {j.days_in_stock} ngày
                </span>
              </div>
            ))
          }
        </>
      )}

      {bcTab === 'no' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 mx-3 mt-3 overflow-hidden">
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Tổng công nợ</span>
              <span className={`text-xs font-semibold ${stats.totalDebt > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                {fmtMoney(stats.totalDebt)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Số khách nợ</span>
              <span className="text-xs font-semibold text-purple-600">{stats.debtors.length} khách</span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-xs text-gray-500">Tiền cọc đang giữ</span>
              <span className="text-xs font-semibold text-amber-600">{fmtMoney(stats.heldDeposit)}</span>
            </div>
          </div>

          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Danh sách khách nợ
          </div>
          {stats.debtors.length === 0
            ? <div className="text-center py-8 text-gray-400 text-sm">Không có khách nào đang nợ 👍</div>
            : stats.debtors.map((d,i) => (
              <div key={d.name} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center
                  text-[10px] font-bold text-red-600 flex-shrink-0">
                  {i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-800">{d.name}</div>
                  <div className="text-[10px] text-gray-400">
                    {d.count} đơn{d.phone ? ` · ${d.phone}` : ''}
                  </div>
                </div>
                <div className="text-sm font-bold text-red-500 flex-shrink-0">{fmtMoney(d.amount)}</div>
              </div>
            ))
          }

          {stats.overdueCount > 0 && (
            <>
              <div className="px-3 mt-4 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                Đơn quá hẹn giao
              </div>
              {stats.overdue.map(s => (
                <div key={s.id} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
                  <AlertCircle size={16} className="text-amber-500 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">
                      {s.jewelry?.code || s.item_name || 'Hàng order'}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {s.customer_name || 'Khách lẻ'} · hẹn {fmtDate(s.due_date)}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 flex-shrink-0">
                    {fmtMoney(Number(s.qty)*Number(s.sell_price))}
                  </span>
                </div>
              ))}
            </>
          )}
        </>
      )}
      <div className="h-4"/>
    </>
  )
}

// ============================================
// DETAIL PANEL
// ============================================
function DetailPanel({ item, sales, trips, onSell, onEdit, onDelete }) {
  const toast = useToast()
  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }
  const sold      = sales.reduce((s,x) => s + Number(x.qty), 0)
  const reserved  = sales.filter(s => !s.delivered).reduce((s,x) => s + Number(x.qty), 0)
  const available = Math.max(0, (Number(item.stock_qty) || 0) - reserved)
  const revenue = sales.reduce((s,x) => s + Number(x.qty)*Number(x.sell_price), 0)
  const tripName = item.trip_name || trips.find(t => t.id === item.trip_id)?.name

  return (
    <div>
      <div className={`w-full aspect-square relative flex items-center justify-center overflow-hidden
        ${item.image_url ? 'bg-gray-50' : 'bg-gradient-to-br from-purple-50 to-purple-200'}`}>
        {item.image_url
          ? <img src={thumbUrl(item.image_url, 800)} alt={item.code} className="w-full h-full object-contain"/>
          : <Diamond size={72} className="text-purple-200"/>
        }
        <div className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-black/40 text-white">
          {item.category}
        </div>
        {tripName && (
          <div className="absolute bottom-2 left-2 text-[9px] px-2 py-0.5 rounded-full bg-green-600/80 text-white">
            ✈ {tripName}
          </div>
        )}
      </div>

      <div className="bg-white px-4 py-0.5">
        {[
          ['Mã SP', item.code],
          ['Tên', item.name],
          ['Size', item.size],
          ['Ngày nhập', item.received_at || (item.created_at || '').slice(0,10)
            ? (() => { const d = (item.received_at || item.created_at || '').slice(0,10)
                       const [y,m,dd] = d.split('-'); return dd ? `${dd}/${m}/${y}` : null })()
            : null],
          ['Tồn kho', `${item.stock_qty} cái`, item.stock_qty > 0 ? 'text-gray-800' : 'text-red-500'],
          ['Đã bán, chờ giao', reserved > 0 ? `${reserved}/${item.stock_qty} cái` : null, 'text-red-600'],
          ['Còn bán được', `${available} cái`,
            available > 0 ? 'text-green-600' : (reserved > 0 ? 'text-blue-600' : 'text-red-500')],
          ['Giá vốn', item.cost_price ? fmtMoney(item.cost_price) + '/cái' : null],
          ['Giá bán', item.sell_price ? fmtMoney(item.sell_price) : null],
          ['Đã bán', sold > 0 ? `${sold} cái · ${fmtMoney(revenue)}` : null],
          ['Chuyến nhập', tripName],
          ['NCC', item.supplier_name],
          ['SĐT NCC', item.supplier_contact],
          ['Ghi chú', item.note],
        ].filter(([,v]) => v).map(([l,v,c]) => (
          <div key={l} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
            <span className="text-xs text-gray-500">{l}</span>
            <span className={`text-xs font-semibold text-gray-800 ${c||''}`}>{v}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 p-3">
        {available > 0 ? (
          <button onClick={onSell}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95">
            Ghi bán
          </button>
        ) : reserved > 0 ? (
          <div className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold text-center">
            Đã bán hết · chờ giao {reserved}
          </div>
        ) : null}
        <button onClick={onEdit}
          className="flex-1 py-2.5 bg-purple-50 border border-purple-200 text-purple-600 rounded-xl text-xs font-semibold active:scale-95">
          Sửa
        </button>
        <button onClick={onDelete}
          className="px-3 py-2.5 bg-red-50 text-red-500 border border-red-200 rounded-xl active:scale-95">
          <Trash2 size={15}/>
        </button>
      </div>

      {/* Lịch sử bán */}
      <div className="px-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
        Lịch sử bán ({sales.length})
      </div>
      {sales.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Chưa có đơn bán nào</div>
      ) : sales.map(s => (
        <div key={s.id} className="bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <Tag size={11} className="text-green-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-700">{s.customer_name || 'Khách lẻ'} · {s.qty} cái</div>
              <div className="text-[10px] text-gray-400">{fmtDate(s.sold_at)}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs font-semibold text-green-600">{fmtMoney(Number(s.qty)*Number(s.sell_price))}</div>
              {(!s.delivered || !s.paid) && (
                <div className="text-[9px] text-amber-600">
                  {!s.delivered && 'Chưa giao'}{!s.delivered && !s.paid && ' · '}{!s.paid && 'Chưa thu'}
                </div>
              )}
            </div>
            <button onClick={async () => {
              if (!confirm('Xoá lần bán này?')) return
              try { await deleteSale(s.id); onDelete() } catch {}
            }} className="p-1 text-gray-300 hover:text-red-400">
              <Trash2 size={12}/>
            </button>
          </div>
          {s.note && <div className="text-[10px] text-gray-400 italic mt-1 pl-8">💬 {s.note}</div>}
        </div>
      ))}
      <div className="h-4"/>
    </div>
  )
}

// ============================================
// TRIPS TAB
// ============================================
function TripsTab({ trips, jewelry, activeTrip, onSelect, onRefresh, toast }) {
  const [editTrip, setEditTrip] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }

  const handleDelete = async (trip) => {
    if (!confirm(`Xoá chuyến "${trip.name}"?\nHàng hoá đã gắn sẽ giữ nguyên, chỉ mất liên kết chuyến.`)) return
    try {
      await deleteJewelryTrip(trip.id)
      if (activeTrip?.id === trip.id) onSelect(null)
      toast.success('Đã xoá chuyến')
      onRefresh()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
  }

  const handleSave = async (form) => {
    try {
      if (editTrip?.id) {
        await updateJewelryTrip(editTrip.id, form)
        toast.success('Đã cập nhật')
      } else {
        await createJewelryTrip(form)
        toast.success('Đã tạo chuyến mới')
      }
      setShowForm(false); setEditTrip(null); onRefresh()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-600">{trips.length} chuyến nhập</div>
        <button onClick={() => { setEditTrip(null); setShowForm(true) }}
          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-semibold active:scale-95">
          <Plus size={13}/> Thêm chuyến
        </button>
      </div>

      {activeTrip && (
        <div className="mx-3 mt-3 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
          <div className="text-sm flex-shrink-0">✈️</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-green-600 font-medium">Đang nhập hàng</div>
            <div className="text-xs font-bold text-green-800 truncate">{activeTrip.name}</div>
          </div>
          <button onClick={() => onSelect(null)}
            className="text-[10px] font-semibold px-2 py-1 bg-white border border-green-300 text-green-700 rounded-full active:scale-95">
            Kết thúc ✕
          </button>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Package size={32} className="mb-2 opacity-30"/>
          <p className="text-sm">Chưa có chuyến nhập nào</p>
          <button onClick={() => { setEditTrip(null); setShowForm(true) }}
            className="mt-3 text-xs text-purple-600 font-semibold">
            + Tạo chuyến đầu tiên
          </button>
        </div>
      ) : (
        <div className="mt-2">
          {trips.map(trip => {
            return (
              <div key={trip.id}
                className={`bg-white border-b border-gray-100 px-4 py-3 ${activeTrip?.id === trip.id ? 'bg-green-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div onClick={() => onSelect(activeTrip?.id === trip.id ? null : trip)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 cursor-pointer active:scale-95
                      ${activeTrip?.id === trip.id ? 'bg-green-500' : 'bg-purple-50'}`}>
                    {activeTrip?.id === trip.id ? '✓' : '✈️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">{trip.name}</span>
                      {activeTrip?.id === trip.id && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Đang nhập</span>
                      )}
                    </div>
                    {trip.destination && <div className="text-[10px] text-gray-400">{trip.destination}</div>}
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {trip.trip_date && <span className="text-[10px] text-gray-400">{fmtDate(trip.trip_date)}</span>}
                      <span className="text-[10px] text-purple-500 font-medium">
                        {trip.item_count} món
                        {trip.stock_value > 0 && ` · tồn ${fmtMoney(trip.stock_value)}`}
                      </span>
                      {trip.incoming_count > 0 && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          {trip.incoming_count} đang về · {fmtMoney(trip.incoming_value)}
                        </span>
                      )}
                    </div>
                    {trip.note && <div className="text-[10px] text-gray-400 italic truncate">{trip.note}</div>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditTrip(trip); setShowForm(true) }}
                      className="p-2 text-gray-400 hover:text-purple-600 active:scale-90">
                      <Edit2 size={14}/>
                    </button>
                    <button onClick={() => handleDelete(trip)}
                      className="p-2 text-gray-400 hover:text-red-500 active:scale-90">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
                {activeTrip?.id !== trip.id && (
                  <button onClick={() => onSelect(trip)}
                    className="mt-2 w-full py-1.5 text-[10px] font-semibold text-purple-600 bg-purple-50 rounded-lg active:scale-98">
                    Bắt đầu nhập hàng với chuyến này
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditTrip(null) }}
        title={editTrip ? `Sửa — ${editTrip.name}` : 'Thêm chuyến mới'}>
        <TripForm initial={editTrip} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTrip(null) }}/>
      </Modal>
      <div className="h-4"/>
    </>
  )
}

// ============================================
// TRIP PICKER MODAL
// ============================================
function TripPickerModal({ isOpen, trips, activeTrip, onSelect, onClose, onCreated, toast }) {
  const [showNew, setShowNew] = useState(false)
  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }
  useEffect(() => { if (!isOpen) setShowNew(false) }, [isOpen])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chọn chuyến nhập">
      <div className="pb-4">
        {activeTrip && (
          <div className="mx-4 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
            <span className="text-xs text-green-700 flex-1">
              Đang nhập: <span className="font-semibold">{activeTrip.name}</span>
            </span>
            <button onClick={() => onSelect(null)} className="text-[10px] text-green-600 font-medium">Bỏ chọn</button>
          </div>
        )}
        {trips.map(t => (
          <div key={t.id} onClick={() => onSelect(t)}
            className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer active:bg-gray-50
              ${activeTrip?.id === t.id ? 'bg-green-50' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-lg flex-shrink-0">✈️</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                {t.name}
                {activeTrip?.id === t.id && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Đang nhập</span>
                )}
              </div>
              {t.destination && <div className="text-[10px] text-gray-400">{t.destination}</div>}
              {t.trip_date && <div className="text-[10px] text-gray-400">{fmtDate(t.trip_date)}</div>}
            </div>
            <div className="text-xs font-medium text-purple-600 flex-shrink-0">{t.item_count} món</div>
          </div>
        ))}
        {!showNew ? (
          <button onClick={() => setShowNew(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-purple-600 font-semibold text-sm border-t border-gray-100 active:bg-purple-50">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Plus size={18} className="text-purple-600"/>
            </div>
            Tạo chuyến mới
          </button>
        ) : (
          <TripForm onSave={async (data) => {
            try {
              const newTrip = await createJewelryTrip(data)
              toast.success('Đã tạo chuyến mới')
              onCreated(newTrip); setShowNew(false)
            } catch (err) { toast.error('Lỗi: ' + err.message) }
          }} onCancel={() => setShowNew(false)}/>
        )}
        <button onClick={() => onSelect(null)}
          className="w-full text-center py-3 text-xs text-gray-400 active:text-gray-600">
          Nhập không gắn chuyến
        </button>
      </div>
    </Modal>
  )
}

// ============================================
// TRIP FORM
// ============================================
function TripForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState({
    name:        initial?.name || '',
    destination: initial?.destination || '',
    trip_date:   initial?.trip_date || getLocalDateString(),
    note:        initial?.note || '',
  })
  const [saving, setSaving] = useState(false)
  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }
  return (
    <div className="px-4 pt-3 pb-2 border-t border-gray-100 space-y-3">
      {initial && <div className="text-xs font-semibold text-gray-600">Sửa thông tin chuyến</div>}
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">Tên chuyến *</label>
        <input value={form.name} onChange={e=>f('name',e.target.value)} autoFocus
          placeholder="VD: Chuyến TQ tháng 9, Chuyến HN..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
      </div>
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">Điểm đến</label>
        <input value={form.destination} onChange={e=>f('destination',e.target.value)}
          placeholder="Quảng Châu, Thâm Quyến..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
      </div>
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">Ngày nhập</label>
        <input type="date" value={form.trip_date} onChange={e=>f('trip_date',e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
      </div>
      <div>
        <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
        <input value={form.note} onChange={e=>f('note',e.target.value)}
          placeholder="Ngân sách, mục tiêu..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Huỷ</button>
        <button onClick={handleSave} disabled={saving || !form.name.trim()}
          className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
          {saving ? '...' : initial ? 'Lưu thay đổi' : 'Tạo & Bắt đầu'}
        </button>
      </div>
    </div>
  )
}

// ============================================
// JEWELRY FORM (thêm / sửa SP)
// ============================================
function JewelryForm({ isOpen, onClose, item, mode = 'in_stock', trips, categories = DEFAULT_CATEGORIES, suppliers = [], activeTrip, onSaved, toast }) {
  const EMPTY = {
    code:'', category:'Nhẫn', name:'', size:'', stock_qty:1,
    cost_price:'', sell_price:'', supplier_name:'', supplier_contact:'',
    trip_id:'', note:'',
    tracking_number:'', order_date:'', eta_date:'',
  }
  const [form,    setForm]    = useState(EMPTY)
  const [imgFile, setImgFile] = useState(null)
  const [imgPrev, setImgPrev] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [resizing,setResizing]= useState(false)
  const [acSupp,  setAcSupp]  = useState(false)  // autocomplete NCC
  const [acList,  setAcList]  = useState([])
  const fileRef   = useRef()

  useEffect(() => {
    if (!isOpen) { setAcSupp(false); setAcList([]); return }
    if (item) {
      setForm({
        code: item.code||'', category: item.category||'Nhẫn', name: item.name||'',
        size: item.size||'', stock_qty: item.stock_qty||1, cost_price: item.cost_price||'',
        sell_price: item.sell_price||'', supplier_name: item.supplier_name||'',
        supplier_contact: item.supplier_contact||'', trip_id: item.trip_id||'', note: item.note||'',
        tracking_number: item.tracking_number||'', order_date: item.order_date||'', eta_date: item.eta_date||'',
      })
      setImgPrev(item.image_url || null)
    } else {
      setForm({ ...EMPTY, trip_id: activeTrip?.id || '',
        order_date: mode === 'ordered' ? getLocalDateString() : '' })
      setImgPrev(null)
    }
    setImgFile(null)
  }, [isOpen, item, activeTrip, mode])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setResizing(true)
    try {
      const blob = await resizeImage(file, 800, 0.75)
      setImgFile(new File([blob], file.name, { type: 'image/jpeg' }))
      setImgPrev(URL.createObjectURL(blob))
    } catch { toast.error('Lỗi xử lý ảnh') }
    finally { setResizing(false) }
  }

  const handleSubmit = async () => {
    if (!form.code.trim()) { toast.error('Nhập mã sản phẩm'); return }
    setSaving(true)
    try {
      let image_url  = item?.image_url || null
      let imgWarning = null
      if (imgFile) {
        try {
          image_url = await uploadImage(imgFile, form.code.trim())
        } catch (e) {
          imgWarning = /bucket|not found|policy|permission|row-level/i.test(e.message || '')
            ? 'Ảnh chưa lưu được — kiểm tra quyền Storage trên Supabase'
            : 'Ảnh chưa lưu được — sản phẩm vẫn được lưu'
        }
      }
      const payload = {
        code: form.code.trim(), category: form.category,
        name: form.name.trim() || null,
        size:             form.size.trim() || null,
        stock_qty:        Number(form.stock_qty) || 0,
        cost_price:       form.cost_price  ? Number(form.cost_price)  : null,
        sell_price:       form.sell_price  ? Number(form.sell_price)  : null,
        supplier_name:    form.supplier_name.trim()    || null,
        supplier_contact: form.supplier_contact.trim() || null,
        trip_id:          form.trip_id || null,
        note:             form.note.trim() || null,
        image_url,
        status:           item ? (item.status || 'in_stock') : mode,
        tracking_number:  form.tracking_number.trim() || null,
        order_date:       form.order_date || null,
        eta_date:         form.eta_date   || null,
      }
      if (item) await updateJewelry(item.id, payload)
      else       await createJewelry(payload)
      if (imgWarning) toast.error(imgWarning)
      else            toast.success(item ? 'Đã cập nhật' : 'Đã thêm sản phẩm')
      onSaved()
    } catch (err) {
      const m = err.message || ''
      if (/duplicate key|unique constraint/i.test(m))
        toast.error(`Mã "${form.code.trim()}" đã tồn tại`)
      else if (/check constraint/i.test(m))
        toast.error('Loại sản phẩm không hợp lệ — cần chạy migration SQL')
      else if (/column .* does not exist/i.test(m))
        toast.error('Thiếu cột trong database — cần chạy migration SQL')
      else
        toast.error('Lỗi: ' + m)
    }
    finally { setSaving(false) }
  }

  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))
  const isOrdered = item ? item.status === 'ordered' : mode === 'ordered'

  const onSuppInput = (v) => {
    f('supplier_name', v)
    if (!v.trim()) { setAcSupp(false); return }
    const q = v.toLowerCase()
    setAcList(suppliers.filter(s => s.name.toLowerCase().includes(q)))
    setAcSupp(true)
  }

  const selectSupp = (supp) => {
    setForm(prev => ({
      ...prev,
      supplier_name:    supp.name,
      supplier_contact: supp.contact || prev.supplier_contact,
    }))
    setAcSupp(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? `Sửa ${item.code}` : (mode === 'ordered' ? 'Thêm hàng đang về' : 'Thêm trang sức')}>
      <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[70vh]">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
        <div onClick={() => fileRef.current?.click()} className="cursor-pointer">
          {imgPrev ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden">
              <img src={imgPrev} alt="" className="w-full h-full object-contain"/>
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
                {resizing ? 'Đang resize...' : 'Đổi ảnh'}
              </div>
            </div>
          ) : (
            <div className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-200
              flex flex-col items-center justify-center gap-2 text-gray-400">
              {resizing ? <RefreshCw size={22} className="animate-spin text-purple-400"/> :
                <><Camera size={22}/><span className="text-xs">Chọn ảnh · ~50 KB</span></>}
            </div>
          )}
        </div>

        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Thông tin sản phẩm</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Mã SP *</label>
            <input value={form.code} onChange={e=>f('code',e.target.value)} placeholder="NJ-001"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Loại *</label>
            <select value={form.category} onChange={e=>f('category',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tên — tùy chọn</label>
          <input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Nhẫn vàng 18k..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Size — tùy chọn</label>
          <input value={form.size} onChange={e=>f('size',e.target.value)} placeholder="VD: 15, M, 50cm..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">{isOrdered ? 'Số lượng đặt' : 'Số lượng'}</label>
            <input type="number" value={form.stock_qty} onChange={e=>f('stock_qty',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Giá vốn (đ)</label>
            <input type="text" inputMode="numeric" value={fmtInput(form.cost_price)}
              onChange={e=>f('cost_price', parseInput(e.target.value))}
              placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Giá bán (đ)</label>
          <input type="text" inputMode="numeric" value={fmtInput(form.sell_price)}
            onChange={e=>f('sell_price', parseInput(e.target.value))}
            placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="border-t border-gray-100 pt-2"/>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nhà cung cấp</div>
        <div className="relative">
          <label className="text-[11px] text-gray-500 block mb-1">Tên NCC</label>
          <input value={form.supplier_name}
            onChange={e => onSuppInput(e.target.value)}
            onFocus={() => form.supplier_name && setAcSupp(true)}
            onBlur={() => setTimeout(() => setAcSupp(false), 150)}
            placeholder="Gõ tên NCC..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none"/>
          {acSupp && acList.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl
              shadow-lg z-30 mt-0.5 max-h-40 overflow-y-auto">
              {acList.map(s => (
                <div key={s.name} onMouseDown={() => selectSupp(s)}
                  className="px-3 py-2.5 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-purple-50">
                  <div className="text-sm font-medium text-gray-800">{s.name}</div>
                  {s.contact && <div className="text-[10px] text-gray-400">{s.contact}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">SĐT / Zalo</label>
          <input type="tel" value={form.supplier_contact} onChange={e=>f('supplier_contact',e.target.value)}
            placeholder="0912..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        {isOrdered && (
          <>
            <div className="border-t border-gray-100 pt-2"/>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Thông tin đơn nhập</div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Mã vận đơn — tùy chọn</label>
              <input value={form.tracking_number} onChange={e=>f('tracking_number',e.target.value)}
                placeholder="SF1234567890"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Ngày đặt</label>
                <input type="date" value={form.order_date} onChange={e=>f('order_date',e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Dự kiến về</label>
                <input type="date" value={form.eta_date} onChange={e=>f('eta_date',e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
              </div>
            </div>
          </>
        )}

        <div className="border-t border-gray-100 pt-2"/>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Chuyến nhập — tùy chọn</label>
          {activeTrip && !form.trip_id && (
            <button type="button" onClick={() => f('trip_id', activeTrip.id)}
              className="w-full text-left px-3 py-2 border border-dashed border-green-300
                bg-green-50 rounded-xl text-xs text-green-700 font-medium mb-2 active:scale-98">
              + Gắn vào chuyến đang nhập: {activeTrip.name}
            </button>
          )}
          <select value={form.trip_id} onChange={e=>f('trip_id',e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
            <option value="">Không gắn chuyến</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.destination ? ` — ${t.destination}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
          <input value={form.note} onChange={e=>f('note',e.target.value)}
            placeholder="Size, chất liệu..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Huỷ</button>
          <button onClick={handleSubmit} disabled={saving || !form.code.trim()}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Đang lưu...' : item ? 'Cập nhật' : 'Lưu'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// SALE FORM — tạo / sửa đơn (có sẵn hoặc order)
// ============================================
function SaleForm({ isOpen, item, editSale, jewelry = [], allSales = [], customerNames, onClose, onSaved, toast }) {
  const EMPTY = {
    mode: 'stock',          // stock | order
    jewelry_id: '', item_name: '',
    qty: 1, sell_price: '', deposit: '',
    customer_name: '', customer_phone: '',
    due_date: '', note: '', sold_at: '',
    delivered: true, paid: true,
  }
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [acShow,  setAcShow]  = useState(false)
  const [acList,  setAcList]  = useState([])
  const [pickOpen,setPickOpen]= useState(false)
  const [imgFile, setImgFile] = useState(null)
  const [imgPrev, setImgPrev] = useState(null)
  const [resizing,setResizing]= useState(false)
  const fileRef = useRef()

  const picked = form.jewelry_id
    ? (jewelry.find(j => j.id === form.jewelry_id) || item || null)
    : null

  // Còn bán được = tồn − đã bán chưa giao (không tính đơn đang sửa)
  const pickedAvail = picked
    ? Math.max(0, (Number(picked.stock_qty) || 0) - allSales
        .filter(s => s.jewelry_id === picked.id && !s.delivered && s.id !== editSale?.id)
        .reduce((sum, s) => sum + (Number(s.qty) || 0), 0))
    : 0

  useEffect(() => {
    if (!isOpen) { setAcShow(false); setPickOpen(false); return }
    if (editSale) {
      setForm({
        mode: editSale.jewelry_id ? 'stock' : 'order',
        jewelry_id:     editSale.jewelry_id || '',
        item_name:      editSale.item_name || '',
        qty:            editSale.qty || 1,
        sell_price:     String(editSale.sell_price || ''),
        deposit:        String(editSale.deposit || ''),
        customer_name:  editSale.customer_name || '',
        customer_phone: editSale.customer_phone || '',
        due_date:       editSale.due_date || '',
        note:           editSale.note || '',
        sold_at:        editSale.sold_at || getLocalDateString(),
        delivered:      editSale.delivered ?? true,
        paid:           editSale.paid ?? true,
      })
      setImgPrev(editSale.item_image || null)
    } else if (item) {
      setForm({ ...EMPTY, mode: 'stock', jewelry_id: item.id,
        sell_price: String(item.sell_price || ''), sold_at: getLocalDateString(),
        // Hàng đang về → không thể giao ngay
        delivered: item.status !== 'ordered' })
      setImgPrev(null)
    } else {
      setForm({ ...EMPTY, sold_at: getLocalDateString() })
      setImgPrev(null)
    }
    setImgFile(null)
  }, [isOpen, item, editSale])

  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))

  const onCustInput = (v) => {
    f('customer_name', v)
    if (!v.trim()) { setAcShow(false); return }
    setAcList(customerNames.filter(n => n.toLowerCase().includes(v.toLowerCase())))
    setAcShow(true)
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setResizing(true)
    try {
      const blob = await resizeImage(file, 800, 0.75)
      setImgFile(new File([blob], file.name, { type: 'image/jpeg' }))
      setImgPrev(URL.createObjectURL(blob))
    } catch { toast.error('Lỗi xử lý ảnh') }
    finally { setResizing(false) }
  }

  const total = Number(form.qty || 1) * Number(form.sell_price || 0)
  const owed  = total - (Number(form.deposit) || 0)

  const handleSubmit = async () => {
    if (form.mode === 'stock' && !form.jewelry_id) { toast.error('Chọn sản phẩm trong kho'); return }
    if (form.mode === 'order' && !form.item_name.trim()) { toast.error('Nhập tên hàng'); return }
    if (!form.sell_price) { toast.error('Nhập giá bán'); return }

    // Chặn sớm trên giao diện — DB vẫn kiểm tra lại lần nữa
    if (form.mode === 'stock' && picked) {
      const want = Number(form.qty) || 1
      const cap  = editSale?.delivered
        ? (Number(picked.stock_qty) || 0) + (Number(editSale.qty) || 0)  // đã giao: cộng lại phần đã trừ
        : pickedAvail
      if (want > cap) {
        toast.error(`Chỉ còn ${cap} cái — không bán quá số này`)
        return
      }
    }

    setSaving(true)
    try {
      if (editSale) {
        await updateSale(editSale.id, form)
        toast.success('Đã cập nhật đơn')
      } else {
        let item_image = null
        if (imgFile) {
          try { item_image = await uploadImage(imgFile, form.item_name.trim() || 'order') }
          catch { toast.error('Ảnh chưa lưu được — đơn vẫn được tạo') }
        }
        await createSale({
          ...form,
          jewelry_id: form.mode === 'stock' ? form.jewelry_id : null,
          item_name:  form.mode === 'order' ? form.item_name : null,
          item_image,
        })
        toast.success('Đã tạo đơn')
      }
      onSaved()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editSale ? 'Sửa đơn' : 'Đơn hàng mới'}>
      <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[75vh]">

        {/* Chọn loại hàng */}
        {!editSale && (
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {[['stock','Hàng có sẵn'],['order','Hàng order']].map(([id,label]) => (
              <button key={id} onClick={() => { f('mode', id); f('jewelry_id',''); f('item_name','') }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors
                  ${form.mode===id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Hàng có sẵn: chọn SP */}
        {form.mode === 'stock' && (
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Sản phẩm *</label>
            {picked ? (
              <div onClick={() => !editSale && setPickOpen(true)}
                className="flex items-center gap-2.5 px-3 py-2 bg-purple-50 rounded-xl cursor-pointer">
                {picked.image_url
                  ? <img src={thumbUrl(picked.image_url,80)} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0"/>
                  : <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Diamond size={15} className="text-purple-400"/>
                    </div>}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-purple-800">{picked.code}</div>
                  <div className="text-[10px] text-purple-500">
                    {picked.name}{picked.size ? ` · size ${picked.size}` : ''}
                    {picked.status === 'ordered'
                      ? ` · Đang về ${picked.stock_qty}`
                      : ` · Còn bán ${pickedAvail}`}
                  </div>
                </div>
                {!editSale && <ChevronDown size={14} className="text-purple-400 flex-shrink-0"/>}
              </div>
            ) : (
              <button onClick={() => setPickOpen(true)}
                className="w-full px-3 py-2.5 border border-dashed border-gray-300 rounded-xl
                  text-xs text-gray-400 text-left active:scale-98">
                Bấm để chọn sản phẩm...
              </button>
            )}
          </div>
        )}

        {/* Hàng order: tên + ảnh */}
        {form.mode === 'order' && (
          <>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1">Tên hàng *</label>
              <input value={form.item_name} onChange={e=>f('item_name',e.target.value)}
                placeholder="Nhẫn kim cương 2 carat..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
            </div>
            {!editSale && (
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Ảnh mẫu — tùy chọn</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
                <div onClick={() => fileRef.current?.click()} className="cursor-pointer">
                  {imgPrev ? (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                      <img src={imgPrev} alt="" className="w-full h-full object-cover"/>
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
                        {resizing ? 'Đang xử lý...' : 'Đổi ảnh'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200
                      flex flex-col items-center justify-center gap-1 text-gray-400">
                      {resizing ? <RefreshCw size={18} className="animate-spin text-purple-400"/>
                        : <><Camera size={18}/><span className="text-[11px]">Chọn ảnh mẫu</span></>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Khách hàng */}
        <div className="border-t border-gray-100 pt-2"/>
        <div className="relative">
          <label className="text-[11px] text-gray-500 block mb-1">Tên khách</label>
          <input value={form.customer_name} onChange={e=>onCustInput(e.target.value)}
            onFocus={() => form.customer_name && setAcShow(true)}
            onBlur={() => setTimeout(() => setAcShow(false), 150)}
            placeholder="Gõ tên khách..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          {acShow && acList.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl
              z-30 shadow-lg mt-0.5 max-h-40 overflow-y-auto">
              {acList.map(n => (
                <div key={n} onMouseDown={() => { f('customer_name', n); setAcShow(false) }}
                  className="px-3 py-2.5 text-sm text-gray-700 border-b border-gray-100 last:border-0
                    cursor-pointer hover:bg-purple-50">
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">SĐT / Zalo — tùy chọn</label>
          <input type="tel" value={form.customer_phone} onChange={e=>f('customer_phone',e.target.value)}
            placeholder="0912..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        {/* Tiền */}
        <div className="border-t border-gray-100 pt-2"/>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">
              Số lượng
              {form.mode === 'stock' && picked && (
                <span className="text-gray-400"> · tối đa {
                  editSale?.delivered
                    ? (Number(picked.stock_qty)||0) + (Number(editSale.qty)||0)
                    : pickedAvail
                }</span>
              )}
            </label>
            <input type="number" min="1" value={form.qty} onChange={e=>f('qty',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Giá bán (đ) *</label>
            <input type="text" inputMode="numeric" value={fmtInput(form.sell_price)}
              onChange={e=>f('sell_price', parseInput(e.target.value))}
              placeholder="3.200.000" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tiền cọc (đ) — tùy chọn</label>
          <input type="text" inputMode="numeric" value={fmtInput(form.deposit)}
            onChange={e=>f('deposit', parseInput(e.target.value))}
            placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        {total > 0 && (
          <div className="bg-purple-50 rounded-xl py-2 px-3 text-xs text-purple-700 text-center font-semibold">
            Tổng: {fmtMoney(total)}
            {Number(form.deposit) > 0 && <span className="font-normal"> · còn lại {fmtMoney(owed)}</span>}
          </div>
        )}

        {/* Ngày */}
        <div className="border-t border-gray-100 pt-2"/>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Ngày chốt đơn</label>
            <input type="date" value={form.sold_at} onChange={e=>f('sold_at',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Hẹn giao — tùy chọn</label>
            <input type="date" value={form.due_date} onChange={e=>f('due_date',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>

        {/* Trạng thái ban đầu */}
        {!editSale && (
          <>
            <div className="border-t border-gray-100 pt-2"/>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Trạng thái</div>
            <div className="flex gap-2">
              <button onClick={() => picked?.status !== 'ordered' && f('delivered', !form.delivered)}
                disabled={picked?.status === 'ordered'}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border flex items-center
                  justify-center gap-1.5 active:scale-95 disabled:opacity-60
                  ${form.delivered ? 'bg-green-50 text-green-700 border-green-200'
                                   : 'bg-white text-gray-400 border-gray-200'}`}>
                {form.delivered ? <Check size={13}/> : <Truck size={13}/>}
                {picked?.status === 'ordered' ? 'Chờ hàng về' : (form.delivered ? 'Đã giao' : 'Chưa giao')}
              </button>
              <button onClick={() => f('paid', !form.paid)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border flex items-center
                  justify-center gap-1.5 active:scale-95
                  ${form.paid ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-white text-gray-400 border-gray-200'}`}>
                {form.paid ? <Check size={13}/> : <Wallet size={13}/>}
                {form.paid ? 'Đã thu đủ' : 'Chưa thu'}
              </button>
            </div>
          </>
        )}

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
          <input value={form.note} onChange={e=>f('note',e.target.value)}
            placeholder="Giảm giá, khắc chữ..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.sell_price}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? '...' : editSale ? 'Lưu thay đổi' : 'Tạo đơn'}
          </button>
        </div>
      </div>

      {pickOpen && (
        <PickJewelryModal jewelry={jewelry} sales={allSales}
          onPick={j => {
            setForm(prev => ({
              ...prev,
              jewelry_id: j.id,
              sell_price: prev.sell_price || String(j.sell_price || ''),
              // Hàng đang về → chưa thể giao ngay
              delivered:  j.status === 'ordered' ? false : prev.delivered,
            }))
            setPickOpen(false)
          }}
          onClose={() => setPickOpen(false)}/>
      )}
    </Modal>
  )
}

// ============================================
// IMPORT MODAL — nhập hàng loạt từ CSV
// ============================================
function ImportModal({ isOpen, existingCodes, categories, defaultStatus, activeTrip, onClose, onRefresh, toast }) {
  const [rows,    setRows]    = useState([])
  const [err,     setErr]     = useState('')
  const [fileName,setFileName]= useState('')
  const [status,  setStatus]  = useState('in_stock')
  const [useTrip, setUseTrip] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    setRows([]); setErr(''); setFileName(''); setResult(null)
    setStatus(defaultStatus || 'in_stock')
    setUseTrip(true)
  }, [isOpen, defaultStatus])

  const okRows  = rows.filter(r => r.ok)
  const badRows = rows.filter(r => !r.ok)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const { rows: parsed, error } = parseCsv(String(ev.target.result), {
        existingCodes, categories,
      })
      if (error) { setErr(error); setRows([]) }
      else       { setErr(''); setRows(parsed) }
    }
    reader.onerror = () => setErr('Không đọc được file')
    reader.readAsText(file, 'utf-8')
    e.target.value = ''   // cho phép chọn lại cùng file
  }

  const handleSave = async () => {
    if (okRows.length === 0) return
    setSaving(true)
    try {
      const r = await bulkCreateJewelry(okRows, {
        status,
        trip_id: useTrip && activeTrip ? activeTrip.id : null,
      })
      setResult(r)
      if (r.failed.length === 0) toast.success(`Đã nhập ${r.inserted} sản phẩm`)
      else                       toast.error(`${r.inserted} thành công, ${r.failed.length} lỗi`)
      // Luôn báo cho danh sách tải lại — kể cả khi có dòng lỗi,
      // vì những dòng thành công đã nằm trong kho rồi
      if (r.inserted > 0) onRefresh()
    } catch (e) { toast.error('Lỗi: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nhập hàng từ file">
      <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[75vh]">

        <input ref={fileRef} type="file" accept=".csv,text/csv,application/vnd.ms-excel,text/plain"
          className="hidden" onChange={handleFile}/>

        {/* Hai nút chính — ẩn bớt sau khi đã có dữ liệu */}
        {!result && (
          <div className="flex gap-2">
            <button onClick={() => downloadCsvTemplate()}
              className="flex-1 py-2.5 bg-white border border-purple-200 text-purple-600 rounded-xl
                text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98">
              <Download size={14}/> Tải mẫu
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl
                text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-98">
              <Upload size={14}/> {rows.length ? 'Chọn file khác' : 'Chọn file'}
            </button>
          </div>
        )}

        {fileName && !result && (
          <div className="text-[10px] text-gray-400 text-center truncate">📄 {fileName}</div>
        )}

        {/* Hướng dẫn — chỉ hiện khi chưa chọn file */}
        {rows.length === 0 && !result && (
          <details className="bg-gray-50 rounded-xl px-3 py-2">
            <summary className="text-[11px] font-semibold text-gray-600 cursor-pointer">
              Cách làm &amp; các cột trong file
            </summary>
            <p className="text-[10px] text-gray-500 leading-relaxed mt-2 mb-2">
              Tải mẫu về, mở bằng Excel, mỗi dòng một sản phẩm, lưu lại dạng CSV rồi chọn file đó.
              Ảnh không nhập được qua file — thêm sau ở từng sản phẩm.
            </p>
            <div className="space-y-0.5">
              {CSV_COLUMNS.map(c => (
                <div key={c.key} className="flex justify-between text-[10px] py-0.5 border-b border-gray-200 last:border-0">
                  <span className="font-mono text-gray-700">{c.label}</span>
                  <span className="text-gray-400">
                    {c.required ? <b className="text-red-500">bắt buộc</b> : c.example}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {err && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700">
            {err}
          </div>
        )}

        {/* Xem trước */}
        {rows.length > 0 && !result && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 bg-green-50 rounded-xl px-3 py-2">
                <div className="text-[10px] text-green-600">Hợp lệ</div>
                <div className="text-lg font-bold text-green-700">{okRows.length}</div>
              </div>
              <div className={`flex-1 rounded-xl px-3 py-2 ${badRows.length ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`text-[10px] ${badRows.length ? 'text-red-600' : 'text-gray-400'}`}>Lỗi</div>
                <div className={`text-lg font-bold ${badRows.length ? 'text-red-700' : 'text-gray-300'}`}>
                  {badRows.length}
                </div>
              </div>
            </div>

            {badRows.length > 0 && (
              <div className="bg-red-50 rounded-xl p-2.5 max-h-32 overflow-y-auto">
                <div className="text-[10px] font-semibold text-red-700 mb-1 flex items-center gap-1">
                  <AlertTriangle size={11}/> Dòng có lỗi — sẽ bỏ qua
                </div>
                {badRows.slice(0, 20).map(r => (
                  <div key={r.line} className="text-[10px] text-red-600 py-0.5">
                    Dòng {r.line}: <b>{r.data.code || '(trống)'}</b> — {r.errors.join(', ')}
                  </div>
                ))}
                {badRows.length > 20 && (
                  <div className="text-[10px] text-red-400 pt-1">…và {badRows.length - 20} dòng nữa</div>
                )}
              </div>
            )}

            {okRows.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-3 py-1.5 bg-gray-50 text-[10px] font-semibold text-gray-500">
                  Xem trước {Math.min(okRows.length, 8)}/{okRows.length} dòng
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {okRows.slice(0, 8).map(r => (
                    <div key={r.line} className="px-3 py-2 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="text-[11px] font-semibold text-gray-800 truncate">
                          {r.data.code}{r.data.name ? ` · ${r.data.name}` : ''}
                        </span>
                        <span className="text-[11px] text-purple-600 font-medium flex-shrink-0">
                          {r.data.sell_price ? fmtMoney(r.data.sell_price) : '—'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {[
                          r.data.category,
                          r.data.size ? `size ${r.data.size}` : null,
                          `SL ${r.data.stock_qty}`,
                          r.data.supplier_name,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tuỳ chọn khi lưu */}
            <div className="border-t border-gray-100 pt-2"/>
            <div>
              <label className="text-[11px] text-gray-500 block mb-1.5">Nhập vào</label>
              <div className="flex gap-2">
                {[['in_stock','Kho hàng'],['ordered','Hàng đang về']].map(([id,label]) => (
                  <button key={id} onClick={() => setStatus(id)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-medium border active:scale-98
                      ${status===id ? 'bg-purple-600 text-white border-purple-600 font-semibold'
                                    : 'bg-white text-gray-500 border-gray-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {activeTrip && (
              <button onClick={() => setUseTrip(v => !v)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border active:scale-98
                  ${useTrip ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0
                  ${useTrip ? 'bg-green-500' : 'border border-gray-300'}`}>
                  {useTrip && <Check size={11} className="text-white"/>}
                </div>
                <span className={`text-[11px] flex-1 text-left ${useTrip ? 'text-green-800' : 'text-gray-500'}`}>
                  Gắn vào chuyến <b>{activeTrip.name}</b>
                </span>
              </button>
            )}
          </>
        )}

        {/* Kết quả */}
        {result && (
          <div className="space-y-2">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">✅</div>
              <div className="text-sm font-semibold text-green-800">
                Đã nhập {result.inserted} sản phẩm
              </div>
            </div>
            {result.failed.length > 0 && (
              <div className="bg-red-50 rounded-xl p-2.5 max-h-32 overflow-y-auto">
                <div className="text-[10px] font-semibold text-red-700 mb-1">
                  {result.failed.length} dòng không lưu được
                </div>
                {result.failed.map((f,i) => (
                  <div key={i} className="text-[10px] text-red-600 py-0.5">
                    <b>{f.code}</b> — {f.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            {result ? 'Đóng' : 'Huỷ'}
          </button>
          {!result && (
            <button onClick={handleSave} disabled={saving || okRows.length === 0}
              className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-40">
              {saving ? 'Đang lưu...' : `Lưu ${okRows.length} sản phẩm`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// CATEGORY MANAGER
// ============================================
function CategoryManager({ isOpen, categories, jewelry = [], onClose, onSaved, toast }) {
  const [cats,    setCats]    = useState([])
  const [newCat,  setNewCat]  = useState('')
  const [editing, setEditing] = useState(null) // index đang sửa tên
  const [editVal, setEditVal] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (isOpen) { setCats([...categories]); setNewCat(''); setEditing(null) }
  }, [isOpen, categories])

  const handleAdd = () => {
    const t = newCat.trim()
    if (!t || cats.includes(t)) return
    setCats(v => [...v, t]); setNewCat('')
  }

  const handleDelete = (i) => {
    const count = jewelry.filter(j => j.category === cats[i]).length
    const msg = count > 0
      ? `Xoá loại "${cats[i]}"?\n${count} sản phẩm đang dùng loại này — chúng không bị xoá nhưng filter sẽ không tìm thấy.`
      : `Xoá loại "${cats[i]}"?`
    if (!confirm(msg)) return
    setCats(v => v.filter((_,idx) => idx !== i))
  }

  const handleRename = (i) => {
    const t = editVal.trim()
    if (!t || (cats.includes(t) && t !== cats[i])) return
    setCats(v => { const n=[...v]; n[i]=t; return n })
    setEditing(null)
  }

  const handleSave = async () => {
    if (cats.length === 0) { toast.error('Cần ít nhất 1 loại'); return }
    setSaving(true)
    try {
      await saveJewelryCategories(cats)
      toast.success('Đã lưu danh sách loại')
      onSaved(cats)
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚙️ Quản lý loại trang sức">
      <div className="px-5 pb-5 space-y-2">
        {/* Danh sách loại */}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {cats.map((cat, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              {editing === i ? (
                <>
                  <input value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') handleRename(i); if(e.key==='Escape') setEditing(null) }}
                    className="flex-1 text-sm px-2 py-1 border border-purple-300 rounded-lg focus:outline-none"
                    autoFocus/>
                  <button onClick={() => handleRename(i)}
                    className="text-[11px] font-semibold text-purple-600 px-2 py-1 bg-purple-50 rounded-lg active:scale-95">
                    Lưu
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="text-[11px] text-gray-400 px-2 py-1 active:scale-95">
                    Huỷ
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800 font-medium">{cat}</span>
                  <button onClick={() => { setEditing(i); setEditVal(cat) }}
                    className="p-1.5 text-gray-400 hover:text-purple-600 active:scale-90">
                    <Edit2 size={13}/>
                  </button>
                  <button onClick={() => handleDelete(i)}
                    className="p-1.5 text-gray-400 hover:text-red-500 active:scale-90">
                    <Trash2 size={13}/>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Thêm loại mới */}
        <div className="flex gap-2 pt-1">
          <input value={newCat} onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Tên loại mới..."
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-purple-400"/>
          <button onClick={handleAdd} disabled={!newCat.trim()}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold
              disabled:opacity-40 active:scale-95">
            + Thêm
          </button>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// PICK JEWELRY MODAL — kho + hàng đang về
// ============================================
function PickJewelryModal({ jewelry, sales = [], onPick, onClose }) {
  const [q, setQ] = useState('')

  const match = j =>
    j.code.toLowerCase().includes(q.toLowerCase()) ||
    j.name?.toLowerCase().includes(q.toLowerCase())

  // Số đã bán chưa giao theo từng SP
  const reservedMap = {}
  sales.filter(s => !s.delivered && s.jewelry_id).forEach(s => {
    reservedMap[s.jewelry_id] = (reservedMap[s.jewelry_id] || 0) + (Number(s.qty) || 0)
  })
  const availOf = j => Math.max(0, (Number(j.stock_qty) || 0) - (reservedMap[j.id] || 0))

  const inStock  = jewelry.filter(j => j.status !== 'ordered' && availOf(j) > 0 && match(j))
  const incoming = jewelry.filter(j => j.status === 'ordered' && match(j))
  const fmtDate  = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}` }

  const Row = ({ j, incoming: inc }) => (
    <div onClick={() => onPick(j)}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer active:scale-98 transition-transform
        ${inc ? 'bg-purple-50 border border-purple-200' : 'active:bg-gray-50'}`}>
      {j.image_url
        ? <img src={thumbUrl(j.image_url,80)} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
        : <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
            ${inc ? 'bg-purple-100' : 'bg-gray-100'}`}>
            <Diamond size={16} className={inc ? 'text-purple-400' : 'text-gray-300'}/>
          </div>}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${inc ? 'text-purple-800' : 'text-gray-800'}`}>{j.code}</div>
        <div className={`text-xs truncate ${inc ? 'text-purple-500' : 'text-gray-500'}`}>
          {j.name}
          {j.size ? ` · ${j.size}` : ''}
          {inc && j.eta_date ? ` · về ${fmtDate(j.eta_date)}` : ''}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-semibold ${inc ? 'text-purple-600' : 'text-green-600'}`}>
          {fmtMoney(j.sell_price||0)}
        </div>
        <div className={`text-[10px] ${inc ? 'text-purple-500 font-medium' : 'text-gray-400'}`}>
          {inc ? `Đang về ${j.stock_qty}` : `Còn ${availOf(j)}`}
        </div>
      </div>
    </div>
  )

  return (
    <Modal isOpen={true} onClose={onClose} title="Chọn sản phẩm">
      <div className="px-4 pb-4">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm mã hoặc tên..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm mb-3"/>

        <div className="space-y-1 max-h-72 overflow-y-auto">
          {inStock.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 pb-1">
                Trong kho
              </div>
              {inStock.map(j => <Row key={j.id} j={j}/>)}
            </>
          )}

          {incoming.length > 0 && (
            <>
              <div className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider px-1 pt-2 pb-1">
                Đang về — bán trước được
              </div>
              {incoming.map(j => <Row key={j.id} j={j} incoming/>)}
            </>
          )}

          {inStock.length === 0 && incoming.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">Không tìm thấy</div>
          )}
        </div>

        {incoming.length > 0 && (
          <div className="mt-3 px-3 py-2 bg-amber-50 rounded-xl text-[10px] text-amber-800 leading-relaxed">
            Bán hàng đang về → đơn tự đánh dấu <b>Chưa giao</b>. Khi hàng về kho, tick giao cho khách.
          </div>
        )}
      </div>
    </Modal>
  )
}
