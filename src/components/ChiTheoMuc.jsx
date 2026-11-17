// ============================================
// THU CHI · TAB "THEO MỤC"
// Danh sách mục trong tháng · tìm trong nội dung chi · chi tiết 6 tháng · sửa mục
// Chỉ đọc giao dịch; chỉ ghi danh sách mục (settings.chi_muc).
// ============================================
import { useMemo, useState } from 'react'
import { Search, X, ChevronLeft, Pencil } from 'lucide-react'
import Modal from './Modal'
import { formatMoney, moneyFull } from '../lib/helpers'
import { match, inMuc, mucOf, assignNote, byMonth, suggestions, MUC_EMOJI, MUC_COLORS } from '../lib/muc'

const mLabel = m => `T${+m.slice(5)}`
const dm = d => `${+d.slice(8)}/${+d.slice(5, 7)}`
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const wd = d => { const [y, m, dd] = d.split('-').map(Number); return WD[new Date(y, m - 1, dd).getDay()] }
const PM = { cash: 'TM', transfer: 'CK', credit: 'TD' }

// Nhãn mục nhỏ trên dòng giao dịch (dùng cả ở tab Giao dịch)
export function MucPill({ list, note, onOpen, onPick }) {
  const m = mucOf(list, note)
  if (!m) return null
  if (m === 'many') return <button onClick={e => { e.stopPropagation(); onPick?.(note) }}
    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">⚠️ chọn mục</button>
  return <button onClick={e => { e.stopPropagation(); onOpen?.(m.k) }}
    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold text-gray-700 whitespace-nowrap" style={{ background: m.c }}>{m.e} {m.n}</button>
}

// Chọn mục cho ghi chú lẫn nhiều mục
export function PickMuc({ note, list, onClose, onSave }) {
  if (!note) return null
  const cands = list.filter(m => inMuc(m, note))
  return (
    <Modal isOpen onClose={onClose} title="Ghi chú này thuộc mục nào?">
      <p className="text-sm text-gray-600 mb-3">“{note}”</p>
      <div className="space-y-2">
        {(cands.length ? cands : list).map(m => (
          <button key={m.k} onClick={() => onSave(assignNote(list, note, m.k))}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[.99]" style={{ background: m.c }}>
            <span className="text-xl">{m.e}</span><span className="font-semibold">{m.n}</span></button>))}
      </div>
      <p className="text-xs text-gray-500 mt-3">Các lần sau ghi đúng nội dung này sẽ tự vào mục đã chọn. Giao dịch không bị sửa.</p>
    </Modal>)
}

function Bars({ months, v, cur, onPick }) {
  const mx = Math.max(...v, 1)
  return <div className="bg-white rounded-xl p-3 shadow-sm">
    {months.map((m, i) => (
      <button key={m} onClick={() => onPick?.(i)} className="w-full flex items-center gap-2 my-1 text-xs">
        <span className={`w-8 text-left ${i === cur ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{mLabel(m)}</span>
        <span className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden"><i className="block h-full rounded-md" style={{ width: `${v[i] / mx * 100}%`, background: i === cur ? '#ef4444' : '#fca5a5' }}/></span>
        <span className="w-16 text-right font-semibold">{v[i] ? formatMoney(v[i]) : '0'}</span>
      </button>))}
  </div>
}

function TxList({ rows, list, onEditTx, accName, cardName }) {
  const g = {}
  rows.forEach(r => (g[r.date] = g[r.date] || []).push(r))
  const days = Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]))
  if (!days.length) return <p className="text-sm text-gray-400 text-center py-4">Không có khoản chi</p>
  return <div className="space-y-2">{days.map(([d, rs]) => (
    <div key={d}>
      <div className="flex justify-between text-xs font-bold text-gray-500 px-1 mb-1"><span>{wd(d)}, {dm(d)}</span>
        <span className="font-medium text-red-500">-{formatMoney(rs.reduce((a, r) => a + Number(r.amount), 0))}</span></div>
      <div className="bg-white rounded-xl overflow-hidden shadow-sm">{rs.map((r, i) => (
        <button key={r.id} onClick={() => onEditTx?.(r.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-gray-50 ${i < rs.length - 1 ? 'border-b border-gray-50' : ''}`}>
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0" style={{ background: (r.category?.color || '#9ca3af') + '22' }}>{r.category?.icon || '💸'}</span>
          <span className="flex-1 min-w-0"><span className="block text-sm font-medium text-gray-800 truncate">{r.note}</span>
            <span className="flex items-center gap-1.5 mt-0.5"><span className="text-xs text-gray-400 truncate">{r.category?.name}</span>
              <span className="text-[10px] px-1.5 rounded-full border border-blue-200 text-blue-700 bg-blue-50 whitespace-nowrap">{PM[r.payment_method] || 'TM'}{r.payment_method === 'transfer' && accName?.(r.account_id) ? '·' + accName(r.account_id) : ''}{r.payment_method === 'credit' && cardName?.(r.card_id) ? '·' + cardName(r.card_id) : ''}</span>
              {list && <MucPill list={list} note={r.note}/>}</span></span>
          <span className="text-sm font-bold text-red-600 whitespace-nowrap">-{formatMoney(r.amount)}</span>
        </button>))}</div>
    </div>))}</div>
}

