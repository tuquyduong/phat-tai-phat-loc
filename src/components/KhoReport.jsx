// Báo cáo Kho — CHỈ ĐỌC: tính từ danh sách hàng đã có, không ghi gì vào dữ liệu.
// items = stats.withDays (đã có available, reserved, days_in_stock)
import { useMemo, useState, useEffect } from 'react'

const money = n => Math.round(n || 0).toLocaleString('vi-VN').replace(/,/g, '.') + 'đ'
const short = n => {
  n = Math.round(n || 0)
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' tỷ'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '').replace('.', ',') + 'tr'
  return money(n)
}
const num = v => Number(v) || 0
const ICON = {
  'Mặt ngọc': '🟢', 'Nhẫn': '💍', 'Vòng hạt': '📿', 'Vòng khối': '⭕', 'Lắc': '✨', 'Lắc ngọc': '💚',
  'Dây chuyền': '🔗', 'Charm': '🔸', 'Bông tai': '💎', 'Ngọc rời': '🔹', 'Móc treo dt/túi': '🔑', 'Khác': '📦',
}
const AGES = [
  ['Dưới 30 ngày', 0, 30, '#22c55e'], ['30 – 90 ngày', 30, 90, '#a3e635'],
  ['3 – 6 tháng', 90, 180, '#f59e0b'], ['Trên 6 tháng', 180, Infinity, '#ef4444'],
]

