// ============================================
// TAB VIỆC — Lịch âm dương, To-do, Daily, ngày trai
// Màn chính chỉ có lịch; bấm ngày mở bảng chi tiết.
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useToast } from '../components/Toast'
import { getLocalDateString } from '../lib/helpers'
import { lunarOf, isTraiDay, isMakeupDay } from '../lib/lunar'
import {
  PEOPLE, otherOf, getWho, setWho, hasPin, setPin, checkPin, getCfg, saveCfg, DEFAULT_CFG,
  loadAll, createTask, updateTask, deleteTask, toggleTask, saveDaily, startTimer, stopTimer, toggleTick,
  addDays, daysBetween, isDailyDay, dailyProgress, runningLog, looksForgotten, upcoming, periodStats, REPEAT_LABEL,
} from '../lib/viec'

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WD_FULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const AVA = { linh: 'bg-blue-100 text-blue-800', mai: 'bg-pink-100 text-pink-800' }
const EMOJI = ['📿', '💻', '📖', '🀄', '🧪', '🧘', '🏃', '🍵', '📸', '💰', '🎯', '⭐']
const COLORS = ['#7F77DD', '#378ADD', '#1D9E75', '#639922', '#EF9F27', '#D85A30', '#D4537E', '#888780']
const TIMES = ['', '07:00', '08:00', '09:00', '10:00', '14:00', '16:00', '18:00', '20:00', '21:00']
const pdate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const dm = s => { const d = pdate(s); return `${d.getDate()}/${d.getMonth() + 1}` }
const du = m => m >= 60 ? Math.floor(m / 60) + 'g' + (m % 60 ? String(m % 60).padStart(2, '0') : '') : m + 'p'
const hhmm = iso => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') }
const lunarLabel = L => L.day === 1 ? `1/${L.month}` : L.day === 15 ? 'Rằm' : L.day

function Ring({ pct, color, size = 44, label }) {
  const r = size / 2 - 4, C = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E6E1" strokeWidth="5"/>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}/>
      {label !== undefined && <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size > 50 ? 13 : 12, fontWeight: 600, fill: '#1F2937' }}>{label}</text>}
    </svg>
  )
}


// ── Khối giao diện nhỏ dùng chung (định nghĩa ở ngoài để React không dựng lại mỗi lần vẽ) ──
function Chip({ on, onClick, children, cls = '' }) {
  return <button onClick={onClick} className={`text-[13px] px-3 py-2 rounded-full whitespace-nowrap flex-shrink-0 ${on ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'} ${cls}`}>{children}</button>
}
function Switch({ on, onClick, label }) {
  return <button onClick={onClick} aria-label={label} aria-pressed={on}
    className={`w-12 h-7 rounded-full relative flex-shrink-0 transition-colors ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
    <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}/></button>
}
function SetRow({ title, sub, children }) {
  return <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="flex-1"><div className="text-[15px] font-medium text-gray-800">{title}</div>{sub && <div className="text-xs text-gray-500">{sub}</div>}</div>{children}</div>
}
function UpRow({ t, tag, cls, onOpen }) {
  return <button onClick={() => onOpen(t.due_date)} className="w-full flex items-center gap-2.5 py-3 border-b border-gray-100 last:border-0 text-left active:bg-gray-50">
    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap min-w-[72px] text-center ${cls}`}>{tag}</span>
    <span className="flex-1 text-sm text-gray-800">{t.title}{t.shared && ' 👥'}</span>
    {t.due_time && <span className="text-xs text-gray-500">{t.due_time}</span>}
  </button>
}

// ── Chọn người + mã PIN (chỉ cho tab Việc; đăng nhập chính của app giữ nguyên) ──
function PinGate({ onDone }) {
  const toast = useToast()
  const [who, setWhoSel] = useState(null)
  const [mode, setMode] = useState('enter')       // enter | new | confirm
  const [pin, setPinVal] = useState(''), [first, setFirst] = useState('')
  const [busy, setBusy] = useState(false)
  const [fails, setFails] = useState(0), [lockUntil, setLockUntil] = useState(0)

  const choose = async w => {
    setWhoSel(w); setPinVal(''); setBusy(true)
    try { setMode((await hasPin(w)) ? 'enter' : 'new') } catch (e) { toast.error('Lỗi: ' + e.message) }
    setBusy(false)
  }
  const press = async k => {
    if (busy) return
    if (Date.now() < lockUntil) { toast.error(`Thử lại sau ${Math.ceil((lockUntil - Date.now()) / 1000)} giây`); return }
    const next = k === '⌫' ? pin.slice(0, -1) : (pin + k).slice(0, 4)
    setPinVal(next)
    if (next.length < 4) return
    setBusy(true)
    try {
      if (mode === 'enter') {
        if (await checkPin(who, next)) { setWho(who); onDone(who) }
        else {
          const n = fails + 1; setFails(n); setPinVal('')
          if (n >= 5) { setLockUntil(Date.now() + 30000); setFails(0); toast.error('Sai 5 lần — khoá 30 giây') }
          else toast.error(`Sai mã PIN (còn ${5 - n} lần)`)
        }
      } else if (mode === 'new') { setFirst(next); setMode('confirm'); setPinVal('') }
      else if (next === first) { await setPin(who, next); setWho(who); toast.success('Đã đặt mã PIN'); onDone(who) }
      else { toast.error('Hai lần nhập không khớp'); setMode('new'); setPinVal('') }
    } catch (e) { toast.error('Lỗi: ' + e.message); setPinVal('') }
    setBusy(false)
  }
  const title = !who ? 'Ai đang dùng?' : mode === 'enter' ? `Mã PIN của ${PEOPLE[who]}`
    : mode === 'new' ? `Đặt mã PIN cho ${PEOPLE[who]}` : 'Nhập lại để xác nhận'
  return (
    <div className="max-w-md mx-auto px-6 pt-16 text-center">
      <div className="text-2xl font-bold text-gray-800">📅 Việc</div>
      <div className="text-gray-500 mt-1 mb-6">{title}</div>
      <div className="flex gap-3">
        {Object.entries(PEOPLE).map(([k, n]) => (
          <button key={k} onClick={() => choose(k)}
            className={`flex-1 bg-white rounded-2xl py-5 border-2 ${who === k ? 'border-purple-500' : 'border-transparent'} active:scale-95`}>
            <span className={`w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-xl font-bold ${AVA[k]}`}>{n.split(' ')[1][0]}</span>
            <span className="font-semibold text-gray-800">{n}</span>
          </button>
        ))}
      </div>
      {who && <>
        <div className="flex gap-4 justify-center my-7">
          {[0, 1, 2, 3].map(i => <span key={i} className={`w-3.5 h-3.5 rounded-full border-2 border-gray-400 ${i < pin.length ? 'bg-gray-800 border-gray-800' : ''}`}/>)}
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => k === '' ? <span key={i}/> :
            <button key={i} onClick={() => press(k)} className="h-14 rounded-2xl bg-white text-2xl text-gray-800 active:bg-gray-100">{k}</button>)}
        </div>
        {mode !== 'enter' && <p className="text-xs text-gray-400 mt-5">Mã 4 số, chỉ dùng cho tab Việc. Máy này sẽ nhớ.</p>}
      </>}
    </div>
  )
}

