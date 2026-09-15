// ============================================
// JEWELRY MODULE - Quản lý Trang Sức
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Diamond, Plus, Trash2, Edit2, ChevronDown, ChevronLeft,
  RefreshCw, Tag, Users, BarChart3, Package, Search, X,
  ArrowDownCircle, ArrowUpCircle, Camera, AlertTriangle, Clock
} from 'lucide-react'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import { getLocalDateString } from '../lib/helpers'
import {
  getJewelry, createJewelry, updateJewelry, deleteJewelry,
  getJewelrySales, createSale, deleteSale,
  getJewelryImports, createJewelryImport, updateJewelryImport, deleteJewelryImport,
  uploadImage, thumbUrl, resizeImage,
  calcStats, getCustomerNames, fmtMoney, CATEGORIES
} from '../lib/jewelry'

// ============================================
// MAIN PAGE
// ============================================
export default function Jewelry() {
  const toast = useToast()
  const [jewelry,  setJewelry]  = useState([])
  const [sales,    setSales]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modTab,   setModTab]   = useState('kho')    // kho|ban|khach|bc
  const [detail,   setDetail]   = useState(null)     // jewelry item đang xem
  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState(null)
  const [sellItem,   setSellItem]   = useState(null)
  const [importItem, setImportItem] = useState(null)  // item đang nhập lô

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [j, s] = await Promise.all([getJewelry(), getJewelrySales()])
      setJewelry(j); setSales(s)
    } catch (err) { toast.error('Lỗi tải dữ liệu') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const stats   = useMemo(() => calcStats(jewelry, sales), [jewelry, sales])
  const custNames = useMemo(() => getCustomerNames(sales), [sales])

  const handleDelete = async (item) => {
    if (!confirm(`Xóa "${item.code}"? Lịch sử bán sẽ bị xóa theo.`)) return
    try { await deleteJewelry(item.id); toast.success('Đã xóa'); loadData() }
    catch { toast.error('Lỗi') }
  }

  const handleSavedForm = () => {
    setShowAdd(false); setEditing(null); loadData()
  }

  const handleSavedSale = () => {
    setSellItem(null); loadData()
  }

  const handleSavedImport = () => {
    setImportItem(null); loadData()
  }

  // Chi tiết → bán
  const openSell = (item) => { setDetail(null); setSellItem(item) }

  return (
    <div className="min-h-screen bg-gray-50" style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom,0px))' }}>
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3">
          {detail ? (
            <button onClick={() => setDetail(null)} className="p-1 -ml-1 text-purple-600">
              <ChevronLeft size={22}/>
            </button>
          ) : (
            <Diamond size={20} className="text-purple-600" />
          )}
          <h1 className="flex-1 text-base font-semibold text-gray-800">
            {detail ? `${detail.code}${detail.name ? ' · ' + detail.name : ''}` : 'Trang sức'}
          </h1>
          <button onClick={() => loadData()} className="p-2 text-gray-400">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''}/>
          </button>
          {!detail && (
            <button onClick={() => { setEditing(null); setShowAdd(true) }}
              className="p-2 text-gray-400">
              <Plus size={19}/>
            </button>
          )}
        </div>

        {/* Module tabs */}
        {!detail && (
          <div className="flex border-t border-gray-100">
            {[['kho','Kho hàng'],['ban','Bán hàng'],['khach','Khách'],['bc','Báo cáo']].map(([id,label]) => (
              <button key={id} onClick={() => setModTab(id)}
                className={`flex-1 py-2.5 text-xs text-center border-b-2 transition-colors
                  ${modTab===id ? 'border-purple-600 text-purple-600 font-semibold'
                                : 'border-transparent text-gray-400'}`}>
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
        <DetailPanel item={detail} sales={sales.filter(s=>s.jewelry_id===detail.id)}
          onSell={() => openSell(detail)}
          onEdit={() => { setDetail(null); setEditing(detail); setShowAdd(true) }}
          onDelete={() => { handleDelete(detail); setDetail(null) }}
          onImport={() => setImportItem(detail)} />
      ) : modTab === 'kho' ? (
        <KhoTab items={stats.withDays} onSelect={setDetail}
          onAdd={() => { setEditing(null); setShowAdd(true) }}
          onEdit={item => { setEditing(item); setShowAdd(true) }}
          onDelete={handleDelete}
          onImport={item => setImportItem(item)}/>
      ) : modTab === 'ban' ? (
        <BanTab sales={sales} />
      ) : modTab === 'khach' ? (
        <KhachTab customers={stats.customers} />
      ) : (
        <BcTab stats={stats} />
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
      <JewelryForm isOpen={showAdd} onClose={() => { setShowAdd(false); setEditing(null) }}
        item={editing} onSaved={handleSavedForm} toast={toast}/>
      <SaleForm isOpen={!!sellItem && sellItem !== 'pick'}
        item={sellItem === 'pick' ? null : sellItem}
        customerNames={custNames}
        onClose={() => setSellItem(null)}
        onSaved={handleSavedSale} toast={toast}/>
      {sellItem === 'pick' && (
        <PickJewelryModal jewelry={jewelry.filter(j=>j.stock_qty>0)}
          onPick={j => setSellItem(j)}
          onClose={() => setSellItem(null)}/>
      )}
      <ImportForm isOpen={!!importItem} item={importItem}
        onClose={() => setImportItem(null)}
        onSaved={handleSavedImport} toast={toast}/>
    </div>
  )
}

// ============================================
// KHO TAB
// ============================================
function KhoTab({ items: jewelry, onSelect, onAdd, onEdit, onDelete, onImport }) {
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
        j.supplier_name?.toLowerCase().includes(q)
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
    CATEGORIES.forEach(c => { counts[c] = jewelry.filter(j=>j.category===c).length })
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

      {/* Search bar */}
      <div className="px-3 pb-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã, tên, nhà cung cấp..."
            className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-purple-400"/>
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5">
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-0 overflow-x-auto bg-white border-b border-gray-100 px-1"
        style={{ scrollbarWidth: 'none' }}>
        {['Tất cả', ...CATEGORIES].map(c => (
          catCounts[c] > 0 || c === 'Tất cả' ? (
            <button key={c} onClick={() => setCat(c)}
              className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors flex-shrink-0
                ${cat===c ? 'border-purple-600 text-purple-600 font-semibold'
                          : 'border-transparent text-gray-400'}`}>
              {c} {catCounts[c]>0 && `(${catCounts[c]})`}
            </button>
          ) : null
        ))}
      </div>

      {/* Sort bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-100">
        <span className="text-[10px] text-gray-400">
          {filtered.length} sản phẩm{search && ` · kết quả cho "${search}"`}
        </span>
        <select value={sort} onChange={e=>setSort(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="new">Mới nhập trước</option>
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
              <div key={item.id}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* Image — click để vào detail */}
                <div onClick={() => onSelect(item)}
                  className="aspect-square relative bg-gradient-to-br from-purple-50 to-purple-200
                  flex items-center justify-center overflow-hidden cursor-pointer">
                  {item.image_url
                    ? <img src={thumbUrl(item.image_url, 300)} alt={item.code}
                        className="w-full h-full object-cover"/>
                    : <Diamond size={34} className="text-purple-300"/>
                  }
                  <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full
                    ${level==='out' ? 'bg-red-100 text-red-600'
                    : level==='low' ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'}`}>
                    {s <= 0 ? 'Hết' : `Còn ${s}`}
                  </span>
                  {item.days_in_stock >= 30 && s > 0 && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold px-1.5 py-0.5
                      rounded-full bg-amber-500 text-white">{item.days_in_stock}n</span>
                  )}
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full
                    bg-black/40 text-white">{item.category}</span>
                </div>
                {/* Info */}
                <div className="px-2 pt-2 pb-1 cursor-pointer" onClick={() => onSelect(item)}>
                  <div className="text-[11px] font-semibold text-gray-800">{item.code}</div>
                  {item.name && <div className="text-[10px] text-gray-500 truncate">{item.name}</div>}
                  {item.sell_price > 0 && (
                    <div className="text-[10px] text-purple-600 font-medium mt-0.5">
                      {fmtMoney(item.sell_price)}
                    </div>
                  )}
                </div>
                {/* Edit / Delete / Import actions */}
                <div className="flex border-t border-gray-100 mt-1">
                  <button onClick={() => onImport(item)}
                    className="flex-1 py-1.5 text-[10px] text-purple-600 flex items-center justify-center gap-0.5
                      border-r border-gray-100 hover:bg-purple-50 active:scale-95 transition-colors">
                    <ArrowDownCircle size={11}/> Nhập lô
                  </button>
                  <button onClick={() => onEdit(item)}
                    className="flex-1 py-1.5 text-[10px] text-gray-500 flex items-center justify-center gap-0.5
                      border-r border-gray-100 hover:bg-gray-50 active:scale-95 transition-colors">
                    <Edit2 size={11}/> Sửa
                  </button>
                  <button onClick={() => onDelete(item)}
                    className="flex-1 py-1.5 text-[10px] text-red-400 flex items-center justify-center gap-0.5
                      hover:bg-red-50 active:scale-95 transition-colors">
                    <Trash2 size={11}/> Xoá
                  </button>
                </div>
              </div>
            )
          })}
          {/* Add card */}
          <div onClick={onAdd} className="aspect-square rounded-xl border-2 border-dashed border-gray-200
            flex flex-col items-center justify-center gap-1.5 cursor-pointer text-gray-400
            hover:border-purple-300 hover:text-purple-400 transition-colors active:scale-95">
            <Plus size={22}/>
            <span className="text-[11px]">Thêm mới</span>
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
  const monthSales = useMemo(() => {
    const m = new Date().toISOString().slice(0,7)
    return sales.filter(s => s.sold_at?.startsWith(m))
  }, [sales])
  const monthRev = monthSales.reduce((s,x) => s + Number(x.qty)*Number(x.sell_price), 0)

  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }

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
      ) : (
        <div className="space-y-0">
          {sales.map(s => (
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
                    {fmtDate(s.sold_at)} · {s.customer_name || 'Khách lẻ'} · SL: {s.qty}
                  </div>
                </div>
                <div className="text-xs font-semibold text-green-600 flex-shrink-0">
                  {fmtMoney(Number(s.qty) * Number(s.sell_price))}
                </div>
              </div>
              {s.note && (
                <div className="text-[10px] text-gray-400 italic mt-1 pl-9">💬 {s.note}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================
// KHÁCH HÀNG TAB
// ============================================
function KhachTab({ customers }) {
  const [sort, setSort]   = useState('revenue')
  const [open, setOpen]   = useState(null)

  const sorted = useMemo(() => {
    const list = [...customers]
    switch(sort) {
      case 'count':    return list.sort((a,b) => b.count - a.count)
      case 'recent':   return list.sort((a,b) => a.daysSinceLast - b.daysSinceLast)
      case 'inactive': return list.sort((a,b) => b.daysSinceLast - a.daysSinceLast)
      default:         return list.sort((a,b) => b.revenue - a.revenue)
    }
  }, [customers, sort])

  const initials = name => name.split(' ').slice(-2).map(w=>w[0]).join('').toUpperCase().slice(0,2)

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
        <span className="text-[10px] text-gray-400">Sắp xếp:</span>
        <select value={sort} onChange={e=>setSort(e.target.value)}
          className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white text-gray-600">
          <option value="revenue">Doanh thu cao nhất</option>
          <option value="count">Mua nhiều lần nhất</option>
          <option value="recent">Mới mua gần nhất</option>
          <option value="inactive">Lâu chưa quay lại</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Tổng khách</div>
          <div className="text-lg font-semibold text-purple-600 mt-0.5">{customers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="text-[10px] text-gray-500">Quay lại ≥2 lần</div>
          <div className="text-lg font-semibold text-green-600 mt-0.5">
            {customers.filter(c=>c.count>=2).length}
          </div>
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">Chưa có dữ liệu khách</div>
      ) : sorted.map(c => (
        <div key={c.name}>
          <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3 cursor-pointer"
            onClick={() => setOpen(open===c.name ? null : c.name)}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
              ${c.daysSinceLast >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
              {initials(c.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-800">{c.name}</div>
              <div className="text-[10px] text-gray-400">
                {c.count} đơn · gần nhất {c.lastDate?.slice(5).split('-').reverse().join('/')}
              </div>
            </div>
            <div className="text-right flex-shrink-0 mr-1">
              <div className="text-xs font-semibold text-green-600">{fmtMoney(c.revenue)}</div>
              {c.daysSinceLast >= 30 && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {c.daysSinceLast}n
                </span>
              )}
            </div>
            <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform
              ${open===c.name ? 'rotate-180' : ''}`}/>
          </div>
          {open === c.name && (
            <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 pl-16
              text-[11px] text-gray-500 leading-loose">
              <span className="font-semibold text-gray-700">Đã mua: </span>
              {c.items.join(', ') || '—'}<br/>
              <span className="font-semibold text-gray-700">Tổng món: </span>{c.count} cái
              {c.daysSinceLast >= 30 && (
                <span className="ml-2 text-amber-600">· Chưa quay lại {c.daysSinceLast} ngày</span>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// ============================================
// BÁO CÁO TAB
// ============================================
function BcTab({ stats }) {
  const [bcTab, setBcTab] = useState('tong')

  return (
    <>
      <div className="flex bg-gray-100 rounded-xl p-1 mx-3 mt-3 gap-1">
        {[['tong','Tổng hợp'],['chay','Bán chạy'],['ton','Tồn lâu'],['xn','Xuất nhập']].map(([id,label]) => (
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
              ['Số món bán ra', `${stats.totalSold} món`, 'text-purple-600'],
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
          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Bán chạy nhất
          </div>
          {stats.bestSellers.slice(0,5).map((j,i) => {
            const pct = stats.bestSellers[0]?.revenue > 0
              ? (j.revenue / stats.bestSellers[0].revenue * 100) : 0
            return (
              <div key={j.id} className="bg-white border-b border-gray-100 px-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold text-gray-400 w-4">{i+1}</span>
                  <span className="text-xs font-semibold text-gray-800 flex-1 truncate">
                    {j.code}{j.name ? ` · ${j.name}` : ''}
                  </span>
                  <span className="text-xs font-semibold text-green-600">{fmtMoney(j.revenue)}</span>
                </div>
                <div className="ml-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{width:`${pct}%`}}/>
                </div>
              </div>
            )
          })}
        </>
      )}

      {bcTab === 'chay' && (
        <>
          <div className="px-3 pt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Xếp hạng doanh thu
          </div>
          {stats.bestSellers.length === 0
            ? <div className="text-center py-10 text-gray-400 text-sm">Chưa có dữ liệu</div>
            : stats.bestSellers.map((j,i) => (
              <div key={j.id} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${i===0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                  {i+1}
                </div>
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
                {fmtMoney(stats.slowMoving.reduce((s,j)=>(s+(j.stock_remaining*(j.sell_price||0))),0))}
              </span>
            </div>
          </div>
          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Tồn lâu — cần chú ý
          </div>
          {stats.slowMoving.length === 0
            ? <div className="text-center py-6 text-gray-400 text-sm">Không có món tồn lâu 👍</div>
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
              <span className="text-xs text-gray-500">Tổng đã nhập</span>
              <span className="text-xs font-semibold text-purple-600">
                {stats.totalItems} món · {fmtMoney(stats.stockValue)}
              </span>
            </div>
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
          <div className="px-3 mt-3 pb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            Chi tiết xuất nhập
          </div>
          {stats.xnLog.slice(0,20).map((x,i) => (
            <div key={i} className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                ${x.type==='import' ? 'bg-purple-50' : 'bg-green-50'}`}>
                {x.type==='import'
                  ? <ArrowDownCircle size={14} className="text-purple-600"/>
                  : <ArrowUpCircle  size={14} className="text-green-600"/>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">
                  {x.type==='import' ? 'Nhập' : 'Bán'} —{' '}
                  {x.code}{x.name ? ` · ${x.name}` : ''}
                </div>
                <div className="text-[10px] text-gray-400">
                  {x.date} · {x.type==='import' ? (x.supplier||'NCC') : (x.customer||'Khách lẻ')} · {x.qty} cái
                </div>
              </div>
              {x.revenue > 0 && (
                <span className="text-xs font-semibold text-green-600 flex-shrink-0">
                  {fmtMoney(x.revenue)}
                </span>
              )}
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0
                ${x.type==='import' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-700'}`}>
                {x.type==='import' ? 'Nhập' : 'Bán'}
              </span>
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
function DetailPanel({ item, sales, onSell, onEdit, onDelete, onImport }) {
  const detailToast = useToast()
  const [detailTab, setDetailTab] = useState('imports')
  const [imports,   setImports]   = useState([])
  const [loadingImp, setLoadingImp] = useState(true)
  const [editImp,   setEditImp]   = useState(null) // lô đang sửa

  const loadImports = useCallback(async () => {
    setLoadingImp(true)
    try { setImports(await getJewelryImports(item.id)) }
    catch { /* silent */ }
    finally { setLoadingImp(false) }
  }, [item.id])

  useEffect(() => { loadImports() }, [loadImports])

  const fmtDate = d => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day}/${m}/${y.slice(2)}` }
  const sold    = sales.reduce((s,x) => s + Number(x.qty), 0)
  const revenue = sales.reduce((s,x) => s + Number(x.qty)*Number(x.sell_price), 0)
  const totalImported = imports.reduce((s,x) => s + Number(x.qty), 0)
  const avgCost = imports.length > 0
    ? imports.filter(i=>i.cost_per_unit).reduce((s,i)=>s+Number(i.cost_per_unit),0) / imports.filter(i=>i.cost_per_unit).length
    : null

  const handleDelImp = async (imp) => {
    if (!confirm('Xoá lô nhập này? Tồn kho không hoàn lại tự động — hãy điều chỉnh tay nếu cần.')) return
    try { await deleteJewelryImport(imp.id); loadImports(); onDelete() }
    catch { /* silent */ }
  }

  return (
    <div>
      {/* Image */}
      <div className="w-full aspect-square relative bg-gradient-to-br from-purple-50 to-purple-200
        flex items-center justify-center overflow-hidden">
        {item.image_url
          ? <img src={thumbUrl(item.image_url, 800)} alt={item.code} className="w-full h-full object-cover"/>
          : <Diamond size={72} className="text-purple-200"/>
        }
        <div className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-black/40 text-white">
          {item.category}
        </div>
      </div>

      {/* Info */}
      <div className="bg-white px-4 py-0.5">
        {[
          ['Mã SP', item.code],
          ['Tên', item.name],
          ['Tồn kho', `${item.stock_qty} cái`, item.stock_qty > 0 ? 'text-green-600' : 'text-red-500'],
          ['Tổng đã nhập', totalImported > 0 ? `${totalImported} cái / ${imports.length} lô` : null],
          ['Giá vốn TB', avgCost ? fmtMoney(avgCost) + '/cái' : null],
          ['Giá bán', item.sell_price ? fmtMoney(item.sell_price) : null],
          ['Đã bán', sold > 0 ? `${sold} cái · ${fmtMoney(revenue)}` : null],
          ['NCC chính', item.supplier_name],
          ['SĐT NCC', item.supplier_contact],
          ['Ghi chú', item.note],
        ].filter(([,v]) => v).map(([l,v,c]) => (
          <div key={l} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
            <span className="text-xs text-gray-500">{l}</span>
            <span className={`text-xs font-semibold text-gray-800 ${c||''}`}>{v}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-3">
        <button onClick={onImport}
          className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-semibold active:scale-95">
          + Nhập lô
        </button>
        {item.stock_qty > 0 && (
          <button onClick={onSell}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-xs font-semibold active:scale-95">
            Ghi bán
          </button>
        )}
        <button onClick={onEdit}
          className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-xs font-semibold active:scale-95">
          Sửa
        </button>
        <button onClick={onDelete}
          className="px-3 py-2.5 bg-red-50 text-red-500 border border-red-200 rounded-xl active:scale-95">
          <Trash2 size={15}/>
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mx-3 mb-2 gap-1">
        {[['imports',`Lô nhập (${imports.length})`],['sales',`Lịch sử bán (${sales.length})`]].map(([id,label]) => (
          <button key={id} onClick={() => setDetailTab(id)}
            className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-colors
              ${detailTab===id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lô nhập */}
      {detailTab === 'imports' && (
        loadingImp ? (
          <div className="text-center py-6 text-gray-400 text-xs">Đang tải...</div>
        ) : imports.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Package size={28} className="mx-auto mb-2 opacity-40"/>
            Chưa có lô nhập nào
          </div>
        ) : (
          <div className="space-y-0">
            {imports.map(imp => (
              <ImportRow key={imp.id} imp={imp} fmtDate={fmtDate}
                onEdit={() => setEditImp(imp)}
                onDelete={() => handleDelImp(imp)}/>
            ))}
          </div>
        )
      )}

      {/* Lịch sử bán */}
      {detailTab === 'sales' && (
        sales.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Chưa có đơn bán nào</div>
        ) : (
          <div className="space-y-0">
            {sales.map(s => (
              <div key={s.id} className="bg-white border-b border-gray-100 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Tag size={11} className="text-green-600"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700">{s.customer_name || 'Khách lẻ'} · {s.qty} cái</div>
                    <div className="text-[10px] text-gray-400">{fmtDate(s.sold_at)}</div>
                  </div>
                  <div className="text-xs font-semibold text-green-600">
                    {fmtMoney(Number(s.qty)*Number(s.sell_price))}
                  </div>
                  <button onClick={async()=>{
                    if(!confirm('Xóa lần bán này?')) return
                    try { await deleteSale(s.id); onDelete() } catch{}
                  }} className="p-1 text-gray-300 hover:text-red-400 active:scale-90">
                    <Trash2 size={12}/>
                  </button>
                </div>
                {s.note && <div className="text-[10px] text-gray-400 italic mt-1 pl-8">💬 {s.note}</div>}
              </div>
            ))}
          </div>
        )
      )}

      {/* Edit import modal */}
      <ImportForm isOpen={!!editImp}
        item={null}
        editingImport={editImp}
        jewelryCode={item.code}
        onClose={() => setEditImp(null)}
        onSaved={() => { setEditImp(null); loadImports(); onDelete() }}
        toast={detailToast}/>
      <div className="h-4"/>
    </div>
  )
}

// Import row component
function ImportRow({ imp, fmtDate, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const total = imp.cost_per_unit ? Number(imp.qty) * Number(imp.cost_per_unit) : null
  return (
    <div className="bg-white border-b border-gray-100">
      <div className="px-4 py-2.5 flex items-center gap-3 cursor-pointer" onClick={() => setOpen(v=>!v)}>
        <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
          <ArrowDownCircle size={14} className="text-purple-600"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-gray-800">+{imp.qty} cái · {fmtDate(imp.import_date)}</div>
          <div className="text-[10px] text-gray-400">
            {imp.supplier_name || 'NCC không ghi'}
            {imp.cost_per_unit && ` · ${fmtMoney(imp.cost_per_unit)}/cái`}
          </div>
        </div>
        {total && <span className="text-xs font-semibold text-purple-600 flex-shrink-0">{fmtMoney(total)}</span>}
        <ChevronDown size={13} className={`text-gray-400 flex-shrink-0 transition-transform ${open?'rotate-180':''}`}/>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 leading-loose">
          {imp.note && <div><span className="font-semibold text-gray-700">Ghi chú: </span>{imp.note}</div>}
          {total && <div><span className="font-semibold text-gray-700">Tổng tiền: </span>{fmtMoney(total)}</div>}
          <div className="flex gap-2 mt-2">
            <button onClick={onEdit}
              className="px-3 py-1.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-lg text-[11px] font-medium active:scale-95">
              ✏️ Sửa lô
            </button>
            <button onClick={onDelete}
              className="px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg text-[11px] font-medium active:scale-95">
              🗑️ Xoá lô
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// JEWELRY FORM (thêm / sửa)
// ============================================
function JewelryForm({ isOpen, onClose, item, onSaved, toast }) {
  const EMPTY = { code:'', category:'Nhẫn', name:'', stock_qty:1, cost_price:'',
                  sell_price:'', supplier_name:'', supplier_contact:'', note:'' }
  const [form,    setForm]    = useState(EMPTY)
  const [imgFile, setImgFile] = useState(null)
  const [imgPrev, setImgPrev] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [resizing,setResizing]= useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setForm({ code:item.code||'', category:item.category||'Nhẫn', name:item.name||'',
          stock_qty:item.stock_qty||1, cost_price:item.cost_price||'',
          sell_price:item.sell_price||'', supplier_name:item.supplier_name||'',
          supplier_contact:item.supplier_contact||'', note:item.note||'' })
        setImgPrev(item.image_url || null)
      } else {
        setForm(EMPTY); setImgPrev(null)
      }
      setImgFile(null)
    }
  }, [isOpen, item])

  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setResizing(true)
    try {
      const blob = await resizeImage(file, 800, 0.75)
      const syntheticFile = new File([blob], file.name, { type: 'image/jpeg' })
      setImgFile(syntheticFile)
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
        stock_qty:   Number(form.stock_qty) || 0,
        cost_price:  form.cost_price  ? Number(form.cost_price)  : null,
        sell_price:  form.sell_price  ? Number(form.sell_price)  : null,
        supplier_name:    form.supplier_name.trim()    || null,
        supplier_contact: form.supplier_contact.trim() || null,
        note: form.note.trim() || null,
        image_url,
      }
      if (item) await updateJewelry(item.id, payload)
      else       await createJewelry(payload)
      toast.success(item ? 'Đã cập nhật' : 'Đã thêm sản phẩm')
      onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const f = (key,val) => setForm(p => ({ ...p, [key]: val }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? `Sửa ${item.code}` : 'Thêm trang sức'}>
      <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[70vh]">

        {/* Photo */}
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
              {resizing
                ? <RefreshCw size={22} className="animate-spin text-purple-400"/>
                : <><Camera size={22}/><span className="text-xs">Chọn ảnh từ thư viện · ~50 KB</span></>
              }
            </div>
          )}
        </div>

        {/* Thông tin SP */}
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
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tên — tùy chọn</label>
          <input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="Nhẫn vàng 18k size 15..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Số lượng nhập</label>
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
          <label className="text-[11px] text-gray-500 block mb-1">Giá bán mặc định (đ)</label>
          <input type="number" value={form.sell_price} onChange={e=>f('sell_price',e.target.value)}
            placeholder="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
          <input value={form.note} onChange={e=>f('note',e.target.value)} placeholder="Size, chất liệu..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        {/* Nhà cung cấp */}
        <div className="border-t border-gray-100 pt-2"/>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Nhà cung cấp</div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tên NCC</label>
          <input value={form.supplier_name} onChange={e=>f('supplier_name',e.target.value)}
            placeholder="Kim Thanh HN, Vàng bạc Hùng..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">SĐT / Zalo</label>
            <input type="tel" value={form.supplier_contact} onChange={e=>f('supplier_contact',e.target.value)}
              placeholder="0912..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.code.trim()}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 active:scale-98">
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
    if (isOpen) {
      setForm({
        qty: 1,
        sell_price: item?.sell_price || '',
        customer_name: '', note: '',
        sold_at: getLocalDateString(),
      })
      setAcShow(false)
    }
  }, [isOpen, item])

  const onCustInput = (v) => {
    setForm(p => ({ ...p, customer_name: v }))
    if (!v.trim()) { setAcShow(false); return }
    const q = v.toLowerCase()
    setAcList(customerNames.filter(n => n.toLowerCase().includes(q)))
    setAcShow(true)
  }

  const previewStock = item ? Number(item.stock_qty) - Number(form.qty||1) : null
  const totalPrice   = Number(form.qty||1) * Number(form.sell_price||0)

  const handleSubmit = async () => {
    if (!item) { toast.error('Chưa chọn sản phẩm'); return }
    if (!form.sell_price) { toast.error('Nhập giá bán'); return }
    setSaving(true)
    try {
      await createSale({ ...form, jewelry_id: item.id, qty: Number(form.qty)||1,
        sell_price: Number(form.sell_price) })
      toast.success('Đã ghi nhận bán')
      onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ghi nhận bán">
      <div className="px-5 pb-6 space-y-3">
        {item && (
          <div className="bg-purple-50 rounded-xl px-4 py-3 text-xs text-purple-700">
            <span className="font-semibold">{item.code}</span>
            {item.name && ` · ${item.name}`}
            {' · '}Còn {item.stock_qty} cái
            {previewStock !== null && (
              <span className={previewStock < 0 ? ' text-red-500' : ''}>
                {' → '}sau bán còn {previewStock}
              </span>
            )}
          </div>
        )}

        {/* Autocomplete khách */}
        <div className="relative" ref={custRef}>
          <label className="text-[11px] text-gray-500 block mb-1">Tên khách — gõ để tìm hoặc thêm</label>
          <input value={form.customer_name}
            onChange={e => onCustInput(e.target.value)}
            onFocus={() => form.customer_name && setAcShow(true)}
            placeholder="Gõ tên khách..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          {acShow && (
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl z-20
              shadow-lg overflow-hidden mt-0.5 max-h-40 overflow-y-auto">
              {acList.map(name => (
                <div key={name} onClick={() => { setForm(p=>({...p,customer_name:name})); setAcShow(false) }}
                  className="px-3 py-2.5 text-sm text-gray-700 border-b border-gray-100 last:border-0
                    hover:bg-gray-50 cursor-pointer">
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
            <input type="number" min="1" value={form.qty}
              onChange={e => setForm(p=>({...p,qty:e.target.value}))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Giá bán (đ) *</label>
            <input type="number" value={form.sell_price}
              onChange={e => setForm(p=>({...p,sell_price:e.target.value}))}
              placeholder="3200000"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>

        {totalPrice > 0 && (
          <div className="text-xs text-center text-purple-600 font-semibold bg-purple-50 rounded-lg py-2">
            Tổng: {fmtMoney(totalPrice)}
          </div>
        )}

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ngày bán</label>
          <input type="date" value={form.sold_at}
            onChange={e => setForm(p=>({...p,sold_at:e.target.value}))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú đơn — tùy chọn</label>
          <input value={form.note} onChange={e => setForm(p=>({...p,note:e.target.value}))}
            placeholder="Giảm giá, tặng hộp, trả góp..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Hủy
          </button>
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
// IMPORT FORM — nhập lô trang sức
// ============================================
function ImportForm({ isOpen, item, editingImport, jewelryCode, onClose, onSaved, toast }) {
  const EMPTY = { qty: '', cost_per_unit: '', supplier_name: '', import_date: '', note: '' }
  const [form,   setForm]   = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (editingImport) {
      setForm({
        qty:           String(editingImport.qty || ''),
        cost_per_unit: String(editingImport.cost_per_unit || ''),
        supplier_name: editingImport.supplier_name || '',
        import_date:   editingImport.import_date || getLocalDateString(),
        note:          editingImport.note || '',
      })
    } else {
      setForm({ ...EMPTY, import_date: getLocalDateString(),
        supplier_name: item?.supplier_name || '' })
    }
  }, [isOpen, editingImport, item])

  const total = (Number(form.qty)||0) * (Number(form.cost_per_unit)||0)

  const handleSubmit = async () => {
    if (!form.qty || Number(form.qty) <= 0) { toast.error('Nhập số lượng'); return }
    setSaving(true)
    try {
      if (editingImport) {
        await updateJewelryImport(editingImport.id, form)
        toast.success('Đã cập nhật lô nhập')
      } else {
        await createJewelryImport({ ...form, jewelry_id: item.id })
        toast.success(`Đã nhập ${form.qty} cái — tồn kho đã cộng`)
      }
      onSaved()
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={editingImport ? `Sửa lô — ${jewelryCode || ''}` : `Nhập lô — ${item?.code || ''}`}>
      <div className="px-5 pb-6 space-y-3">
        {!editingImport && item && (
          <div className="bg-purple-50 rounded-xl px-4 py-2.5 text-xs text-purple-700">
            <span className="font-semibold">{item.code}</span>
            {item.name && ` · ${item.name}`}
            {' · '}Tồn hiện tại: <span className="font-semibold">{item.stock_qty} cái</span>
            {Number(form.qty) > 0 && (
              <span> → sau nhập: <span className="font-semibold">
                {(Number(item.stock_qty)||0) + Number(form.qty)} cái
              </span></span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Số lượng *</label>
            <input type="number" min="1" value={form.qty} onChange={e=>f('qty',e.target.value)}
              placeholder="2" autoFocus
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Giá vốn/cái (đ)</label>
            <input type="number" value={form.cost_per_unit} onChange={e=>f('cost_per_unit',e.target.value)}
              placeholder="Tùy chọn"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>

        {total > 0 && (
          <div className="text-xs text-center text-purple-600 font-semibold bg-purple-50 rounded-lg py-2">
            Tổng nhập: {fmtMoney(total)}
          </div>
        )}

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ngày nhập</label>
          <input type="date" value={form.import_date} onChange={e=>f('import_date',e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Nhà cung cấp lô này</label>
          <input type="text" value={form.supplier_name} onChange={e=>f('supplier_name',e.target.value)}
            placeholder="Kim Thanh HN, Vàng bạc Hùng..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
          <input type="text" value={form.note} onChange={e=>f('note',e.target.value)}
            placeholder="Chất lượng, điều kiện..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.qty}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? '...' : editingImport ? 'Lưu thay đổi' : 'Lưu lô nhập'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// PICK JEWELRY MODAL (chọn SP khi bán từ tab Bán)
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-purple-50 cursor-pointer active:scale-98">
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
          {filtered.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm">Không tìm thấy</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