export default function KhoReport({ items = [], onSelect }) {
  const [mode, setMode] = useState('sell')          // sell | cost
  const [sort, setSort] = useState('v')             // v giá trị · q số lượng · a tồn lâu
  const [open, setOpen] = useState({})
  const [sheet, setSheet] = useState(null)          // { title, list }

  const priceOf = j => num(mode === 'sell' ? j.sell_price : j.cost_price)
  const valOf   = j => num(j.available) * priceOf(j)
  const live    = useMemo(() => items.filter(j => num(j.available) > 0), [items])

  const R = useMemo(() => {
    const total = live.reduce((s, j) => s + valOf(j), 0)
    const qty   = live.reduce((s, j) => s + num(j.available), 0)
    const withCost = live.filter(j => num(j.cost_price) > 0)
    const groups = {}
    live.forEach(j => {
      const k = j.category || 'Chưa phân loại'
      const g = groups[k] ||= { cat: k, v: 0, q: 0, n: 0, miss: 0, age: 0, list: [] }
      g.v += valOf(j); g.q += num(j.available); g.n++; if (!priceOf(j)) g.miss++
      g.age = Math.max(g.age, num(j.days_in_stock)); g.list.push(j)
    })
    const gs = Object.values(groups).sort(
      sort === 'q' ? (a, b) => b.q - a.q : sort === 'a' ? (a, b) => b.age - a.age : (a, b) => b.v - a.v)
    const ages = AGES.map(([t, lo, hi, c]) => {
      const list = live.filter(j => num(j.days_in_stock) >= lo && num(j.days_in_stock) < hi)
      return { t, c, list, q: list.reduce((s, j) => s + num(j.available), 0), v: list.reduce((s, j) => s + valOf(j), 0) }
    })
    const checks = [
      ['💰', 'bg-amber-100', 'Chưa có giá vốn', 'Bổ sung để biết vốn đang nằm trong kho', live.filter(j => !num(j.cost_price))],
      ['🏷️', 'bg-red-100', 'Chưa có giá bán', 'Không cộng được vào giá trị tồn', live.filter(j => !num(j.sell_price))],
      ['⏳', 'bg-orange-100', 'Nằm kho trên 6 tháng', 'Cân nhắc đẩy bán, giảm giá, combo', live.filter(j => num(j.days_in_stock) >= 180)],
      ['📉', 'bg-blue-100', 'Sắp hết (còn 1 món)', 'Mã từng có nhiều — cần nhập thêm?', live.filter(j => num(j.available) === 1 && num(j.ever_total) > 1)],
      ['📷', 'bg-purple-100', 'Chưa có ảnh', 'Khó bán online', live.filter(j => !j.image_url)],
    ].filter(c => c[4].length)
    return {
      total, qty, gs, ages, checks,
      slow: ages[2].v + ages[3].v,
      reserved: items.reduce((s, j) => s + num(j.reserved), 0),
      withCost: withCost.length,
      costVal: withCost.reduce((s, j) => s + num(j.available) * num(j.cost_price), 0),
      profit: withCost.reduce((s, j) => s + num(j.available) * (num(j.sell_price) - num(j.cost_price)), 0),
      max: Math.max(1, ...Object.values(groups).map(g => g.v)),
    }
  }, [live, items, mode, sort])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sheet) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [sheet])

  const pct = v => R.total ? Math.round(v / R.total * 100) : 0
  const openSheet = (title, list) => setSheet({ title, list: [...list].sort((a, b) => valOf(b) - valOf(a)) })

  const Row = ({ j }) => {
    const p = priceOf(j)
    return (
      <button onClick={() => { setSheet(null); onSelect?.(j) }}
        className="w-full flex items-center gap-2.5 px-4 py-2 border-t border-purple-50 text-left active:bg-purple-50">
        {j.image_url
          ? <img src={j.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-none bg-gray-100"/>
          : <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-base flex-none">📷</div>}
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium truncate">{j.code}{j.name ? ` · ${j.name}` : ''}</div>
          <div className="text-[11px] text-gray-500">
            {num(j.available)} món · {num(j.days_in_stock)} ngày trong kho
            {num(j.reserved) > 0 && <span className="ml-1 px-1 rounded bg-red-100 text-red-700 text-[9.5px] font-bold">chờ giao {j.reserved}</span>}
            {!num(j.cost_price) && <span className="ml-1 px-1 rounded bg-amber-100 text-amber-800 text-[9.5px] font-bold">chưa có vốn</span>}
          </div>
        </div>
        <div className="text-right whitespace-nowrap">
          <div className="text-[13px] font-bold">{p ? short(num(j.available) * p) : '—'}</div>
          <div className="text-[11px] text-gray-500">{p ? short(p) + '/món' : 'chưa có giá'}</div>
        </div>
      </button>
    )
  }
  const Sec = ({ children, right }) => (
    <div className="flex justify-between items-center px-3.5 pt-4 pb-1.5 text-[10.5px] text-gray-400 tracking-wider uppercase font-bold">
      <span>{children}</span>{right}
    </div>
  )

  if (!live.length) return <div className="text-center text-gray-400 text-sm py-16">Kho chưa có hàng còn bán được</div>

  return (
    <div className="pb-24">
      {/* Giá bán / giá vốn */}
      <div className="flex bg-gray-100 rounded-xl p-1 mx-3 mt-3 gap-1">
        {[['sell', 'Theo giá bán'], ['cost', 'Theo giá vốn']].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            className={`flex-1 py-1.5 rounded-lg text-[12.5px] ${mode === k ? 'bg-white text-purple-600 font-bold shadow-sm' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {/* Tổng quan */}
      <div className="bg-white border border-gray-100 rounded-2xl mx-3 mt-3 p-4">
        <div className="text-xs text-gray-500">Giá trị hàng tồn · {mode === 'sell' ? 'tính theo giá bán' : 'tính theo giá vốn'}</div>
        <div className="text-[26px] font-extrabold text-purple-900 tracking-tight mt-0.5">{money(R.total)}</div>
        <div className="text-xs text-gray-500 mt-1">{live.length} mã hàng · {R.qty} món còn bán được</div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[
            [short(R.slow), `nằm kho trên 3 tháng (${pct(R.slow)}%)`],
            [`${R.reserved} món`, 'đã bán, chờ giao (không tính)'],
            ...(mode === 'sell'
              ? [[R.withCost ? short(R.costVal) : '—', `vốn đã ghi (${R.withCost} mã)`], [short(R.total / Math.max(1, R.qty)), 'giá trung bình / món']]
              : [[`${R.withCost}/${live.length}`, 'mã đã có giá vốn'], [R.withCost ? short(R.profit) : '—', 'lãi dự kiến của các mã đó']]),
          ].map(([b, s]) => (
            <div key={s} className="bg-gray-50 rounded-xl px-2.5 py-2">
              <div className="text-[15px] font-bold">{b}</div>
              <div className="text-[11px] text-gray-500 leading-snug">{s}</div>
            </div>
          ))}
        </div>
        {mode === 'cost' && R.withCost < live.length && (
          <div className="mt-2.5 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2 text-xs text-amber-800 leading-relaxed">
            ⚠️ <b>{live.length - R.withCost} mã chưa có giá vốn</b> nên chưa được cộng vào số trên.
          </div>
        )}
      </div>

      {/* Theo loại */}
      <Sec right={
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="border border-gray-200 bg-white rounded-lg text-xs px-1.5 py-1 text-gray-600 normal-case tracking-normal font-medium">
          <option value="v">Giá trị cao → thấp</option><option value="q">Số lượng nhiều → ít</option><option value="a">Tồn lâu nhất</option>
        </select>}>Theo loại hàng</Sec>
      <div className="bg-white border-y border-gray-100">
        {R.gs.map(g => {
          const o = !!open[g.cat], list = [...g.list].sort((a, b) => valOf(b) - valOf(a))
          return (
            <div key={g.cat} className={`border-b border-gray-50 last:border-b-0 ${o ? 'bg-purple-50/50' : ''}`}>
              <button onClick={() => setOpen(x => ({ ...x, [g.cat]: !x[g.cat] }))} className="w-full text-left px-4 py-2.5">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm font-semibold">{ICON[g.cat] || '💎'} {g.cat}</span>
                  <span className="text-sm font-bold text-purple-800 whitespace-nowrap">{g.miss === g.n ? '—' : short(g.v)}</span>
                </div>
                <div className="flex justify-between text-[11.5px] text-gray-500 mt-0.5">
                  <span>{g.n} mã · {g.q} món{g.miss > 0 && <span className="text-amber-700"> · {g.miss} chưa có giá</span>}</span>
                  <span>{pct(g.v)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-violet-600" style={{ width: `${g.v / R.max * 100}%` }}/>
                </div>
              </button>
              {o && <>
                {list.slice(0, 5).map(j => <Row key={j.id} j={j}/>)}
                {list.length > 5 && (
                  <button onClick={() => openSheet(`${g.cat} · ${list.length} mã`, list)}
                    className="w-full py-2 text-[12.5px] font-semibold text-purple-600 border-t border-purple-50">Xem cả {list.length} mã ›</button>
                )}
              </>}
            </div>
          )
        })}
      </div>

      {/* Tuổi tồn */}
      <Sec>Hàng nằm kho bao lâu</Sec>
      <div className="bg-white border border-gray-100 rounded-2xl mx-3 p-4">
        <div className="text-xs text-gray-500">Giá trị theo thời gian nằm kho</div>
        <div className="flex h-3.5 rounded-full overflow-hidden mt-1 mb-2 bg-gray-100">
          {R.ages.map(a => <div key={a.t} style={{ width: `${pct(a.v)}%`, background: a.c }}/>)}
        </div>
        {R.ages.map(a => (
          <button key={a.t} onClick={() => openSheet(`Nằm kho ${a.t.toLowerCase()} · ${a.list.length} mã`, a.list)}
            className="w-full flex items-center gap-2 py-2 text-[13px] border-b border-gray-50 last:border-b-0 text-left">
            <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: a.c }}/>
            <span className="flex-1">{a.t}</span>
            <span className="text-xs text-gray-500 w-16 text-right">{a.q} món</span>
            <span className="font-bold w-24 text-right">{short(a.v)}</span>
          </button>
        ))}
      </div>

      {/* Cần chú ý */}
      {R.checks.length > 0 && <>
        <Sec>Cần chú ý</Sec>
        <div className="bg-white border-y border-gray-100">
          {R.checks.map(([ic, bg, t, s, list]) => (
            <button key={t} onClick={() => openSheet(`${t} · ${list.length} mã`, list)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-b-0 text-left active:bg-gray-50">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-none ${bg}`}>{ic}</span>
              <span className="flex-1 text-[13.5px]">{t}<span className="block text-[11.5px] text-gray-500">{s}</span></span>
              <span className="font-bold text-[15px]">{list.length}</span>
              <span className="text-purple-300 text-lg">›</span>
            </button>
          ))}
        </div>
      </>}

      {/* Danh sách đầy đủ */}
      {sheet && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(null)}/>
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl max-w-lg mx-auto flex flex-col"
            style={{ maxHeight: '78vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="px-4 pt-2 pb-2.5 border-b border-gray-100">
              <div className="w-10 h-1.5 rounded-full bg-gray-200 mx-auto mb-2"/>
              <div className="text-base font-bold">{sheet.title}</div>
              <div className="text-xs text-gray-500">{short(sheet.list.reduce((s, j) => s + valOf(j), 0))} · chạm vào mã để mở</div>
            </div>
            <div className="overflow-y-auto">
              {sheet.list.map(j => <Row key={j.id} j={j}/>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