export default function Viec() {
  const toast = useToast()
  const today = getLocalDateString()
  const [who, setWhoState] = useState(getWho)
  const [data, setData] = useState({ tasks: [], daily: [], logs: [] })
  const [cfg, setCfgState] = useState(DEFAULT_CFG)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('main')                // main | stat | set | daily
  const [month, setMonth] = useState(today.slice(0, 7))
  const [sel, setSel] = useState(null)                    // ngày đang mở bảng chi tiết
  const [tab, setTab] = useState('up')
  const [now, setNow] = useState(Date.now())
  const [editDaily, setEditDaily] = useState(null)

  const loaded = useRef(false)
  const load = useCallback(async () => {
    if (!who) return
    if (!loaded.current) setLoading(true)
    try {
      const [d, c] = await Promise.all([loadAll(who), getCfg()])
      setData(d); setCfgState(c); loaded.current = true
    } catch (e) { toast.error('Lỗi tải dữ liệu: ' + e.message) }
    setLoading(false)
  }, [who])
  useEffect(() => { load() }, [load])
  // Hai người dùng hai máy: quay lại app thì lấy dữ liệu mới nhất (việc chung người kia vừa thêm, ngày mới…)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && !busy.current) { setNow(Date.now()); load() } }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const running = useMemo(() => runningLog(data.logs, who), [data.logs, who])
  useEffect(() => {                                       // đồng hồ chạy thì cập nhật mỗi 15 giây
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [running])
  useEffect(() => {                                       // mở bảng chi tiết thì khoá cuộn nền
    document.body.style.overflow = sel ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sel])

  // ── thao tác dữ liệu: cập nhật tại chỗ, không tải lại cả trang ──
  const patch = (key, fn) => setData(d => ({ ...d, [key]: fn(d[key]) }))
  // Chống bấm hai lần khi mạng chậm: đang ghi thì bỏ qua lần bấm sau
  const busy = useRef(false)
  const run = async (fn, okMsg) => {
    if (busy.current) return
    busy.current = true
    try { await fn(); if (okMsg) toast.success(okMsg) }
    catch (e) { toast.error('Lỗi: ' + e.message) }
    finally { busy.current = false }
  }

  const addTask = (fields) => run(async () => { const t = await createTask({ owner: who, ...fields }); patch('tasks', ts => [...ts, t]) })
  const editTask = (id, fields) => run(async () => { const t = await updateTask(id, fields); patch('tasks', ts => ts.map(x => x.id === id ? t : x)) })
  const removeTask = (id) => run(async () => { await deleteTask(id); patch('tasks', ts => ts.filter(x => x.id !== id)) }, 'Đã xoá')
  const tick = (task) => run(async () => {
    const { updated, next } = await toggleTask(task)
    patch('tasks', ts => [...ts.map(x => x.id === task.id ? updated : x), ...(next ? [next] : [])])
    if (next) toast.success(`Đã lên lịch lần tới: ${dm(next.due_date)}`)
  })
  const start = (d) => run(async () => {
    const log = await startTimer(d, who, running)
    patch('logs', ls => [...ls.map(l => l.id === running?.id ? { ...l, end_at: new Date().toISOString(),
      minutes: Math.max(1, Math.round((Date.now() - new Date(l.start_at)) / 60000)) } : l), log])
    setNow(Date.now())
  })
  const stop = (endAt) => running && run(async () => { const l = await stopTimer(running, endAt); patch('logs', ls => ls.map(x => x.id === l.id ? l : x)) })
  const tickD = (d) => run(async () => {
    const r = await toggleTick(d, who, data.logs)
    patch('logs', ls => r.removed ? ls.filter(l => l.id !== r.removed) : [...ls, r.added])
  })
  const saveD = (fields) => run(async () => {
    const d = await saveDaily(fields.id ? fields : { owner: who, ...fields })
    patch('daily', ds => fields.id ? ds.map(x => x.id === d.id ? d : x) : [...ds, d])
    setView('set'); setEditDaily(null)
  }, 'Đã lưu Daily')
  const updCfg = (c) => { setCfgState(c); run(() => saveCfg(c)) }

  if (!who) return <PinGate onDone={w => setWhoState(w)}/>

  const daily = data.daily.filter(d => !d.archived)
  const todayDaily = daily.filter(d => isDailyDay(d, today))
  const prog = d => dailyProgress(d, data.logs, today, now)
  const avg = todayDaily.length ? Math.round(todayDaily.reduce((a, d) => a + prog(d).pct, 0) / todayDaily.length) : 0
  const U = upcoming(data.tasks, today)
  const upN = U.late.length + U.today.length + U.soon.length
  const runD = running && data.daily.find(d => d.id === running.daily_id)

  const header = (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-2">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${AVA[who]}`}>{PEOPLE[who].split(' ')[1][0]}</span>
        <h2 className="text-lg font-bold text-gray-800 flex-1">📅 Việc · {PEOPLE[who]}</h2>
        <button onClick={() => { setMonth(today.slice(0, 7)); setSel(today) }}
          className="text-sm px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 font-medium active:scale-95">Hôm nay</button>
        <button onClick={() => setView('set')} className="w-10 h-10 rounded-full text-lg active:bg-gray-100" aria-label="Cài đặt">⚙️</button>
      </div>
    </header>
  )

  if (view === 'stat') return <StatsPage daily={daily} logs={data.logs} today={today} now={now} onBack={() => setView('main')}/>
  if (view === 'daily') return <DailyForm initial={editDaily} who={who} onSave={saveD} onBack={() => { setView('set'); setEditDaily(null) }}/>
  if (view === 'set') return <SettingsPage who={who} cfg={cfg} onCfg={updCfg} daily={data.daily}
    onEditDaily={d => { setEditDaily(d); setView('daily') }}
    onSwitch={() => { loaded.current = false; setWho(null); setWhoState(null); setView('main'); setData({ tasks: [], daily: [], logs: [] }) }}
    onBack={() => setView('main')}/>

  return (
    <div className="pb-6">
      {header}
      <div className="max-w-2xl mx-auto px-3 pt-2">
        <Calendar month={month} setMonth={setMonth} today={today} tasks={data.tasks} cfg={cfg} onOpen={setSel}/>

        <div className="flex gap-1.5 mt-3 mb-2 bg-gray-200/70 rounded-2xl p-1">
          <button onClick={() => setTab('up')} className={`flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 ${tab === 'up' ? 'bg-white font-semibold text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            ⚠️ Sắp tới {upN > 0 && <em className={`not-italic text-xs px-2 rounded-full ${U.late.length ? 'bg-red-100 text-red-700' : 'bg-purple-100 text-purple-700'}`}>{upN}</em>}
          </button>
          <button onClick={() => setTab('daily')} className={`flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 ${tab === 'daily' ? 'bg-white font-semibold text-gray-800 shadow-sm' : 'text-gray-500'}`}>
            ◎ Daily <em className="not-italic text-xs px-2 rounded-full bg-emerald-100 text-emerald-700">{avg}%</em>
          </button>
        </div>

        <div className="bg-white rounded-2xl px-3 py-1.5">
          {loading ? <p className="text-center text-sm text-gray-400 py-6">Đang tải…</p>
            : tab === 'up' ? <Upcoming U={U} today={today} cfg={cfg} onOpen={setSel}/>
            : <DailyPanel list={todayDaily} prog={prog} avg={avg} running={running} runD={runD} now={now}
                onStart={start} onStop={stop} onTick={tickD} onStats={() => setView('stat')}
                onAdd={() => { setEditDaily(null); setView('daily') }}/>}
        </div>
      </div>

      {sel && <DaySheet iso={sel} today={today} who={who} cfg={cfg} tasks={data.tasks} daily={daily} logs={data.logs} now={now}
        onClose={() => setSel(null)} onAdd={addTask} onEdit={editTask} onDelete={removeTask} onTick={tick}
        onMove={iso => setSel(iso)}/>}
    </div>
  )
}

// ── LỊCH THÁNG ──
function Calendar({ month, setMonth, today, tasks, cfg, onOpen }) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
  const cells = []
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (i >= 35 && d.getMonth() !== m - 1) break; cells.push(d) }
  const byDay = useMemo(() => { const o = {}; tasks.forEach(t => { if (t.due_date) (o[t.due_date] = o[t.due_date] || []).push(t) }); return o }, [tasks])
  const midL = lunarOf(`${month}-15`)
  const traiN = cells.filter(d => d.getMonth() === m - 1 && isTraiDay(getLocalDateString(d), cfg)).length
  const shift = n => { const d = new Date(y, m - 1 + n, 1); setMonth(getLocalDateString(d).slice(0, 7)) }
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <button onClick={() => shift(-1)} className="w-11 h-11 rounded-full text-2xl text-gray-500 active:bg-gray-100" aria-label="Tháng trước">‹</button>
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-gray-800">Tháng {m}/{y}</div>
          <div className="text-xs"><span className="text-orange-700">tháng {midL.month} âm</span><span className="text-gray-400"> · </span><span className="text-emerald-700">{traiN} ngày trai</span></div>
        </div>
        <button onClick={() => shift(1)} className="w-11 h-11 rounded-full text-2xl text-gray-500 active:bg-gray-100" aria-label="Tháng sau">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WD.map(w => <div key={w} className={`text-center text-xs pb-1 ${w === 'CN' ? 'text-red-400' : 'text-gray-400'}`}>{w}</div>)}
        {cells.map(d => {
          const iso = getLocalDateString(d), L = lunarOf(iso), out = d.getMonth() !== m - 1
          const trai = isTraiDay(iso, cfg), isToday = iso === today, ts = byDay[iso] || []
          const open = ts.filter(t => !t.done).length
          const mark = open ? (iso < today ? 'bg-red-500' : 'bg-purple-500') : ts.length ? 'bg-emerald-400' : ''
          return (
            <button key={iso} onClick={() => onOpen(iso)}
              className={`relative rounded-xl flex flex-col items-center justify-center min-h-[50px] border-[1.5px] active:scale-95 transition-transform
                ${trai ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-transparent'} ${out ? 'opacity-35' : ''}`}
              aria-label={`Ngày ${d.getDate()}, ${L.day} tháng ${L.month} âm${trai ? ', ngày trai' : ''}${open ? `, ${open} việc` : ''}`}>
              <span className={`text-base font-semibold leading-none ${isToday ? 'bg-purple-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : d.getDay() === 0 ? 'text-red-500' : 'text-gray-900'}`}>{d.getDate()}</span>
              <span className={`text-[11px] leading-tight mt-0.5 ${trai ? 'text-emerald-700 font-semibold' : L.day === 1 || L.day === 15 ? 'text-orange-700 font-semibold' : 'text-orange-600/80'}`}>{lunarLabel(L)}</span>
              {mark && <i className={`absolute top-1 right-1 ${open > 1 ? 'min-w-[15px] h-[15px] px-0.5 text-[9px] leading-[15px] text-white not-italic' : 'w-2 h-2'} rounded-full ${mark}`}>{open > 1 ? open : ''}</i>}
            </button>
          )
        })}
      </div>
      <div className="flex justify-center gap-3 mt-2 text-[11px] text-gray-500">
        <span><b className="text-gray-900">16</b> dương</span><span><b className="text-orange-600">8</b> âm</span>
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-300"/>ngày trai</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-purple-500"/>có việc</span>
        <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-red-500"/>sót</span>
      </div>
    </div>
  )
}