// ---------- Sửa / thêm mục ----------
export function MucEdit({ item, list, rows, onClose, onSave }) {
  const isNew = !list.some(m => m.k === item.k)
  const [d, setD] = useState(() => ({ ...item, kw: [...item.kw], ex: [...(item.ex || [])] }))
  const [w, setW] = useState('')
  const n = rows.filter(r => inMuc(d, r.note)).length
  const addW = () => { const v = w.trim().toLowerCase(); if (v && !d.kw.includes(v)) setD({ ...d, kw: [...d.kw, v] }); setW('') }
  const save = () => {
    const it = { ...d, n: d.n.trim() || 'Mục mới', kw: d.kw.length ? d.kw : [(d.n.trim() || 'mục mới').toLowerCase()] }
    onSave(isNew ? [...list, it] : list.map(m => m.k === it.k ? it : m))
  }
  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Mục mới' : 'Sửa mục'}>
      <input value={d.n} onChange={e => setD({ ...d, n: e.target.value })} placeholder="Tên mục, ví dụ: Cà phê"
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base"/>
      <div className="flex flex-wrap gap-1.5 mt-3">{MUC_EMOJI.map(e => (
        <button key={e} onClick={() => setD({ ...d, e })} className={`w-10 h-10 rounded-xl text-xl ${d.e === e ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-gray-100'}`}>{e}</button>))}</div>
      <div className="flex gap-2 mt-3">{MUC_COLORS.map(c => (
        <button key={c} onClick={() => setD({ ...d, c })} aria-label="màu" className={`w-8 h-8 rounded-full ${d.c === c ? 'ring-2 ring-gray-800 ring-offset-2' : ''}`} style={{ background: c }}/>))}</div>
      <p className="text-xs font-semibold text-gray-500 mt-4 mb-1.5">GHI CHÚ CÓ CHỨA CHỮ…</p>
      <div className="flex flex-wrap gap-1.5">{d.kw.map(k => (
        <span key={k} className="flex items-center gap-1.5 bg-indigo-50 text-indigo-800 rounded-lg px-2.5 py-1.5 text-sm">{k}
          <button onClick={() => setD({ ...d, kw: d.kw.filter(x => x !== k) })} className="text-indigo-400" aria-label={'Bỏ ' + k}>✕</button></span>))}</div>
      <div className="flex gap-2 mt-2">
        <input value={w} onChange={e => setW(e.target.value)} onKeyDown={e => e.key === 'Enter' && addW()} placeholder="thêm chữ, ví dụ: cafe"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-base"/>
        <button onClick={addW} className="px-4 rounded-xl bg-gray-100 text-sm font-medium">Thêm</button>
      </div>
      {d.ex.length > 0 && <p className="text-xs text-gray-500 mt-2">Bỏ qua: {d.ex.map(x => `“${x}”`).join(', ')} <button onClick={() => setD({ ...d, ex: [] })} className="text-purple-600 underline">bỏ hết</button></p>}
      <p className="text-xs text-gray-500 mt-2">Không phân biệt hoa/thường, có dấu hay không. Đang gom <b>{n}</b> khoản chi trong 6 tháng.</p>
      <button onClick={save} className="w-full mt-4 py-3 rounded-xl bg-purple-600 text-white font-semibold">Lưu</button>
      {!isNew && <button onClick={() => { if (confirm(`Xoá mục “${d.n}”? Giao dịch không bị ảnh hưởng.`)) onSave(list.filter(m => m.k !== d.k)) }}
        className="w-full mt-2 py-3 rounded-xl bg-red-50 text-red-600 font-medium">Xoá mục</button>}
    </Modal>)
}

