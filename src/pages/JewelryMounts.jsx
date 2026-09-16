// ============================================
// Ổ MẪU — thư viện tra cứu ổ nhẫn, khuyên tai...
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Diamond, Plus, Trash2, ChevronLeft, Search, X, Camera, RefreshCw,
} from 'lucide-react'
import Modal from '../components/Modal'
import {
  getMounts, createMount, updateMount, deleteMount,
  getGoldPrice, saveGoldPrice, estimateMount,
  uploadImage, thumbUrl, resizeImage, fmtMoney, fmtInput, parseInput,
  MOUNT_TYPES, GOLD_TYPES,
} from '../lib/jewelry'

// Gradient nền theo loại ổ — để lướt nhanh nhận ra
const BG = {
  'Ổ nhẫn':     'from-amber-50 to-amber-300',
  'Khuyên tai': 'from-purple-50 to-purple-300',
  'Vòng':       'from-rose-50 to-rose-300',
  'Lắc':        'from-emerald-50 to-emerald-300',
  'Mặt dây':    'from-sky-50 to-sky-300',
  'Khác':       'from-gray-50 to-gray-300',
}
const bgOf = t => BG[t] || BG['Khác']

export default function MountsTab({ toast }) {
  const [mounts,  setMounts]  = useState([])
  const [gold,    setGold]    = useState(0)
  const [loading, setLoading] = useState(true)
  const [type,    setType]    = useState('Tất cả')
  const [search,  setSearch]  = useState('')
  const [detail,  setDetail]  = useState(null)
  const [showForm,setShowForm]= useState(false)
  const [editing, setEditing] = useState(null)
  const [showGold,setShowGold]= useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ms, g] = await Promise.all([getMounts(), getGoldPrice()])
      setMounts(ms); setGold(g)
    } catch { toast.error('Lỗi tải ổ mẫu') }
    finally { setLoading(false) }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = type === 'Tất cả' ? mounts : mounts.filter(m => m.type === type)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.size?.toLowerCase().includes(q) ||
        m.stone_size?.toLowerCase().includes(q) ||
        m.note?.toLowerCase().includes(q)
      )
    }
    return list
  }, [mounts, type, search])

  const counts = useMemo(() => {
    const c = { 'Tất cả': mounts.length }
    MOUNT_TYPES.forEach(t => { c[t] = mounts.filter(m => m.type === t).length })
    return c
  }, [mounts])

  const handleDelete = async (m) => {
    if (!confirm(`Xoá ổ mẫu "${m.name}"?`)) return
    try { await deleteMount(m.id); toast.success('Đã xoá'); setDetail(null); load() }
    catch (err) { toast.error(err.message) }
  }

  // ---- Chi tiết ----
  if (detail) {
    const est = estimateMount(detail, gold)
    return (
      <div>
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button onClick={() => setDetail(null)} className="p-1 -ml-1 text-purple-600">
            <ChevronLeft size={22}/>
          </button>
          <h2 className="flex-1 text-base font-semibold text-gray-800 truncate">{detail.name}</h2>
        </div>

        <div className={`w-full aspect-square relative bg-gradient-to-br ${bgOf(detail.type)}
          flex items-center justify-center overflow-hidden`}>
          {detail.image_url
            ? <img src={thumbUrl(detail.image_url, 800)} alt={detail.name} className="w-full h-full object-cover"/>
            : <Diamond size={72} className="text-white/60"/>}
          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/45 text-white">
            {detail.type}
          </span>
        </div>

        <div className="bg-white px-4 py-0.5">
          {[
            ['Kích thước', detail.size],
            ['Vàng', detail.gold_chi ? `${detail.gold_chi} chỉ · ${detail.gold_type}` : null],
            ['Khối lượng', detail.gold_gram ? `${detail.gold_gram} g` : null],
            ['Tiền công', detail.labor_cost ? fmtMoney(detail.labor_cost) : null],
            ['Đá', detail.stone_count
              ? `${detail.stone_count} viên${detail.stone_size ? ` · ${detail.stone_size}` : ''}`
              : (detail.stone_size || null)],
            ['Ghi chú', detail.note],
          ].filter(([,v]) => v).map(([l,v]) => (
            <div key={l} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0 gap-3">
              <span className="text-xs text-gray-500 flex-shrink-0">{l}</span>
              <span className="text-xs font-semibold text-gray-800 text-right">{v}</span>
            </div>
          ))}
        </div>

        {/* Ước tính giá */}
        <div className="mx-3 my-3 p-3 bg-purple-50 rounded-xl">
          <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider mb-2">
            Ước tính giá
          </div>
          {gold > 0 && detail.gold_chi > 0 && (
            <div className="flex justify-between text-xs text-purple-700 py-0.5">
              <span>Vàng {detail.gold_chi} chỉ × {fmtMoney(gold)}</span>
              <span>{fmtMoney(est.gold)}</span>
            </div>
          )}
          {detail.labor_cost > 0 && (
            <div className="flex justify-between text-xs text-purple-700 py-0.5">
              <span>Tiền công</span><span>{fmtMoney(est.labor)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-purple-800 pt-2 mt-1 border-t border-purple-200">
            <span>Tạm tính {detail.stone_count ? '(chưa đá)' : ''}</span>
            <span>{fmtMoney(est.total)}</span>
          </div>
          {gold === 0 && (
            <button onClick={() => setShowGold(true)}
              className="mt-2 w-full py-1.5 text-[11px] font-semibold text-purple-600 bg-white rounded-lg active:scale-98">
              Đặt giá vàng để tính tự động
            </button>
          )}
        </div>

        <div className="flex gap-2 px-3 pb-4">
          <button onClick={() => { setEditing(detail); setShowForm(true) }}
            className="flex-1 py-2.5 bg-purple-50 border border-purple-200 text-purple-600 rounded-xl text-xs font-semibold active:scale-95">
            Sửa
          </button>
          <button onClick={() => handleDelete(detail)}
            className="px-4 py-2.5 bg-red-50 text-red-500 border border-red-200 rounded-xl active:scale-95">
            <Trash2 size={15}/>
          </button>
        </div>

        <MountForm isOpen={showForm} mount={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={m => { setShowForm(false); setEditing(null); setDetail(m); load() }}
          toast={toast}/>
        <GoldPriceModal isOpen={showGold} price={gold}
          onClose={() => setShowGold(false)}
          onSaved={p => { setGold(p); setShowGold(false) }}
          toast={toast}/>
      </div>
    )
  }

  // ---- Danh sách ----
  return (
    <>
      {/* Lọc theo loại */}
      <div className="flex gap-1.5 px-3 py-2 bg-white border-b border-gray-100 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}>
        {['Tất cả', ...MOUNT_TYPES].map(t => (
          (counts[t] > 0 || t === 'Tất cả') && (
            <button key={t} onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap flex-shrink-0 border
                ${type===t ? 'bg-purple-600 text-white border-purple-600 font-semibold'
                           : 'bg-white text-gray-500 border-gray-200'}`}>
              {t} {counts[t] > 0 && `(${counts[t]})`}
            </button>
          )
        ))}
      </div>

      {/* Giá vàng — sửa ngay tại đây */}
      <GoldBar price={gold} onSaved={setGold} toast={toast}/>

      {/* Tìm */}
      <div className="px-3 py-2 bg-white border-b border-gray-100">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Tìm tên ổ, kích thước..."
            className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50
              focus:outline-none focus:border-purple-400"/>
          {search && (
            <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 p-0.5">
              <X size={13}/>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={22} className="animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Diamond size={32} className="mb-2 opacity-30"/>
          <p className="text-sm">{search ? `Không tìm thấy "${search}"` : 'Chưa có ổ mẫu nào'}</p>
          {!search && (
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="mt-3 text-xs text-purple-600 font-semibold">+ Thêm ổ đầu tiên</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 p-3">
          {filtered.map(m => {
            const est = estimateMount(m, gold)
            return (
              <div key={m.id} onClick={() => setDetail(m)}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden cursor-pointer active:scale-98 transition-transform">
                <div className={`aspect-square relative bg-gradient-to-br ${bgOf(m.type)}
                  flex items-center justify-center overflow-hidden`}>
                  {m.image_url
                    ? <img src={thumbUrl(m.image_url, 300)} alt={m.name} className="w-full h-full object-cover"/>
                    : <Diamond size={34} className="text-white/60"/>}
                  <span className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-black/45 text-white">
                    {m.type}
                  </span>
                  {est.total > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 px-2 pt-3 pb-1
                      bg-gradient-to-t from-black/70 to-transparent">
                      <span className="text-xs font-bold text-white">~{fmtMoney(est.total)}</span>
                    </div>
                  )}
                </div>
                <div className="px-2 pt-2 pb-2">
                  <div className="text-[11px] font-semibold text-gray-800 leading-tight">{m.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {[
                      m.size,
                      m.gold_chi ? `${m.gold_chi} chỉ` : null,
                      m.stone_size ? `đá ${m.stone_size}` : null,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={() => { setEditing(null); setShowForm(true) }}
        className="fixed right-4 w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg
          flex items-center justify-center z-20"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px))' }}>
        <Plus size={22}/>
      </button>

      <MountForm isOpen={showForm} mount={editing}
        onClose={() => { setShowForm(false); setEditing(null) }}
        onSaved={() => { setShowForm(false); setEditing(null); load() }}
        toast={toast}/>
      <div className="h-4"/>
    </>
  )
}

// ============================================
// THANH GIÁ VÀNG — sửa ngay trên đầu trang
// ============================================
function GoldBar({ price, onSaved, toast }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState('')
  const [saving,  setSaving]  = useState(false)

  const open = () => { setVal(String(price || '')); setEditing(true) }

  const save = async () => {
    setSaving(true)
    try {
      const p = Number(val) || 0
      await saveGoldPrice(p)
      onSaved(p)
      setEditing(false)
      toast.success('Đã cập nhật giá vàng')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  if (editing) {
    return (
      <div className="px-3 py-2.5 bg-amber-50 border-b border-amber-200">
        <label className="text-[10px] font-semibold text-amber-800 block mb-1.5">
          Giá 1 chỉ vàng (đ)
        </label>
        <div className="flex gap-2">
          <input inputMode="numeric" value={fmtInput(val)}
            onChange={e => setVal(parseInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="4.650.000" autoFocus
            className="flex-1 px-3 py-2 text-sm font-semibold border border-amber-300 rounded-xl
              bg-white focus:outline-none focus:border-amber-500"/>
          <button onClick={save} disabled={saving}
            className="px-4 bg-amber-500 text-white rounded-xl text-xs font-bold active:scale-95 disabled:opacity-50">
            {saving ? '...' : 'Lưu'}
          </button>
          <button onClick={() => setEditing(false)}
            className="px-3 text-xs text-amber-700 active:scale-95">Huỷ</button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={open}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 border-b active:scale-98 transition-transform
        ${price > 0
          ? 'bg-amber-50 border-amber-200'
          : 'bg-white border-dashed border-gray-300'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-base
        ${price > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
        🪙
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className={`text-[10px] font-medium ${price > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
          Giá vàng đang dùng
        </div>
        <div className={`text-sm font-bold ${price > 0 ? 'text-amber-900' : 'text-gray-400'}`}>
          {price > 0 ? `${fmtMoney(price)}/chỉ` : 'Chưa đặt — bấm để nhập'}
        </div>
      </div>
      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0
        ${price > 0 ? 'bg-white text-amber-700 border border-amber-300' : 'bg-purple-600 text-white'}`}>
        {price > 0 ? 'Sửa' : 'Nhập'}
      </span>
    </button>
  )
}

// ============================================
// FORM THÊM / SỬA Ổ
// ============================================
const EMPTY_MOUNT = {
  name:'', type:'Ổ nhẫn', size:'',
  gold_chi:'', gold_gram:'', gold_type:'18k',
  labor_cost:'', stone_count:'', stone_size:'', note:'',
}

function MountForm({ isOpen, mount, onClose, onSaved, toast }) {
  const [form,    setForm]    = useState(EMPTY_MOUNT)
  const [imgFile, setImgFile] = useState(null)
  const [imgPrev, setImgPrev] = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [resizing,setResizing]= useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!isOpen) return
    if (mount) {
      setForm({
        name: mount.name||'', type: mount.type||'Ổ nhẫn', size: mount.size||'',
        gold_chi: String(mount.gold_chi ?? ''), gold_gram: String(mount.gold_gram ?? ''),
        gold_type: mount.gold_type||'18k',
        labor_cost: String(mount.labor_cost ?? ''),
        stone_count: String(mount.stone_count ?? ''), stone_size: mount.stone_size||'',
        note: mount.note||'',
      })
      setImgPrev(mount.image_url || null)
    } else {
      setForm(EMPTY_MOUNT); setImgPrev(null)
    }
    setImgFile(null)
  }, [isOpen, mount])

  const f = (k,v) => setForm(p => ({ ...p, [k]: v }))

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
    if (!form.name.trim()) { toast.error('Nhập tên ổ'); return }
    setSaving(true)
    try {
      let image_url = mount?.image_url || null
      let imgWarn = null
      if (imgFile) {
        try { image_url = await uploadImage(imgFile, form.name.trim()) }
        catch { imgWarn = 'Ảnh chưa lưu được — ổ mẫu vẫn được lưu' }
      }
      const payload = { ...form, image_url }
      const saved = mount
        ? await updateMount(mount.id, payload)
        : await createMount(payload)
      if (imgWarn) toast.error(imgWarn)
      else         toast.success(mount ? 'Đã cập nhật' : 'Đã thêm ổ mẫu')
      onSaved(saved)
    } catch (err) { toast.error('Lỗi: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mount ? `Sửa ${mount.name}` : 'Thêm ổ mẫu'}>
      <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[72vh]">
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
                : <><Camera size={18}/><span className="text-[11px]">Ảnh ổ — nên có để dễ tra</span></>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-[1.3fr_1fr] gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Tên ổ *</label>
            <input value={form.name} onChange={e=>f('name',e.target.value)}
              placeholder="Ổ nhẫn nữ 6 chấu"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Loại *</label>
            <select value={form.type} onChange={e=>f('type',e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
              {MOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">
            Kích thước <span className="text-gray-300">— tuỳ chọn</span>
          </label>
          <input value={form.size} onChange={e=>f('size',e.target.value)}
            placeholder="Size 15, 2cm..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="border-t border-gray-100 pt-2"/>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Vàng</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">Số chỉ</label>
            <input inputMode="decimal" value={form.gold_chi} onChange={e=>f('gold_chi',e.target.value)}
              placeholder="1.2" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">
              Gram <span className="text-gray-300">— tuỳ chọn</span>
            </label>
            <input inputMode="decimal" value={form.gold_gram} onChange={e=>f('gold_gram',e.target.value)}
              placeholder="4.5" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tuổi vàng</label>
          <select value={form.gold_type} onChange={e=>f('gold_type',e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
            {GOLD_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        <div className="border-t border-gray-100 pt-2"/>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Công & đá</div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Tiền công (đ)</label>
          <input inputMode="numeric" value={fmtInput(form.labor_cost)}
            onChange={e=>f('labor_cost', parseInput(e.target.value))}
            placeholder="800.000" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">
              Số viên đá <span className="text-gray-300">— tuỳ chọn</span>
            </label>
            <input type="number" min="0" value={form.stone_count} onChange={e=>f('stone_count',e.target.value)}
              placeholder="1" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 block mb-1">
              Cỡ đá <span className="text-gray-300">— tuỳ chọn</span>
            </label>
            <input value={form.stone_size} onChange={e=>f('stone_size',e.target.value)}
              placeholder="5 ly / 3mm" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Ghi chú</label>
          <input value={form.note} onChange={e=>f('note',e.target.value)}
            placeholder="Chấu tròn, dễ ôm đá..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Huỷ
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.name.trim()}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? 'Đang lưu...' : mount ? 'Cập nhật' : 'Lưu ổ mẫu'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ============================================
// GIÁ VÀNG
// ============================================
function GoldPriceModal({ isOpen, price, onClose, onSaved, toast }) {
  const [val,    setVal]    = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (isOpen) setVal(String(price || '')) }, [isOpen, price])

  const handleSave = async () => {
    setSaving(true)
    try {
      const p = Number(val) || 0
      await saveGoldPrice(p)
      toast.success('Đã lưu giá vàng')
      onSaved(p)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Giá vàng">
      <div className="px-5 pb-6 space-y-3">
        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Giá 1 chỉ vàng (đ)</label>
          <input inputMode="numeric" value={fmtInput(val)} onChange={e=>setVal(parseInput(e.target.value))}
            placeholder="4.650.000" autoFocus
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm"/>
        </div>
        <div className="px-3 py-2 bg-gray-50 rounded-xl text-[11px] text-gray-500 leading-relaxed">
          Đặt một lần, mọi ổ mẫu tự tính lại giá ước tính. Đổi khi giá vàng thay đổi.
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
            {saving ? '...' : 'Lưu'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