// ── THẺ SẮP TỚI ──
function Upcoming({ U, today, cfg, onOpen }) {
  let nextTrai = null
  for (let i = 0; i < 31; i++) { const s = addDays(today, i); if (isTraiDay(s, cfg)) { nextTrai = [i, s]; break } }
  return (
    <div>
      {nextTrai && <div className="text-[13px] text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 my-1.5">
        🌿 {nextTrai[0] === 0 ? 'Hôm nay ngày trai — ăn chay' : nextTrai[0] === 1 ? 'Mai là ngày trai' : `Ngày trai tới: ${dm(nextTrai[1])} (${nextTrai[0]} ngày nữa)`}</div>}
      {U.late.map(t => <UpRow key={t.id} t={t} onOpen={onOpen} tag={`Quá ${daysBetween(today, t.due_date)} ngày`} cls="bg-red-100 text-red-700"/>)}
      {U.today.map(t => <UpRow key={t.id} t={t} onOpen={onOpen} tag="Hôm nay" cls="bg-purple-100 text-purple-700"/>)}
      {U.soon.map(t => { const n = daysBetween(t.due_date, today); return <UpRow key={t.id} t={t} onOpen={onOpen} tag={n === 1 ? 'Ngày mai' : `Còn ${n} ngày`} cls={n <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}/> })}
      {!U.late.length && !U.today.length && !U.soon.length && <p className="text-center text-sm text-gray-400 py-5">Không có việc nào trong 7 ngày tới · bấm vào một ngày để thêm</p>}
    </div>
  )
}