// ---------- Màn chi tiết một mục ----------
function MucDetail({ m, list, rows, months, cur, setCur, onBack, onEdit, onEditTx, accName, cardName }) {
  const v = byMonth(rows, months, r => inMuc(m, r.note)), sum = v.reduce((a, b) => a + b, 0)
  const L = rows.filter(r => r.date.startsWith(months[cur]) && inMuc(m, r.note))
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto pb-24">
      <div className="bg-white border-b sticky top-0 z-10 px-2 py-2 flex items-center gap-1">
        <button onClick={onBack} className="p-2 text-purple-600" aria-label="Quay lại"><ChevronLeft size={24}/></button>
        <h2 className="flex-1 text-lg font-bold truncate">{m.e} {m.n}</h2>
        <button onClick={onEdit} className="p-2.5 rounded-full bg-gray-100" aria-label="Sửa mục"><Pencil size={16}/></button>
      </div>
      <div className="max-w-2xl mx-auto p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm"><p className="text-xs text-gray-500">Tháng {+months[cur].slice(5)}/{months[cur].slice(0, 4)}</p><p className="text-lg font-bold text-red-600">{moneyFull(v[cur])}</p><p className="text-xs text-gray-400">{L.length} lần</p></div>
          <div className="bg-white rounded-xl p-3 shadow-sm"><p className="text-xs text-gray-500">Trung bình 6 tháng</p><p className="text-lg font-bold">{formatMoney(sum / 6)}</p><p className="text-xs text-gray-400">/tháng</p></div>
        </div>
        <Bars months={months} v={v} cur={cur} onPick={setCur}/>
        <TxList rows={L} list={list} onEditTx={onEditTx} accName={accName} cardName={cardName}/>
        <div className="bg-white rounded-xl p-3 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-1.5">GOM TỪ GHI CHÚ CÓ CHỮ</p>
          <div className="flex flex-wrap gap-1.5">{m.kw.map(k => <span key={k} className="bg-indigo-50 text-indigo-800 rounded-lg px-2.5 py-1 text-sm">{k}</span>)}</div>
          <button onClick={onEdit} className="text-sm text-purple-600 font-medium mt-2">✏️ Sửa mục</button>
        </div>
      </div>
    </div>)
}

