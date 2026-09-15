// ============================================
// JEWELRY MODULE - Quản lý Trang Sức
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Diamond, Plus, Trash2, Edit2, ChevronDown, ChevronLeft, Settings,
  RefreshCw, Tag, Package, Search, X,
  ArrowUpCircle, Camera, Clock, BarChart3,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { getLocalDateString } from '../lib/helpers'
import {
  getJewelry, createJewelry, updateJewelry, deleteJewelry,
  getJewelrySales, createSale, deleteSale,
  getJewelryTrips, createJewelryTrip, updateJewelryTrip, deleteJewelryTrip,
  getJewelryCategories, saveJewelryCategories, DEFAULT_CATEGORIES,
  getCustomerNotes, saveCustomerNote,
  getActiveTrip, setActiveTrip,
  uploadImage, thumbUrl, resizeImage,
  calcStats, getCustomerNames, fmtMoney, CATEGORIES,
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
  const [detail,   setDetail]   = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [sellItem, setSellItem] = useState(null)
  const [activeTrip, setActiveTripState] = useState(() => getActiveTrip())
  const [showTripPicker, setShowTripPicker] = useState(false)
  const [categories,    setCategories]    = useState(DEFAULT_CATEGORIES)
  const [showCatMgr,    setShowCatMgr]    = useState(false)
  const [customerNotes, setCustomerNotes] = useState({})

  useEffect(() => {
    getJewelryCategories().then(setCategories).catch(() => {})
    getCustomerNotes().then(setCustomerNotes).catch(() => {})
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
    if (!confirm(`Xoá "${item.code}"? Lịch sử bán sẽ xoá theo.`)) return
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
            {[['kho','Kho hàng'],['ban','Bán hàng'],['khach','Khách'],['bc','Báo cáo'],['trips','Chuyến']].map(([id,label]) => (
              <button key={id} onClick={() => setModTab(id)}
                className={`flex-1 min-w-fit px-2 py-2.5 text-xs text-center border-b-2 whitespace-nowrap
                  ${modTab===id ? 'border-purple-600 text-purple-600 font-semibold' : 'border-transparent text-gray-400'}`}>
                {label}
              </button>
            ))}
          </div>
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
        <KhoTab items={stats.withDays}
          categories={categories}
          onSelect={setDetail}
          onAdd={() => { setEditing(null); setShowAdd(true) }}
          onEdit={item => { setEditing(item); setShowAdd(true) }}
          onDelete={handleDelete}
          activeTrip={activeTrip}
          onPickTrip={() => setShowTripPicker(true)}
          onEndTrip={handleEndTrip}/>
      ) : modTab === 'ban' ? (
        <BanTab sales={sales}/>
      ) : modTab === 'khach' ? (
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
      ) : modTab === 'trips' ? (
        <TripsTab trips={trips} jewelry={jewelry}
          activeTrip={activeTrip}
          onSelect={handleSetTrip}
          onRefresh={loadData}
          toast={toast}/>
      ) : (
        <BcTab stats={stats}/>
      )}

      {/* FAB */}
      {!detail && modTab === 'kho' && (
        <button onClick={() => { setEditing(null); setShowAdd(true) }}
          className="fixed right-4 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center z-20"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px))' }}>
          <Plus size={22}/>
        </button>
      )}
      {!detail && modTab === 'ban' && (
        <button onClick={() => setSellItem('pick')}
          className="fixed right-4 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center z-20"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px))' }}>
          <Plus size={22}/>
        </button>
      )}

      {/* Modals */}
      <JewelryForm isOpen={showAdd}
        onClose={() => { setShowAdd(false); setEditing(null) }}
        item={editing}
        trips={trips}
        categories={categories}
        activeTrip={activeTrip}
        onSaved={() => { setShowAdd(false); setEditing(null); loadData() }}
        toast={toast}/>
      <CategoryManager isOpen={showCatMgr}
        categories={categories}
        jewelry={jewelry}
        onClose={() => setShowCatMgr(false)}
        onSaved={cats => { setCategories(cats); setShowCatMgr(false) }}
        toast={toast}/>
      <SaleForm isOpen={!!sellItem && sellItem !== 'pick'}
        item={sellItem === 'pick' ? null : sellItem}
        customerNames={custNames}
        onClose={() => setSellItem(null)}
        onSaved={() => { setSellItem(null); loadData() }}
        toast={toast}/>
      {sellItem === 'pick' && (
        <PickJewelryModal jewelry={jewelry.filter(j => j.stock_qty > 0)}
          onPick={j => setSellItem(j)}
          onClose={() => setSellItem(null)}/>
      )}
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
      case 'stock':   return [...list].sort((a,b) => b.stock_remaining - a.stock_remaining)
      case 'price_h': return [...list].sort((a,b) => (b.sell_price||0) - (a.sell_price||0))
      case 'price_l': return [...list].sort((a,b) => (a.sell_price||0) - (b.sell_price||0))
      default:        return [...list].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    }
  }, [jewelry, cat, sort, search])

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
          ['Còn tồn', jewelry.filter(j=>j.stock_remaining>0).length, 'text-green-600'],
          ['Hết hàng', jewelry.filter(j=>j.stock_remaining<=0).length, 'text-red-500'],
          ['Tồn lâu >30n', jewelry.filter(j=>j.stock_remaining>0&&j.days_in_stock>=30).length, 'text-amber-600'],
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
        <span className="text-[10px] text-gray-400">
          {filtered.length} sản phẩm{search && ` · "${search}"`}
        </span>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="new">Mới thêm trước</option>
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
            const s = item.stock_remaining
            const level = s <= 0 ? 'out' : s <= 1 ? 'low' : 'ok'
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div onClick={() => onSelect(item)}
                  className="aspect-square relative bg-gradient-to-br from-purple-50 to-purple-200
                    flex items-center justify-center overflow-hidden cursor-pointer">
                  {item.image_url
                    ? <img src={thumbUrl(item.image_url, 300)} alt={item.code} className="w-full h-full object-cover"/>
                    : <Diamond size={34} className="text-purple-300"/>
                  }
                  <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full
                    ${level==='out' ? 'bg-red-100 text-red-600' : level==='low' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {s <= 0 ? 'Hết' : `Còn ${s}`}
                  </span>
                  {item.days_in_stock >= 30 && s > 0 && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
                      {item.days_in_stock}n
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
// BÁN HÀNG TAB
// ============================================
function BanTab({ sales }) {
  const { monthSales, monthRev } = useMemo(() => {
    const m = new Date().toISOString().slice(0,7)
    const list = sales.filter(s => s.sold_at?.startsWith(m))
    return { monthSales: list, monthRev: list.reduce((s,x) => s+Number(x.qty)*Number(x.sell_price),0) }
  }, [sales])
  const fmtDate = d => { if(!d) return ''; const [y,mo,day]=d.split('-'); return `${day}/${mo}/${y.slice(2)}` }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Tháng này</div>
          <div className="text-lg font-semibold text-green-600 mt-0.5">{fmtMoney(monthRev)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Số đơn</div>
          <div className="text-lg font-semibold text-purple-600 mt-0.5">{monthSales.length}</div>
        </div>
      </div>
      <div className="px-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Lịch sử bán</div>
      {sales.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Chưa có đơn bán nào</div>
      ) : sales.map(s => (
        <div key={s.id} className="bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <Tag size={13} className="text-green-600"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">
                {s.jewelry?.code}{s.jewelry?.name ? ` · ${s.jewelry.name}` : ''}
              </div>
              <div className="text-[10px] text-gray-400">
                {fmtDate(s.sold_at)} · {s.customer_name || 'Khách lẻ'} · {s.qty} cái
              </div>
            </div>
            <div className="text-xs font-semibold text-green-600 flex-shrink-0">
              {fmtMoney(Number(s.qty)*Number(s.sell_price))}
            </div>
          </div>
          {s.note && <div className="text-[10px] text-gray-400 italic mt-1 pl-9">💬 {s.note}</div>}
        </div>
      ))}
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
        {[['tong','Tổng hợp'],['chay','Bán chạy'],['ton','Tồn lâu'],['xn','Lịch sử bán']].map(([id,label]) => (
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
              ['Doanh thu tháng này', fmtMoney(stats.monthRevenue), 'text-green-600'],
              ['Tổng doanh thu', fmtMoney(stats.totalRevenue), 'text-green-600'],
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
                {fmtMoney(stats.slowMoving.reduce((s,j)=>s+(j.stock_remaining*(j.sell_price||0)),0))}
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
                    Tồn {j.stock_remaining} · {j.supplier_name || 'NCC chưa ghi'}
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

      {bcTab === 'xn' && (
        <>
          <div className="bg-white rounded-xl border border-gray-100 mx-3 mt-3 overflow-hidden">
            <div className="flex justify-between px-4 py-2.5 border-b border-gray-100">
              <span className="text-xs text-gray-500">Tổng bán ra</span>
              <span className="text-xs font-semibold text-green-600">
                {stats.totalSold} món · {fmtMoney(stats.totalRevenue)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-xs text-gray-500">Còn tồn</span>
              <span className="text-xs font-semibold text-amber-600">{stats.inStock} món</span>
            </div>
          </div>
          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Lịch sử bán</div>
          {stats.saleLog.slice(0,30).map((x,i) => (
            <div key={i} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                <ArrowUpCircle size={14} className="text-green-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">
                  {x.code}{x.name ? ` · ${x.name}` : ''}
                </div>
                <div className="text-[10px] text-gray-400">
                  {fmtDate(x.date)} · {x.customer || 'Khách lẻ'} · {x.qty} cái
                </div>
              </div>
              <span className="text-xs font-semibold text-green-600 flex-shrink-0">{fmtMoney(x.revenue)}</span>
            </div>
          ))}
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
  const sold    = sales.reduce((s,x) => s + Number(x.qty), 0)
  const revenue = sales.reduce((s,x) => s + Number(x.qty)*Number(x.sell_price), 0)
  const tripName = item.trip_name || trips.find(t => t.id === item.trip_id)?.name

  return (
    <div>
      <div className="w-full aspect-square relative bg-gradient-to-br from-purple-50 to-purple-200
        flex items-center justify-center overflow-hidden">
        {item.image_url
          ? <img src={thumbUrl(item.image_url, 800)} alt={item.code} className="w-full h-full object-cover"/>
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
          ['Tồn kho', `${item.stock_qty} cái`, item.stock_qty > 0 ? 'text-green-600' : 'text-red-500'],
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
        {item.stock_qty > 0 && (
          <button onClick={onSell}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95">
            Ghi bán
          </button>
        )}
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
            <div className="text-xs font-semibold text-green-600">{fmtMoney(Number(s.qty)*Number(s.sell_price))}</div>
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
function JewelryForm({ isOpen, onClose, item, trips, categories = DEFAULT_CATEGORIES, activeTrip, onSaved, toast }) {
  const EMPTY = {
    code:'', category:'Nhẫn', name:'', size:'', stock_qty:1,
    cost_price:'', sell_price:'', supplier_name:'', supplier_contact:'',
    trip_id:'', note:''
  }
  const [form,    setForm]    = useState(EMPTY)
  const [imgFile, setImgFile] = useState(null)
  const [imgPrev, setImgPrev] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [resizing,setResizing]= useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    if (item) {
      setForm({
        code: item.code||'', category: item.category||'Nhẫn', name: item.name||'',
        size: item.size||'', stock_qty: item.stock_qty||1, cost_price: item.cost_price||'',
        sell_price: item.sell_price||'', supplier_name: item.supplier_name||'',
        supplier_contact: item.supplier_contact||'', trip_id: item.trip_id||'', note: item.note||'',
      })
      setImgPrev(item.image_url || null)
    } else {
      setForm({ ...EMPTY, trip_id: activeTrip?.id || '' })
      setImgPrev(null)
    }
    setImgFile(null)
  }, [isOpen, item, activeTrip])

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
      let image_url = item?.image_url || null
      if (imgFile) image_url = await uploadImage(imgFile, form.code.trim())
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
      }
      if (item) await updateJewelry(item.id, payload)
      else       await createJewelry(payload)
      toast.success(item ? 'Đã cập nhật' : 'Đã thêm sản phẩm')
      onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? `Sửa ${item.code}` : 'Thêm trang sức'}>
      <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[70vh]">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
        <div onClick={() => fileRef.current?.click()} className="cursor-pointer">
          {imgPrev ? (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden">
              <img src={imgPrev} alt="" className="w-full h-full object-cover"/>
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
            <label className="text-[11px] text-gray-500 block mb-1">Số lượng</label>
            <input type="number" value={form.stock_qty} onChange={e=>f('stock_qty',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Giá vốn (đ)</label>
            <input type="number" value={form.cost_price} onChange={e=>f('cost_price',e.target.value)}
              placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Giá bán (đ)</label>
          <input type="number" value={form.sell_price} onChange={e=>f('sell_price',e.target.value)}
            placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="border-t border-gray-100 pt-2"/>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nhà cung cấp</div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tên NCC</label>
          <input value={form.supplier_name} onChange={e=>f('supplier_name',e.target.value)}
            placeholder="Kim Thanh HN..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">SĐT / Zalo</label>
            <input type="tel" value={form.supplier_contact} onChange={e=>f('supplier_contact',e.target.value)}
              placeholder="0912..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>

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
// SALE FORM
// ============================================
function SaleForm({ isOpen, item, customerNames, onClose, onSaved, toast }) {
  const [form,   setForm]   = useState({ qty:1, sell_price:'', customer_name:'', note:'', sold_at:'' })
  const [saving, setSaving] = useState(false)
  const [acShow, setAcShow] = useState(false)
  const [acList, setAcList] = useState([])
  const custRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    setForm({ qty:1, sell_price: item?.sell_price||'', customer_name:'', note:'', sold_at: getLocalDateString() })
    setAcShow(false)
  }, [isOpen, item])

  const onCustInput = (v) => {
    setForm(p => ({ ...p, customer_name: v }))
    if (!v.trim()) { setAcShow(false); return }
    setAcList(customerNames.filter(n => n.toLowerCase().includes(v.toLowerCase())))
    setAcShow(true)
  }

  const totalPrice = Number(form.qty||1) * Number(form.sell_price||0)

  const handleSubmit = async () => {
    if (!item) { toast.error('Chưa chọn sản phẩm'); return }
    if (!form.sell_price) { toast.error('Nhập giá bán'); return }
    setSaving(true)
    try {
      await createSale({ ...form, jewelry_id: item.id, qty: Number(form.qty)||1, sell_price: Number(form.sell_price) })
      toast.success('Đã ghi nhận bán')
      onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ghi nhận bán">
      <div className="px-5 pb-6 space-y-3">
        {item && (
          <div className="bg-purple-50 rounded-xl px-4 py-2.5 text-xs text-purple-700">
            <span className="font-semibold">{item.code}</span>
            {item.name && ` · ${item.name}`}
            {item.size && <span className="ml-1 px-1.5 py-0.5 bg-purple-100 rounded-full">{item.size}</span>}
            {' · '}Còn {item.stock_qty} cái
          </div>
        )}
        <div className="relative" ref={custRef}>
          <label className="text-[11px] text-gray-500 block mb-1">Tên khách</label>
          <input value={form.customer_name} onChange={e=>onCustInput(e.target.value)}
            onFocus={() => form.customer_name && setAcShow(true)}
            placeholder="Gõ tên khách..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          {acShow && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl z-20 shadow-lg mt-0.5 max-h-40 overflow-y-auto">
              {acList.map(name => (
                <div key={name} onClick={() => { setForm(p=>({...p,customer_name:name})); setAcShow(false) }}
                  className="px-3 py-2.5 text-sm text-gray-700 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50">
                  {name}
                </div>
              ))}
              {form.customer_name && !acList.includes(form.customer_name) && (
                <div onClick={() => setAcShow(false)}
                  className="px-3 py-2.5 text-sm text-purple-600 font-medium cursor-pointer hover:bg-purple-50">
                  + Thêm "{form.customer_name}" mới
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Số lượng</label>
            <input type="number" min="1" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Giá bán (đ) *</label>
            <input type="number" value={form.sell_price} onChange={e=>setForm(p=>({...p,sell_price:e.target.value}))}
              placeholder="3200000" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>
        {totalPrice > 0 && (
          <div className="text-xs text-center text-purple-600 font-semibold bg-purple-50 rounded-lg py-2">
            Tổng: {fmtMoney(totalPrice)}
          </div>
        )}
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ngày bán</label>
          <input type="date" value={form.sold_at} onChange={e=>setForm(p=>({...p,sold_at:e.target.value}))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
          <input value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
            placeholder="Giảm giá, tặng hộp..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Huỷ</button>
          <button onClick={handleSubmit} disabled={saving || !form.sell_price}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? '...' : 'Lưu bán'}
          </button>
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
// PICK JEWELRY MODAL
// ============================================
function PickJewelryModal({ jewelry, onPick, onClose }) {
  const [q, setQ] = useState('')
  const filtered = jewelry.filter(j =>
    j.code.toLowerCase().includes(q.toLowerCase()) ||
    j.name?.toLowerCase().includes(q.toLowerCase()))

  return (
    <Modal isOpen={true} onClose={onClose} title="Chọn sản phẩm">
      <div className="px-4 pb-4">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm mã hoặc tên..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm mb-3"/>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filtered.map(j => (
            <div key={j.id} onClick={() => onPick(j)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer active:bg-purple-50">
              {j.image_url
                ? <img src={thumbUrl(j.image_url,80)} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
                : <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Diamond size={16} className="text-purple-300"/>
                  </div>
              }
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800">{j.code}</div>
                {j.name && <div className="text-xs text-gray-500 truncate">{j.name}</div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-xs font-semibold text-green-600">{fmtMoney(j.sell_price||0)}</div>
                <div className="text-[10px] text-gray-400">Còn {j.stock_qty}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-center py-6 text-gray-400 text-sm">Không tìm thấy</div>}
        </div>
      </div>
    </Modal>
  )
}