// ── THẺ DAILY ──
function DailyPanel({ list, prog, avg, running, runD, now, onStart, onStop, onTick, onStats, onAdd }) {
  const totalMin = list.filter(d => d.kind === 'time').reduce((a, d) => a + prog(d).minutes, 0)
  const forgot = running && runD && looksForgotten(running, runD, now)
  return (
    <div>
      <div className="flex items-center gap-3 py-2 border-b border-gray-100">
        <Ring pct={avg} color={avg >= 80 ? '#1D9E75' : avg >= 50 ? '#EF9F27' : '#E24B4A'} size={56} label={avg + '%'}/>
        <div className="flex-1"><div className="font-semibold text-gray-800">Hôm nay hoàn thành {avg}%</div>
          <div className="text-xs text-gray-500">{list.filter(d => prog(d).done).length}/{list.length} Daily đạt · tập trung {du(totalMin)}</div></div>
        <button onClick={onStats} className="text-sm text-purple-700 px-1 py-2">Thống kê ›</button>
      </div>
      {running && runD && (
        <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 my-2 text-white ${forgot ? 'bg-amber-600' : 'bg-emerald-600'}`}>
          <span className="text-xl">{runD.emoji}</span>
          <div className="flex-1"><div className="text-xs opacity-90">{forgot ? 'Bạn quên bấm kết thúc?' : `Đang làm · từ ${hhmm(running.start_at)}`}</div>
            <div className="font-semibold">{runD.name} · {du(Math.round((now - new Date(running.start_at)) / 60000))}</div></div>
          {forgot && <button onClick={() => onStop(new Date(new Date(running.start_at).getTime() + runD.target_min * 60000))}
            className="bg-white/20 rounded-full px-2.5 py-1.5 text-xs">Chỉ {du(runD.target_min)}</button>}
          <button onClick={() => onStop()} className="bg-white text-emerald-800 rounded-full px-3.5 py-2 text-sm font-semibold">Kết thúc</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 py-2.5">
        {list.map(d => {
          const p = prog(d), isRun = running?.daily_id === d.id
          return (
            <div key={d.id} className={`bg-gray-50 rounded-2xl p-2.5 flex flex-col gap-2 border-[1.5px] ${isRun ? 'border-emerald-500' : 'border-transparent'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="relative"><Ring pct={p.pct} color={d.color}/><span className="absolute inset-0 flex items-center justify-center text-base">{d.emoji}</span></div>
                <div className="min-w-0"><div className="text-[13px] font-semibold text-gray-800 truncate">{d.name}{d.shared && ' 👥'}</div>
                  <div className="text-xs text-gray-500">{d.kind === 'tick' ? (p.done ? 'Đã xong' : 'Chưa') : `${du(p.minutes)} / ${du(d.target_min)}`}</div></div>
              </div>
              {d.kind === 'tick'
                ? <button onClick={() => onTick(d)} className={`w-full py-2.5 rounded-xl text-[13px] font-semibold ${p.done ? 'bg-gray-200 text-gray-600' : 'bg-emerald-50 text-emerald-800'}`}>{p.done ? '✓ Xong' : 'Đánh dấu xong'}</button>
                : isRun ? <button onClick={() => onStop()} className="w-full py-2.5 rounded-xl text-[13px] font-semibold bg-emerald-600 text-white">■ Dừng</button>
                : <button onClick={() => onStart(d)} className={`w-full py-2.5 rounded-xl text-[13px] font-semibold ${p.done ? 'bg-gray-200 text-gray-600' : 'bg-emerald-50 text-emerald-800'}`}>{p.done ? '✓ Đạt · làm thêm' : p.minutes ? '▶ Tiếp tục' : '▶ Bắt đầu'}</button>}
            </div>
          )
        })}
        <button onClick={onAdd} className="rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 min-h-[96px]">+ Thêm Daily</button>
      </div>
    </div>
  )
}