// ---------- Tab chính ----------
export default function ChiTheoMuc({ list, rows, months, loading, openK, setOpenK, onSaveList, onEditTx, accName, cardName }) {
  const [cur, setCur] = useState(months.length - 1)
  const [q, setQ] = useState('')
  const [off, setOff] = useState(() => new Set())
  const [edit, setEdit] = useState(null)              // mục đang sửa / thêm
  const [pick, setPick] = useState(null)              // ghi chú đang chọn mục
  const curM = months[cur] || months[months.length - 1]
  const isNow = cur === months.length - 1

  const stats = useMemo(() => list.map(m => {
    const v = byMonth(rows, months, r => inMuc(m, r.note))
    const prev = v.slice(Math.max(0, cur - 3), cur)
    const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0
    return { m, v, avg, n: rows.filter(r => r.date.startsWith(curM) && inMuc(m, r.note)).length }
  }).sort((a, b) => b.v[cur] - a.v[cur]), [list, rows, months, cur, curM])
  const tot = stats.reduce((a, s) => a + s.v[cur], 0)
  const many = useMemo(() => rows.filter(r => r.date.startsWith(curM) && mucOf(list, r.note) === 'many'), [rows, list, curM])
  const sug = useMemo(() => suggestions(rows, list), [rows, list])

  // ----- Tìm kiếm -----
  const S = useMemo(() => {
    if (!q.trim()) return null
    const L = rows.filter(r => match(r.note, q)), vars = {}
    L.forEach(r => { const k = r.note.trim(); (vars[k] = vars[k] || { n: 0, exact: match(r.note, q) === 2 }).n++ })
    const on = L.filter(r => !off.has(r.note.trim()))
    const ex = list.find(m => m.kw.some(k => match(k, q) || match(q, k)))
    return { V: Object.entries(vars).sort((a, b) => b[1].n - a[1].n), on, v: byMonth(on, months, () => true), ex }
  }, [q, off, rows, list, months])
  const chosenNotes = () => [...new Set(S.on.map(r => r.note.trim().toLowerCase()))]
  const saveSearch = () => {
    const kws = S.on.map(r => match(r.note, q) === 2 ? q.trim().toLowerCase() : r.note.trim().toLowerCase())
    setEdit({ k: 'm' + Date.now(), n: q.trim()[0].toUpperCase() + q.trim().slice(1), e: '📌', c: MUC_COLORS[list.length % MUC_COLORS.length], kw: [...new Set(kws)], ex: [...off].map(x => x.toLowerCase()) })
  }
  const mergeInto = m => {
    const add = chosenNotes().filter(n => !inMuc(m, n))
    const ex = [...new Set([...(m.ex || []), ...[...off].map(x => x.toLowerCase())])]
    onSaveList(list.map(x => x.k === m.k ? { ...x, kw: [...x.kw, ...add], ex } : x), add.length ? `Đã gộp ${add.length} cách ghi vào ${m.n}` : off.size ? `Đã cập nhật mục ${m.n}` : `Mục ${m.n} đã đủ`)
    setQ(''); setOff(new Set()); setOpenK(m.k)
  }

  const openM = openK && list.find(m => m.k === openK)
  const sheets = <>
    {edit && <MucEdit item={edit} list={list} rows={rows} onClose={() => setEdit(null)} onSave={l => { onSaveList(l, 'Đã lưu mục'); setEdit(null); if (!l.some(m => m.k === openK)) setOpenK(null) }}/>}
    <PickMuc note={pick} list={list} onClose={() => setPick(null)} onSave={l => { onSaveList(l, 'Đã gán mục'); setPick(null) }}/>
  </>
  if (openM) return <><MucDetail m={openM} list={list} rows={rows} months={months} cur={cur} setCur={setCur} onBack={() => setOpenK(null)}
    onEdit={() => setEdit(openM)} onEditTx={onEditTx} accName={accName} cardName={cardName}/>{sheets}</>

  return (
    <div className="space-y-3 pb-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={q} onChange={e => { setQ(e.target.value); setOff(new Set()) }} placeholder="Tìm trong nội dung chi (vd: cy, cafe, chợ)"
          className="w-full pl-9 pr-9 py-2.5 text-base border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-purple-400"/>
        {q && <button onClick={() => setQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 p-1" aria-label="Xoá tìm"><X size={15}/></button>}
      </div>

      {loading ? <div className="bg-white rounded-xl p-6 text-center text-sm text-gray-400">Đang tải 6 tháng…</div>
      : S ? (!S.V.length ? <p className="text-center text-sm text-gray-400 py-6">Không thấy khoản chi nào</p> : <>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm"><p className="text-xs text-gray-500">{S.on.length} khoản · 6 tháng</p><p className="text-lg font-bold text-red-600">{moneyFull(S.v.reduce((a, b) => a + b, 0))}</p></div>
          <div className="bg-white rounded-xl p-3 shadow-sm"><p className="text-xs text-gray-500">Trung bình</p><p className="text-lg font-bold">{formatMoney(S.v.reduce((a, b) => a + b, 0) / 6)}<span className="text-xs text-gray-400 font-normal">/tháng</span></p></div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">CÁC CÁCH GHI TÌM THẤY · bỏ chọn cái không đúng</p>
          <div className="flex flex-wrap gap-1.5">{S.V.map(([k, v]) => { const o = off.has(k); return (
            <button key={k} onClick={() => { const n = new Set(off); o ? n.delete(k) : n.add(k); setOff(n) }}
              className={`px-2.5 py-1.5 rounded-full text-sm ${o ? 'bg-gray-100 text-gray-400 line-through' : 'bg-purple-100 text-purple-800'}`}>
              {o ? '☐' : '☑'} {k} <span className="opacity-60">({v.n})</span>{!v.exact && ' ≈'}</button>) })}</div>
        </div>
        {S.on.length > 0 && (S.ex
          ? <button onClick={() => mergeInto(S.ex)} className="w-full py-3 rounded-xl font-semibold text-gray-800" style={{ background: S.ex.c }}>＋ Gộp các cách ghi đã chọn vào mục {S.ex.e} {S.ex.n}</button>
          : <button onClick={saveSearch} className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold">＋ Lưu thành mục để theo dõi hàng tháng</button>)}
        <Bars months={months} v={S.v} cur={months.length - 1}/>
        <TxList rows={S.on} onEditTx={onEditTx} accName={accName} cardName={cardName}/>
      </>) : <>
        <div className="flex items-center justify-between bg-white rounded-xl px-2 py-1.5 shadow-sm">
          <button onClick={() => setCur(Math.max(0, cur - 1))} disabled={cur === 0} className="px-3 py-1.5 text-gray-500 disabled:opacity-30">‹</button>
          <b className="text-sm">Tháng {+curM.slice(5)}/{curM.slice(0, 4)}{isNow && ' (đang chạy)'}</b>
          <button onClick={() => setCur(Math.min(months.length - 1, cur + 1))} disabled={isNow} className="px-3 py-1.5 text-gray-500 disabled:opacity-30">›</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm"><p className="text-xs text-gray-500">Tổng các mục</p><p className="text-lg font-bold text-red-600">{moneyFull(tot)}</p></div>
          <div className="bg-white rounded-xl p-3 shadow-sm"><p className="text-xs text-gray-500">Nhiều nhất</p><p className="text-lg font-bold truncate">{stats[0]?.v[cur] ? `${stats[0].m.e} ${stats[0].m.n}` : '—'}</p></div>
        </div>
        {many.length > 0 && <div className="bg-amber-50 rounded-xl p-3">
          <p className="text-sm text-amber-900">⚠️ <b>{many.length} khoản</b> ghi lẫn nhiều mục — chạm để chọn mục cho đúng</p>
          <div className="mt-2 space-y-1.5">{many.map(r => (
            <button key={r.id} onClick={() => setPick(r.note)} className="w-full flex justify-between gap-2 bg-white rounded-lg px-3 py-2 text-sm text-left">
              <span className="truncate">{dm(r.date)} · {r.note}</span><b className="text-red-600 whitespace-nowrap">-{formatMoney(r.amount)}</b></button>))}</div>
        </div>}
        <div className="flex items-center justify-between px-1"><span className="text-xs font-semibold text-gray-500">MỤC CỦA TÔI · chạm để xem chi tiết</span>
          <button onClick={() => setEdit({ k: 'm' + Date.now(), n: '', e: '📌', c: MUC_COLORS[list.length % MUC_COLORS.length], kw: [], ex: [] })} className="text-sm text-purple-600 font-medium">+ Mục mới</button></div>
        <div className="space-y-2">{stats.map(({ m, v, avg, n }) => {
          const d = avg ? Math.round((v[cur] - avg) / avg * 100) : 0, mx = Math.max(...v, 1)
          return <button key={m.k} onClick={() => setOpenK(m.k)} className="w-full bg-white rounded-xl p-3 shadow-sm flex items-center gap-3 text-left active:bg-gray-50">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: m.c }}>{m.e}</span>
            <span className="flex-1 min-w-0"><span className="block font-semibold text-gray-800 truncate">{m.n}</span>
              <span className="block text-xs text-gray-400">{n} lần · TB 3 tháng trước {formatMoney(avg)}</span></span>
            <span className="text-right flex-shrink-0">
              <span className={`block font-bold ${v[cur] ? 'text-red-600' : 'text-gray-300'}`}>{v[cur] ? '-' + formatMoney(v[cur]) : '0'}</span>
              <span className="block text-[11px] font-semibold">{isNow ? <span className="text-gray-400 font-normal">tháng đang chạy</span>
                : avg && v[cur] ? (d > 15 ? <span className="text-red-600">▲ {d}%</span> : d < -15 ? <span className="text-emerald-600">▼ {-d}%</span> : <span className="text-gray-400 font-normal">≈ bình thường</span>) : null}</span>
              <span className="flex items-end gap-0.5 h-5 justify-end mt-0.5">{v.map((x, i) => <i key={i} className="w-1.5 rounded-sm" style={{ height: Math.max(2, x / mx * 20), background: i === cur ? '#ef4444' : '#e5e7eb' }}/>)}</span>
            </span>
          </button> })}</div>
        {sug.length > 0 && <>
          <p className="text-xs font-semibold text-gray-500 px-1">GỢI Ý — GHI CHÚ BẠN GÕ NHIỀU LẦN</p>
          <div className="flex flex-wrap gap-1.5">{sug.map(([k, c]) => (
            <button key={k} onClick={() => setEdit({ k: 'm' + Date.now(), n: k[0].toUpperCase() + k.slice(1), e: '📌', c: MUC_COLORS[list.length % MUC_COLORS.length], kw: [k], ex: [] })}
              className="px-3 py-1.5 rounded-full text-sm bg-purple-50 text-purple-700 border border-dashed border-purple-300">+ {k} <span className="opacity-60">({c})</span></button>))}</div>
        </>}
      </>}
      {sheets}
    </div>)
}