// ── BẢNG CHI TIẾT NGÀY ──
function DaySheet({ iso, today, who, cfg, tasks, daily, logs, now, onClose, onAdd, onEdit, onDelete, onTick }) {
  const [text, setText] = useState('')
  const [opt, setOpt] = useState({ due_time: '', repeat: '', shared: false })
  const [editing, setEditing] = useState(null)
  const d = pdate(iso), L = lunarOf(iso), trai = isTraiDay(iso, cfg)
  const list = tasks.filter(t => t.due_date === iso).sort((a, b) => (a.due_time || '99').localeCompare(b.due_time || '99'))
  const ds = daily.filter(x => isDailyDay(x, iso))
  const add = () => { const t = text.trim(); if (!t) return; onAdd({ title: t, due_date: iso, ...opt, due_time: opt.due_time || null }); setText(''); setOpt({ due_time: '', repeat: '', shared: false }) }
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose}/>
      <div role="dialog" aria-label="Chi tiết ngày" className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-t-3xl z-[61] overflow-y-auto px-4 pt-2"
        style={{ maxHeight: '88dvh', paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={onClose} className="block w-10 h-1.5 rounded-full bg-gray-300 mx-auto mb-3" aria-label="Đóng"/>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-900">{iso === today ? 'Hôm nay' : WD_FULL[d.getDay()]}, {d.getDate()}/{d.getMonth() + 1}</div>
            <div className="text-sm text-orange-700">{L.day === 15 ? 'Rằm' : 'Mùng ' + L.day} tháng {L.month}{L.leap ? ' nhuận' : ''} âm{L.len === 29 && <span className="text-gray-400"> · tháng thiếu</span>}</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 text-gray-500" aria-label="Đóng">✕</button>
        </div>
        {trai && <div className="mt-3 bg-emerald-50 text-emerald-800 rounded-xl px-3 py-2.5 text-sm font-semibold">🌿 Ngày trai — ăn chay{isMakeupDay(iso) ? ' · ăn bù ngày 27 tháng thiếu' : ''}</div>}

        <div className="flex gap-2 mt-3">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="+ Thêm việc cho ngày này…" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
          <button onClick={add} className="bg-purple-600 text-white rounded-xl px-4 font-semibold">Thêm</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pt-2 no-scrollbar">
          {['', '08:00', '14:00', '20:00'].map(h => <Chip key={h} on={opt.due_time === h} onClick={() => setOpt(o => ({ ...o, due_time: h }))}>{h ? '⏰ ' + h : 'Cả ngày'}</Chip>)}
          <Chip on={opt.shared} onClick={() => setOpt(o => ({ ...o, shared: !o.shared }))}>👥 Chung với {PEOPLE[otherOf(who)]}</Chip>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pt-1.5 no-scrollbar">
          {Object.entries(REPEAT_LABEL).map(([k, v]) => <Chip key={k} on={opt.repeat === k} onClick={() => setOpt(o => ({ ...o, repeat: k }))}>{v}</Chip>)}
        </div>

        <div className="text-[13px] text-gray-400 mt-4 mb-1">To-do · {list.filter(t => !t.done).length} việc</div>
        {list.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Chưa có việc — gõ vào ô ở trên để thêm</p>}
        {list.map(t => editing === t.id
          ? <EditRow key={t.id} t={t} who={who} onCancel={() => setEditing(null)} onDelete={() => { onDelete(t.id); setEditing(null) }}
              onSave={f => { onEdit(t.id, f); setEditing(null) }}/>
          : (
            <div key={t.id} className="flex items-center gap-3 border-b border-gray-100">
              <button onClick={() => onTick(t)} aria-label={t.done ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}
                className={`w-8 h-8 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-white ${t.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{t.done && '✓'}</button>
              <button onClick={() => setEditing(t.id)} className="flex-1 text-left py-3">
                <div className={`text-[15px] ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{[t.due_time && '⏰ ' + t.due_time, t.repeat && '↻ ' + REPEAT_LABEL[t.repeat],
                  t.shared && (t.owner === who ? '👥 chung' : '👥 của ' + PEOPLE[t.owner])].filter(Boolean).join(' · ') || 'Bấm để sửa'}</div>
              </button>
            </div>
          ))}

        {ds.length > 0 && iso <= today && <>
          <div className="text-[13px] text-gray-400 mt-4 mb-1">Daily {iso === today ? 'hôm nay' : 'ngày này'}</div>
          <div className="flex gap-3 overflow-x-auto py-1 no-scrollbar">
            {ds.map(x => { const p = dailyProgress(x, logs, iso, now); return (
              <div key={x.id} className="flex flex-col items-center flex-shrink-0">
                <div className="relative"><Ring pct={p.pct} color={x.color} size={40}/><span className="absolute inset-0 flex items-center justify-center text-sm">{x.emoji}</span></div>
                <span className="text-[11px] text-gray-500">{p.pct}%</span></div>) })}
          </div>
          {iso === today && <p className="text-xs text-gray-400">Bấm giờ ở thẻ Daily bên dưới lịch</p>}
        </>}
      </div>
    </>
  )
}

function EditRow({ t, who, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ title: t.title, due_date: t.due_date, due_time: t.due_time || '', repeat: t.repeat || '', shared: t.shared })
  const canShare = t.owner === who
  return (
    <div className="bg-gray-50 rounded-2xl p-3 my-2 flex flex-col gap-2">
      <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
      <div className="flex gap-2">
        <input type="date" value={f.due_date || ''} onChange={e => e.target.value && setF({ ...f, due_date: e.target.value })} className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
        <select value={f.due_time} onChange={e => setF({ ...f, due_time: e.target.value })} className="flex-1 border border-gray-200 rounded-xl px-2 py-2.5 text-base bg-white">
          {[...new Set([...TIMES, f.due_time])].map(x => <option key={x} value={x}>{x || 'Cả ngày'}</option>)}
        </select>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {Object.entries(REPEAT_LABEL).map(([k, v]) => <button key={k} onClick={() => setF({ ...f, repeat: k })}
          className={`text-[13px] px-3 py-2 rounded-full whitespace-nowrap ${f.repeat === k ? 'bg-purple-100 text-purple-800' : 'bg-white text-gray-600'}`}>{v}</button>)}
        {canShare && <button onClick={() => setF({ ...f, shared: !f.shared })}
          className={`text-[13px] px-3 py-2 rounded-full whitespace-nowrap ${f.shared ? 'bg-purple-100 text-purple-800' : 'bg-white text-gray-600'}`}>👥 Chung</button>}
      </div>
      <div className="flex gap-2">
        {canShare && <button onClick={onDelete} className="flex-1 py-2.5 rounded-xl bg-white text-red-600 text-sm">Xoá</button>}
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white text-gray-600 text-sm">Huỷ</button>
        <button onClick={() => f.title.trim() && onSave({ ...f, title: f.title.trim(), due_time: f.due_time || null })}
          className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold">Lưu</button>
      </div>
    </div>
  )
}

// ── THỐNG KÊ ──
function StatsPage({ daily, logs, today, now, onBack }) {
  const [p, setP] = useState('day')
  const from = p === 'day' ? today : p === 'week' ? addDays(today, -6) : addDays(today, -29)
  const rows = useMemo(() => periodStats(daily, logs, from, today), [daily, logs, from, today])
  const todayRows = daily.filter(d => isDailyDay(d, today)).map(d => ({ daily: d, ...dailyProgress(d, logs, today, now) }))
  const parts = (p === 'day' ? todayRows.map(r => ({ v: r.minutes, d: r.daily })) : rows.map(r => ({ v: r.minutes, d: r.daily })))
    .filter(x => x.v > 0 && x.d.kind === 'time')
  const tot = parts.reduce((a, x) => a + x.v, 0)
  let a0 = -Math.PI / 2
  const R = 75, HOLE = 46
  return (
    <div className="pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30"><div className="max-w-2xl mx-auto px-2 py-2 flex items-center">
        <button onClick={onBack} className="w-11 h-11 text-2xl text-gray-500" aria-label="Quay lại">‹</button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800">Thống kê Daily</h2><span className="w-11"/></div></header>
      <div className="max-w-2xl mx-auto px-3 pt-3">
        <div className="flex gap-1 bg-gray-200/70 rounded-xl p-1 mb-3">
          {[['day', 'Hôm nay'], ['week', '7 ngày'], ['month', '30 ngày']].map(([k, v]) =>
            <button key={k} onClick={() => setP(k)} className={`flex-1 py-2 rounded-lg text-sm ${p === k ? 'bg-white font-semibold text-gray-800' : 'text-gray-500'}`}>{v}</button>)}
        </div>
        <div className="bg-white rounded-2xl p-3 mb-3">
          <div className="text-[13px] text-gray-500 mb-2">Thời gian cho từng Daily · tổng {du(tot)}</div>
          {tot === 0 ? <p className="text-sm text-gray-400 text-center py-6">Chưa có phiên bấm giờ nào trong khoảng này</p> :
            <div className="flex items-center gap-3">
              <svg width="150" height="150" viewBox="0 0 150 150" className="flex-shrink-0" role="img" aria-label="Biểu đồ tròn thời gian">
                {parts.map(x => {
                  const a1 = a0 + x.v / tot * Math.PI * 2, lg = a1 - a0 > Math.PI ? 1 : 0, pc = Math.round(x.v / tot * 100), mid = (a0 + a1) / 2
                  const P = (r, a) => `${75 + r * Math.cos(a)} ${75 + r * Math.sin(a)}`
                  const path = x.v / tot > 0.999
                    ? <circle key={x.d.id} cx="75" cy="75" r={(R + HOLE) / 2} fill="none" stroke={x.d.color} strokeWidth={R - HOLE}/>
                    : <path key={x.d.id} d={`M${P(R, a0)}A${R} ${R} 0 ${lg} 1 ${P(R, a1)}L${P(HOLE, a1)}A${HOLE} ${HOLE} 0 ${lg} 0 ${P(HOLE, a0)}Z`} fill={x.d.color} stroke="#fff" strokeWidth="1.5"/>
                  const lab = pc >= 9 && <text key={x.d.id + 't'} x={75 + (R + HOLE) / 2 * Math.cos(mid)} y={75 + (R + HOLE) / 2 * Math.sin(mid)} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fontWeight: 600, fill: '#fff' }}>{pc}%</text>
                  a0 = a1
                  return [path, lab]
                })}
              </svg>
              <div className="flex-1 min-w-0">{[...parts].sort((a, b) => b.v - a.v).map(x =>
                <div key={x.d.id} className="flex items-center gap-1.5 text-[13px] py-1"><i className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: x.d.color }}/>
                  <span className="flex-1 truncate">{x.d.emoji} {x.d.name}</span><b>{Math.round(x.v / tot * 100)}%</b></div>)}</div>
            </div>}
        </div>
        <div className="bg-white rounded-2xl p-3">
          <div className="text-[13px] text-gray-500 mb-2">{p === 'day' ? 'Mức hoàn thành hôm nay' : 'Số ngày đạt mục tiêu'}</div>
          <div className="grid grid-cols-3 gap-3">
            {(p === 'day' ? todayRows.map(r => ({ d: r.daily, pct: r.pct, sub: r.daily.kind === 'tick' ? (r.done ? 'xong' : 'chưa') : du(r.minutes) }))
              : rows.map(r => ({ d: r.daily, pct: r.pct, sub: `${r.hit}/${r.planned} ngày` }))).map(r =>
              <div key={r.d.id} className="flex flex-col items-center gap-1">
                <Ring pct={r.pct} color={r.d.color} size={58} label={r.pct + '%'}/>
                <span className="text-xs text-gray-700 text-center leading-tight">{r.d.emoji} {r.d.name}</span>
                <span className="text-[11px] text-gray-400">{r.sub}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CÀI ĐẶT ──
function SettingsPage({ who, cfg, onCfg, daily, onEditDaily, onSwitch, onBack }) {
  const toast = useToast()
  const [pinMode, setPinMode] = useState(false), [p1, setP1] = useState('')
  const changePin = async () => {
    try { await setPin(who, p1); toast.success('Đã đổi mã PIN'); setPinMode(false); setP1('') } catch (e) { toast.error(e.message) }
  }
  return (
    <div className="pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30"><div className="max-w-2xl mx-auto px-2 py-2 flex items-center">
        <button onClick={onBack} className="w-11 h-11 text-2xl text-gray-500" aria-label="Quay lại">‹</button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800">Cài đặt Việc</h2><span className="w-11"/></div></header>
      <div className="max-w-2xl mx-auto px-3 pt-3 flex flex-col gap-3">
        <div className="bg-white rounded-2xl px-4">
          <div className="text-xs text-gray-400 pt-3">Ngày trai · chung cả nhà</div>
          <SetRow title="Đánh dấu 10 ngày trai" sub="Mùng 1, 8, 14, 15, 18, 23, 24, 28, 29, 30 âm"><Switch on={cfg.trai} onClick={() => onCfg({ ...cfg, trai: !cfg.trai })} label="Đánh dấu ngày trai"/></SetRow>
          <SetRow title="Tháng thiếu ăn bù ngày 27" sub="Tháng âm 29 ngày không có ngày 30"><Switch on={cfg.bu27} onClick={() => onCfg({ ...cfg, bu27: !cfg.bu27 })} label="Ăn bù ngày 27"/></SetRow>
          <SetRow title="Nhắc ngày trai lúc" sub="Dùng khi bật thông báo (bước sau)">
            <select value={cfg.traiAt} onChange={e => onCfg({ ...cfg, traiAt: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-base bg-white">
              {['05:00', '05:30', '06:00', '06:30', '07:00'].map(x => <option key={x}>{x}</option>)}</select></SetRow>
        </div>
        <div className="bg-white rounded-2xl px-4">
          <div className="flex items-center pt-3"><span className="text-xs text-gray-400 flex-1">Daily của {PEOPLE[who]}</span>
            <button onClick={() => onEditDaily(null)} className="text-sm text-purple-700 font-medium py-1">+ Thêm</button></div>
          {daily.filter(d => d.owner === who || d.shared).map(d => (
            <button key={d.id} onClick={() => onEditDaily(d)} className={`w-full flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 text-left ${d.archived ? 'opacity-45' : ''}`}>
              <span className="text-xl">{d.emoji}</span>
              <div className="flex-1 min-w-0"><div className="text-[15px] text-gray-800">{d.name}{d.shared && ' 👥'}{d.archived && ' · đã lưu trữ'}</div>
                <div className="text-xs text-gray-500">{[d.start_time, d.kind === 'tick' ? 'đánh dấu' : du(d.target_min), d.weekdays === '1234567' ? 'mỗi ngày' : d.weekdays.split('').map(n => WD[n - 1]).join(', ')].filter(Boolean).join(' · ')}</div></div>
              <span className="text-gray-300 text-xl">›</span></button>))}
          {daily.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Chưa có Daily nào</p>}
        </div>
        <div className="bg-white rounded-2xl px-4">
          <div className="text-xs text-gray-400 pt-3">Tài khoản</div>
          <SetRow title="Đổi mã PIN" sub={`Mã riêng của ${PEOPLE[who]}`}><button onClick={() => setPinMode(!pinMode)} className="text-sm text-purple-700">{pinMode ? 'Đóng' : 'Đổi'}</button></SetRow>
          {pinMode && <div className="flex gap-2 pb-3"><input inputMode="numeric" maxLength={4} value={p1} onChange={e => setP1(e.target.value.replace(/\D/g, ''))}
            placeholder="4 số mới" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
            <button onClick={changePin} className="bg-purple-600 text-white rounded-xl px-4 font-semibold">Lưu</button></div>}
          <SetRow title={`Đổi sang ${PEOPLE[otherOf(who)]}`} sub="Máy này sẽ hỏi mã PIN của người kia"><button onClick={onSwitch} className="text-sm text-red-600">Đổi người</button></SetRow>
        </div>
      </div>
    </div>
  )
}

// ── THÊM / SỬA DAILY ──
function DailyForm({ initial, who, onSave, onBack }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: '', emoji: '⭐', color: '#7F77DD', kind: 'time', target_min: 30, start_time: '', weekdays: '1234567', remind: false, shared: false })
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const toggleDay = n => set('weekdays', f.weekdays.includes(n) ? f.weekdays.replace(n, '') : [...f.weekdays + n].sort().join(''))
  const save = () => {
    if (!f.name.trim()) return
    if (!f.weekdays) return
    const { id, name, emoji, color, kind, target_min, start_time, weekdays, remind, shared, archived } = f
    onSave({ ...(id ? { id } : {}), name: name.trim(), emoji, color, kind, target_min: kind === 'tick' ? 1 : target_min,
      start_time: start_time || null, weekdays, remind: !!(remind && start_time), shared: !!shared, archived: !!archived })
  }
  const canShare = !initial || initial.owner === who
  return (
    <div className="pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30"><div className="max-w-2xl mx-auto px-2 py-2 flex items-center">
        <button onClick={onBack} className="w-11 h-11 text-2xl text-gray-500" aria-label="Quay lại">‹</button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800">{initial ? 'Sửa Daily' : 'Thêm Daily'}</h2><span className="w-11"/></div></header>
      <div className="max-w-2xl mx-auto px-3 pt-3"><div className="bg-white rounded-2xl p-4 flex flex-col gap-4">
        <label className="block"><span className="text-xs text-gray-500">Tên</span>
          <input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Ví dụ: Học tiếng Trung" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/></label>
        <div><span className="text-xs text-gray-500">Biểu tượng</span><div className="flex flex-wrap gap-1.5 mt-1">{EMOJI.map(e => <Chip key={e} on={f.emoji === e} onClick={() => set('emoji', e)} cls="text-lg px-2.5 py-1">{e}</Chip>)}</div></div>
        <div><span className="text-xs text-gray-500">Màu</span><div className="flex flex-wrap gap-2.5 mt-1">{COLORS.map(c =>
          <button key={c} onClick={() => set('color', c)} aria-label={'Màu ' + c} className="w-8 h-8 rounded-full" style={{ background: c, outline: f.color === c ? '2px solid #1F2937' : 'none', outlineOffset: 2 }}/>)}</div></div>
        <div><span className="text-xs text-gray-500">Cách theo dõi</span><div className="flex gap-1.5 mt-1">
          <Chip on={f.kind === 'time'} onClick={() => set('kind', 'time')}>⏱ Bấm giờ</Chip><Chip on={f.kind === 'tick'} onClick={() => set('kind', 'tick')}>✓ Chỉ đánh dấu xong</Chip></div></div>
        {f.kind === 'time' && <div><span className="text-xs text-gray-500">Mục tiêu mỗi ngày</span><div className="flex flex-wrap gap-1.5 mt-1">
          {[15, 20, 30, 45, 60, 90, 120].map(m => <Chip key={m} on={f.target_min === m} onClick={() => set('target_min', m)}>{du(m)}</Chip>)}</div></div>}
        <div><span className="text-xs text-gray-500">Ngày làm</span><div className="flex gap-1.5 mt-1">
          {WD.map((w, i) => <Chip key={w} on={f.weekdays.includes(String(i + 1))} onClick={() => toggleDay(String(i + 1))} cls="flex-1 px-0">{w}</Chip>)}</div>
          {!f.weekdays && <p className="text-xs text-red-500 mt-1">Chọn ít nhất một ngày</p>}</div>
        <label className="block"><span className="text-xs text-gray-500">Giờ bắt đầu · để trống nếu làm lúc nào cũng được</span>
          <input type="time" value={f.start_time || ''} onChange={e => set('start_time', e.target.value)} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/></label>
        {canShare && <label className="flex items-center gap-3"><input type="checkbox" checked={!!f.shared} onChange={e => set('shared', e.target.checked)} className="w-5 h-5"/>
          <span className="text-[15px]">Chia sẻ với {PEOPLE[otherOf(who)]} <span className="block text-xs text-gray-500">Cả hai cùng thấy, mỗi người bấm giờ riêng</span></span></label>}
      </div>
      <div className="flex gap-2 mt-3">
        {initial && <button onClick={() => onSave({ id: initial.id, archived: !initial.archived })} className="flex-1 py-3 rounded-xl bg-white text-gray-600">{initial.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</button>}
        <button onClick={save} className="flex-[2] py-3 rounded-xl bg-purple-600 text-white font-semibold">{initial ? 'Lưu' : 'Thêm Daily'}</button>
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">Lưu trữ thì ẩn khỏi lịch nhưng giữ nguyên lịch sử thống kê</p></div>
    </div>
  )
}
