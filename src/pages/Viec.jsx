// ============================================
// TAB VIỆC — Lịch âm dương, To-do, Daily, ngày trai
// Màn chính chỉ có lịch; bấm ngày mở bảng chi tiết.
// ============================================
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useToast } from '../components/Toast'
import { getLocalDateString } from '../lib/helpers'
import { lunarOf, isTraiDay, isMakeupDay, hairOf } from '../lib/lunar'
import {
  PEOPLE, otherOf, getWho, setWho, hasPin, setPin, checkPin, getCfg, saveCfg, DEFAULT_CFG,
  loadAll, createTask, updateTask, deleteTask, toggleTask, saveDaily, startTimer, stopTimer, toggleTick,
  saveProject, deleteProject, setProjectShared, projectProgress, projectGroups,
  addDays, daysBetween, isDailyDay, dailyProgress, runningLog, looksForgotten, upcoming, periodStats,
} from '../lib/viec'
import { isSeries, occurrencesBetween, nextOccurrences, isDoneOn, describe, UNITS } from '../lib/recur'
import { loadLinks, getLinkPrefs, saveLinkPrefs, linkMarks, linkGroups, DEFAULT_LINKS } from '../lib/viecLinks'
import { pushSupport, enablePush, disablePush, isRegistered, sendTest, moveSubscription, getPrefs, savePrefs, DEFAULT_PREFS } from '../lib/viecPush'

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


// Khung ngày lịch tháng hiển thị (bắt đầu Thứ Hai, 5–6 tuần)
function gridRange(month) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
  const cells = []
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (i >= 35 && d.getMonth() !== m - 1) break; cells.push(d) }
  return cells
}

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
function UpRow({ t, date, tag, cls, onOpen }) {
  return <button onClick={() => onOpen(date)} className="w-full flex items-center gap-2.5 py-3 border-b border-gray-100 last:border-0 text-left active:bg-gray-50">
    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap min-w-[72px] text-center ${cls}`}>{tag}</span>
    <span className="flex-1 text-sm text-gray-800">{t.title}{isSeries(t) && ' ↻'}{t.shared && ' 👥'}</span>
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

export default function Viec({ onNavigate }) {
  const toast = useToast()
  const today = getLocalDateString()
  const [who, setWhoState] = useState(getWho)
  const [data, setData] = useState({ tasks: [], daily: [], logs: [], projects: [] })
  const [cfg, setCfgState] = useState(DEFAULT_CFG)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('main')                // main | stat | set | daily
  const [month, setMonth] = useState(today.slice(0, 7))
  const [sel, setSel] = useState(null)                    // ngày đang mở bảng chi tiết
  const [tab, setTab] = useState('up')
  const [now, setNow] = useState(Date.now())
  const [editDaily, setEditDaily] = useState(null)
  const [projId, setProjId] = useState(null)
  const [linkPrefs, setLinkPrefs] = useState(DEFAULT_LINKS)
  const [links, setLinks] = useState([])
  const [linkTick, setLinkTick] = useState(0)                // tăng để tải lại mốc khi quay lại app

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
  // Mốc từ Trang sức & Lab cho khung lịch đang xem (chỉ đọc)
  useEffect(() => { if (who) getLinkPrefs(who).then(setLinkPrefs).catch(() => {}) }, [who])
  useEffect(() => {
    if (!who) return
    const cells = gridRange(month), from = getLocalDateString(cells[0]), to = getLocalDateString(cells[cells.length - 1])
    let alive = true
    loadLinks(from, to, linkPrefs).then(ev => { if (alive) setLinks(ev) }).catch(() => {})
    return () => { alive = false }
  }, [who, month, linkPrefs, linkTick])
  // Hai người dùng hai máy: quay lại app thì lấy dữ liệu mới nhất (việc chung người kia vừa thêm, ngày mới…)
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && !busy.current) { setNow(Date.now()); load(); setLinkTick(x => x + 1) } }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const [pushLost, setPushLost] = useState(false)
  useEffect(() => {                                // đổi người trên máy này → thông báo đi theo người mới
    if (who) moveSubscription(who).catch(() => {})
  }, [who])
  useEffect(() => {                                // đã cho phép mà mất đăng ký (iPhone hay bị sau cập nhật) → nhắc bật lại
    if (!who || view !== 'main') return
    const sp = pushSupport()
    if (sp.supported && sp.permission === 'granted') isRegistered().then(r => setPushLost(!r)).catch(() => {})
    else setPushLost(false)
  }, [who, view])
  const running = useMemo(() => runningLog(data.logs, who), [data.logs, who])
  const marks = useMemo(() => linkMarks(links), [links])            // chỉ tính lại khi mốc đổi
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
  const tick = (task, iso) => run(async () => {
    const { updated } = await toggleTask(task, iso)
    patch('tasks', ts => ts.map(x => x.id === task.id ? updated : x))
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
  const saveP = (fields) => run(async () => {
    const before = fields.id && data.projects.find(x => x.id === fields.id)
    const p = await saveProject(fields)
    patch('projects', ps => fields.id ? ps.map(x => x.id === p.id ? p : x) : [...ps, p])
    if (before && 'shared' in fields && !!before.shared !== !!fields.shared) {     // đổi chia sẻ → việc trong dự án đổi theo
      const changed = await setProjectShared(p.id, !!fields.shared)
      const byId = Object.fromEntries(changed.map(t => [t.id, t]))
      patch('tasks', ts => ts.map(t => byId[t.id] || t))
    }
  })
  const removeP = (id) => run(async () => {
    await deleteProject(id)
    patch('projects', ps => ps.filter(x => x.id !== id))
    patch('tasks', ts => ts.map(t => t.project_id === id ? { ...t, project_id: null } : t))   // việc vẫn giữ
    setView('proj'); setProjId(null)
  }, 'Đã xoá dự án, việc vẫn giữ')

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
        <h2 className="text-lg font-bold text-gray-800 flex-1 truncate">📅 {PEOPLE[who]}</h2>
        <button onClick={() => { setMonth(today.slice(0, 7)); setSel(today) }}
          className="text-sm px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 font-medium active:scale-95">Hôm nay</button>
        <button onClick={() => setView('proj')} className="w-10 h-10 rounded-full text-lg active:bg-gray-100" aria-label="Dự án">📁</button>
        <button onClick={() => setView('set')} className="w-10 h-10 rounded-full text-lg active:bg-gray-100" aria-label="Cài đặt">⚙️</button>
      </div>
    </header>
  )

  if (view === 'proj') return <ProjectsPage who={who} projects={data.projects} tasks={data.tasks} today={today}
    onOpen={id => { setProjId(id); setView('projd') }} onSave={saveP} onBack={() => setView('main')}/>
  const curProj = data.projects.find(p => p.id === projId)
  if (view === 'projd' && curProj) return <ProjectDetail who={who} project={curProj} projects={data.projects} tasks={data.tasks} today={today}
    onSaveProject={saveP} onDeleteProject={removeP} onAdd={addTask} onEdit={editTask} onDelete={removeTask}
    onTick={t => tick(t, today)} onOpenDay={iso => { setView('main'); setMonth(iso.slice(0, 7)); setSel(iso) }}
    onBack={() => setView('proj')}/>
  if (view === 'stat') return <StatsPage daily={daily} logs={data.logs} today={today} now={now} onBack={() => setView('main')}/>
  if (view === 'daily') return <DailyForm initial={editDaily} who={who} onSave={saveD} onBack={() => { setView('set'); setEditDaily(null) }}/>
  if (view === 'set') return <SettingsPage who={who} cfg={cfg} onCfg={updCfg} daily={data.daily}
    linkPrefs={linkPrefs} onLinkPrefs={p => { setLinkPrefs(p); saveLinkPrefs(who, p).catch(e => toast.error('Lỗi: ' + e.message)) }}
    onEditDaily={d => { setEditDaily(d); setView('daily') }}
    onSwitch={() => { loaded.current = false; setWho(null); setWhoState(null); setView('main'); setData({ tasks: [], daily: [], logs: [], projects: [] }) }}
    onBack={() => setView('main')}/>

  return (
    <div className="pb-6">
      {header}
      <div className="max-w-2xl mx-auto px-3 pt-2">
        {pushLost && <button onClick={() => setView('set')} className="w-full mb-2 text-left text-sm bg-amber-50 text-amber-800 rounded-xl px-3 py-2.5">🔕 Thông báo đang tắt trên máy này — bấm để bật lại</button>}
        <Calendar month={month} setMonth={setMonth} today={today} tasks={data.tasks} cfg={cfg} onOpen={setSel} marks={marks} showHair={linkPrefs.hair !== false}/>

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

      {sel && <DaySheet iso={sel} today={today} who={who} cfg={cfg} showHair={linkPrefs.hair !== false} tasks={data.tasks} projects={data.projects} daily={daily} logs={data.logs} now={now}
        links={linkGroups(links, sel)} onNavigate={tab => { setSel(null); onNavigate?.(tab) }}
        onClose={() => setSel(null)} onAdd={addTask} onEdit={editTask} onDelete={removeTask} onTick={tick}
        onMove={iso => setSel(iso)}/>}
    </div>
  )
}

// ── LỊCH THÁNG ──
function Calendar({ month, setMonth, today, tasks, cfg, onOpen, marks = {}, showHair = true }) {
  const [y, m] = month.split('-').map(Number)
  const cells = gridRange(month)
  const from = getLocalDateString(cells[0]), to = getLocalDateString(cells[cells.length - 1])
  const byDay = useMemo(() => {                         // mọi lần lặp rơi vào khung đang xem
    const o = {}
    tasks.forEach(t => occurrencesBetween(t, from, to).forEach(d => (o[d] = o[d] || []).push({ t, done: isDoneOn(t, d) })))
    return o
  }, [tasks, from, to])
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
          const open = ts.filter(x => !x.done).length
          const mark = open ? (iso < today ? 'bg-red-500' : 'bg-purple-500') : ts.length ? 'bg-emerald-400' : ''
          return (
            <button key={iso} onClick={() => onOpen(iso)}
              className={`relative rounded-xl flex flex-col items-center justify-center min-h-[50px] border-[1.5px] active:scale-95 transition-transform
                ${trai ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-transparent'} ${out ? 'opacity-35' : ''}`}
              aria-label={`Ngày ${d.getDate()}, ${L.day} tháng ${L.month} âm${trai ? ', ngày trai' : ''}${showHair && hairOf(iso)?.good ? ', ngày tốt cắt tóc' : ''}${open ? `, ${open} việc` : ''}${marks[iso] ? ', có mốc Trang sức/Lab' : ''}`}>
              <span className={`text-base font-semibold leading-none ${isToday ? 'bg-purple-600 text-white w-7 h-7 rounded-full flex items-center justify-center' : d.getDay() === 0 ? 'text-red-500' : 'text-gray-900'}`}>{d.getDate()}</span>
              <span className={`text-[11px] leading-tight mt-0.5 ${trai ? 'text-emerald-700 font-semibold' : L.day === 1 || L.day === 15 ? 'text-orange-700 font-semibold' : 'text-orange-600/80'}`}>{lunarLabel(L)}</span>
              {showHair && hairOf(iso)?.good && <span className="absolute bottom-0.5 right-1 text-[10px] leading-none font-bold text-red-600" aria-hidden="true">✂</span>}
              {(marks[iso]?.jewelry || marks[iso]?.lab) && <span className="absolute top-0.5 left-1 text-[9px] leading-none" aria-hidden="true">{marks[iso].jewelry ? '💎' : ''}{marks[iso].lab ? '🧪' : ''}</span>}
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
        <span>💎🧪 mốc</span>
        {showHair && <span><b className="text-red-600">✂</b> tốt cắt tóc</span>}
      </div>
      {showHair && (() => {                                  // ngày tốt cắt tóc trong tháng đang xem
        const good = cells.filter(d => d.getMonth() === m - 1).map(d => getLocalDateString(d)).filter(s => hairOf(s)?.good)
        return good.length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar items-center">
          <span className="text-xs text-gray-500 flex-shrink-0">✂ Tháng này:</span>
          {good.map(s => <button key={s} onClick={() => onOpen(s)} className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-full ${s < today ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-700 font-semibold'}`}
            title={hairOf(s).text}>{dm(s)}</button>)}
        </div>
      })()}
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
      {U.late.map(({ t, date }) => <UpRow key={t.id + date} t={t} date={date} onOpen={onOpen} tag={`Quá ${daysBetween(today, date)} ngày`} cls="bg-red-100 text-red-700"/>)}
      {U.today.map(({ t, date }) => <UpRow key={t.id + date} t={t} date={date} onOpen={onOpen} tag="Hôm nay" cls="bg-purple-100 text-purple-700"/>)}
      {U.soon.map(({ t, date }) => { const n = daysBetween(date, today); return <UpRow key={t.id + date} t={t} date={date} onOpen={onOpen} tag={n === 1 ? 'Ngày mai' : `Còn ${n} ngày`} cls={n <= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}/> })}
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

// ── BỘ CHỌN LẶP LẠI ──
// Lựa chọn nhanh + Tuỳ chỉnh (mỗi N ngày/tuần/tháng/năm, bắt đầu, kết thúc) + xem trước các lần tới
const PRESETS = [
  ['', 1, 'Không lặp'], ['day', 1, 'Hằng ngày'], ['week', 1, 'Hằng tuần'], ['week', 2, '2 tuần'],
  ['month', 1, 'Hằng tháng'], ['month', 3, '3 tháng'], ['month', 6, '6 tháng'], ['year', 1, 'Hằng năm'], ['lunar', 1, 'Mùng 1 & Rằm'],
]
function RepeatPicker({ value, onChange }) {
  const v = value, set = patch => onChange({ ...v, ...patch })
  const isPreset = !v.custom && PRESETS.some(([u, n]) => u === v.unit && (u === '' || u === 'lunar' || n === v.every))
  const preview = v.unit ? nextOccurrences({ repeat_unit: v.unit, repeat_every: v.every, repeat_start: v.start, repeat_until: v.until || null }, v.start, 4) : []
  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {PRESETS.map(([u, n, label]) => (
          <Chip key={label} on={isPreset && v.unit === u && (u === '' || u === 'lunar' || v.every === n)}
            onClick={() => set({ unit: u, every: n, custom: false })}>{label}</Chip>))}
        <Chip on={!isPreset} onClick={() => set({ custom: true, unit: !v.unit || v.unit === 'lunar' ? 'week' : v.unit })}>Tuỳ chỉnh…</Chip>
      </div>
      {!isPreset && (
        <div className="bg-gray-50 rounded-2xl p-3 mt-2 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 w-[70px]">Mỗi</span>
            <button onClick={() => set({ every: Math.max(1, v.every - 1) })} className="w-10 h-10 rounded-full bg-white text-xl" aria-label="Bớt">−</button>
            <span className="w-8 text-center text-lg font-semibold">{v.every}</span>
            <button onClick={() => set({ every: Math.min(99, v.every + 1) })} className="w-10 h-10 rounded-full bg-white text-xl" aria-label="Thêm">+</button>
            <select value={v.unit} onChange={e => set({ unit: e.target.value })}
              className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-base bg-white">
              {Object.entries(UNITS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2"><span className="text-sm text-gray-600 w-[70px]">Bắt đầu</span>
            <input type="date" value={v.start} onChange={e => e.target.value && set({ start: e.target.value })} className="flex-1 min-w-0 block appearance-none border border-gray-200 rounded-xl px-3 py-2 text-base bg-white"/></label>
          <div className="flex items-center gap-2"><span className="text-sm text-gray-600 w-[70px]">Kết thúc</span>
            <Chip on={!v.until} onClick={() => set({ until: '' })}>Không bao giờ</Chip>
            <input type="date" value={v.until || ''} min={v.start} onChange={e => set({ until: e.target.value })}
              className={`flex-1 min-w-0 block appearance-none border rounded-xl px-2 py-2 text-base bg-white ${v.until ? 'border-purple-300' : 'border-gray-200'}`}/></div>
        </div>
      )}
      {v.unit && (
        <div className="mt-2 text-[13px] text-gray-600 bg-purple-50 rounded-xl px-3 py-2">
          <div className="font-medium text-purple-800">↻ {describe({ repeat_unit: v.unit, repeat_every: v.every, repeat_start: v.start, repeat_until: v.until || null })}</div>
          <div className="mt-0.5">Các lần tới: {preview.length ? preview.map(dm).join(' · ') : 'không còn lần nào'}</div>
        </div>
      )}
    </div>
  )
}
const repeatFields = r => r.unit
  ? { repeat_unit: r.unit, repeat_every: r.unit === 'lunar' ? 1 : r.every, repeat_start: r.start, repeat_until: r.until || null, due_date: r.start }
  : { repeat_unit: '', repeat_every: 1, repeat_start: null, repeat_until: null }

// ── BẢNG CHI TIẾT NGÀY ──
function DaySheet({ iso, today, who, cfg, showHair = true, tasks, projects = [], daily, logs, now, links = [], onNavigate, onClose, onAdd, onEdit, onDelete, onTick }) {
  const [text, setText] = useState('')
  const [opt, setOpt] = useState({ due_time: '', shared: false, project_id: '' })
  const [rep, setRep] = useState({ unit: '', every: 1, start: iso, until: '', custom: false })
  const [editing, setEditing] = useState(null)
  const d = pdate(iso), L = lunarOf(iso), trai = isTraiDay(iso, cfg)
  const hair = hairOf(iso)
  const nextGood = hair && !hair.good ? (() => { for (let i = 1; i <= 10; i++) { const s = addDays(iso, i); if (hairOf(s)?.good) return s } return null })() : null
  const list = tasks.filter(t => occurrencesBetween(t, iso, iso).length).sort((a, b) => (a.due_time || '99').localeCompare(b.due_time || '99'))
  const ds = daily.filter(x => isDailyDay(x, iso))
  const add = () => {
    const t = text.trim(); if (!t) return
    onAdd({ title: t, due_date: iso, due_time: opt.due_time || null, shared: opt.shared, project_id: opt.project_id || null, ...repeatFields(rep) })
    setText(''); setOpt({ due_time: '', shared: false, project_id: '' }); setRep({ unit: '', every: 1, start: iso, until: '', custom: false })
  }
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
        {showHair && hair && (
          <div className={`mt-2 rounded-xl px-3 py-2.5 border-[1.5px] ${hair.good ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="text-xs text-gray-500">✂️ Cắt tóc, cắt móng tay</div>
            <div className={`text-[16px] mt-0.5 ${hair.good ? 'text-red-700 font-bold' : 'text-gray-900'}`}>{hair.text}</div>
            <div className={`text-xs mt-0.5 ${hair.good ? 'text-red-600' : 'text-gray-500'}`}>
              {hair.good ? 'Ngày tốt' : 'Không nên'}{!hair.good && nextGood && ` · ngày tốt gần nhất ${dm(nextGood)}: ${hairOf(nextGood).text}`}</div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="+ Thêm việc cho ngày này…" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
          <button onClick={add} className="bg-purple-600 text-white rounded-xl px-4 font-semibold">Thêm</button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pt-2 no-scrollbar">
          {['', '08:00', '14:00', '20:00'].map(h => <Chip key={h} on={opt.due_time === h} onClick={() => setOpt(o => ({ ...o, due_time: h }))}>{h ? '⏰ ' + h : 'Cả ngày'}</Chip>)}
          <Chip on={opt.shared} onClick={() => setOpt(o => ({ ...o, shared: !o.shared }))}>👥 Chung với {PEOPLE[otherOf(who)]}</Chip>
        </div>
        <div className="pt-1.5"><RepeatPicker value={rep} onChange={setRep}/></div>
        {projects.some(p => !p.archived) && <div className="flex gap-1.5 overflow-x-auto pt-1.5 no-scrollbar">
          <Chip on={!opt.project_id} onClick={() => setOpt(o => ({ ...o, project_id: '' }))}>Không thuộc dự án</Chip>
          {projects.filter(p => !p.archived).map(p => <Chip key={p.id} on={opt.project_id === p.id} onClick={() => setOpt(o => ({ ...o, project_id: p.id, shared: o.shared || p.shared }))}>{p.emoji} {p.name}</Chip>)}
        </div>}

        <div className="text-[13px] text-gray-400 mt-4 mb-1">To-do · {list.filter(t => !isDoneOn(t, iso)).length} việc</div>
        {list.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Chưa có việc — gõ vào ô ở trên để thêm</p>}
        {list.map(t => {
          const done = isDoneOn(t, iso), next = isSeries(t) ? nextOccurrences(t, addDays(iso, 1), 1)[0] : null
          return editing === t.id
            ? <EditRow key={t.id} t={t} who={who} projects={projects} tasks={tasks} onCancel={() => setEditing(null)} onDelete={() => { onDelete(t.id); setEditing(null) }}
                onSave={f => { onEdit(t.id, f); setEditing(null) }}/>
            : (
              <div key={t.id} className="flex items-center gap-3 border-b border-gray-100">
                <button onClick={() => onTick(t, iso)} aria-label={done ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}
                  className={`w-8 h-8 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-white ${done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{done && '✓'}</button>
                <button onClick={() => setEditing(t.id)} className="flex-1 text-left py-3">
                  <div className={`text-[15px] ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{[t.due_time && '⏰ ' + t.due_time,
                    t.project_id && (p => p ? p.emoji + ' ' + p.name + (t.group_name ? ' · ' + t.group_name : '') : null)(projects.find(p => p.id === t.project_id)),
                    t.shared && (t.owner === who ? '👥 chung' : '👥 của ' + PEOPLE[t.owner])].filter(Boolean).join(' · ') || (isSeries(t) ? '' : 'Bấm để sửa')}</div>
                  {isSeries(t) && <div className="text-xs text-purple-700 mt-0.5">↻ {describe(t)}{next ? ` · lần tới ${dm(next)}` : ' · lần cuối'}</div>}
                </button>
              </div>
            )
        })}

        {links.length > 0 && <>
          <div className="text-[13px] text-gray-400 mt-4 mb-1">Từ Trang sức & Lab · chỉ xem</div>
          {links.map(g => (
            <button key={g.kind} onClick={() => onNavigate?.(g.src)} className="w-full flex items-start gap-2.5 py-2.5 border-b border-gray-100 last:border-0 text-left active:bg-gray-50">
              <span className="text-lg leading-none mt-0.5">{g.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-gray-800">{g.src === 'jewelry' ? '💎' : '🧪'} {g.label}{g.items.length > 1 ? ` · ${g.items.length}` : ''}</div>
                <div className="text-xs text-gray-500 truncate">{g.items.slice(0, 3).join(' · ')}{g.items.length > 3 ? ` · +${g.items.length - 3}` : ''}</div>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          ))}
        </>}

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

function EditRow({ t, who, projects = [], tasks = [], onSave, onCancel, onDelete }) {
  const series = isSeries(t)
  const [f, setF] = useState({ title: t.title, due_date: t.due_date, due_time: t.due_time || '', shared: t.shared, project_id: t.project_id || '', group_name: t.group_name || '' })
  const [rep, setRep] = useState(series
    ? { unit: t.repeat_unit, every: t.repeat_every || 1, start: t.repeat_start || t.due_date, until: t.repeat_until || '', custom: false }
    : { unit: '', every: 1, start: t.due_date, until: '', custom: false })
  const [confirmDel, setConfirmDel] = useState(false), [err, setErr] = useState('')
  const canShare = t.owner === who
  const save = () => {
    if (!f.title.trim()) { setErr('Chưa có tên việc'); return }
    const proj = projects.find(p => p.id === f.project_id)
    const base = { title: f.title.trim(), due_time: f.due_time || null, shared: f.shared || !!proj?.shared,      // vào dự án chung → việc thành chung
      project_id: f.project_id || null, group_name: f.project_id ? (f.group_name.trim() || null) : null }
    // Không lặp: ngày lấy từ ô ngày. Có lặp: ngày bắt đầu lấy từ bộ chọn lặp.
    if (!rep.unit && !f.due_date && !f.project_id) { setErr('Việc không thuộc dự án cần có ngày — nếu không sẽ không hiện ở đâu cả'); return }
    onSave(rep.unit ? { ...base, ...repeatFields(rep) } : { ...base, due_date: f.due_date || null, ...repeatFields(rep) })
  }
  return (
    <div className="bg-gray-50 rounded-2xl p-3 my-2 flex flex-col gap-2">
      <input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
      <div className="flex gap-2">
        {!rep.unit && <input type="date" value={f.due_date || ''} onChange={e => (e.target.value || f.project_id) && setF({ ...f, due_date: e.target.value || null })}
          className="flex-1 min-w-0 block appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-base bg-white" aria-label="Ngày"/>}
        <select value={f.due_time} onChange={e => setF({ ...f, due_time: e.target.value })} className="flex-1 border border-gray-200 rounded-xl px-2 py-2.5 text-base bg-white" aria-label="Giờ">
          {[...new Set([...TIMES, f.due_time])].map(x => <option key={x} value={x}>{x || 'Cả ngày'}</option>)}
        </select>
        {canShare && <Chip on={f.shared} onClick={() => setF({ ...f, shared: !f.shared })}>👥 Chung</Chip>}
      </div>
      {!rep.unit && f.project_id && f.due_date && <button onClick={() => setF({ ...f, due_date: null })} className="self-start text-xs text-gray-500 underline">Bỏ ngày (chỉ để trong dự án)</button>}
      <RepeatPicker value={rep} onChange={r => setRep(r.unit && !rep.unit ? { ...r, start: r.start || f.due_date || getLocalDateString() } : r)}/>
      {projects.length > 0 && <div className="flex gap-2">
        <select value={f.project_id} onChange={e => setF({ ...f, project_id: e.target.value })} aria-label="Dự án" className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2.5 text-base bg-white">
          <option value="">Không thuộc dự án</option>
          {projects.filter(p => !p.archived || p.id === f.project_id).map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
        </select>
        {f.project_id && <input value={f.group_name} onChange={e => setF({ ...f, group_name: e.target.value })} placeholder="Nhóm" list={'g-' + f.project_id}
          className="w-[38%] min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>}
        {f.project_id && <datalist id={'g-' + f.project_id}>{projectGroups(f.project_id, tasks).map(x => <option key={x} value={x}/>)}</datalist>}
      </div>}
      {series && <p className="text-xs text-gray-500">Sửa ở đây áp dụng cho cả chuỗi. Các lần đã tick vẫn được giữ.</p>}
      {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
      <div className="flex gap-2">
        {canShare && <button onClick={() => series && !confirmDel ? setConfirmDel(true) : onDelete()}
          className={`flex-1 py-2.5 rounded-xl text-sm ${confirmDel ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}>{confirmDel ? 'Xoá cả chuỗi?' : 'Xoá'}</button>}
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-white text-gray-600 text-sm">Huỷ</button>
        <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold">Lưu</button>
      </div>
    </div>
  )
}

// ── DỰ ÁN ──
const P_EMOJI = ['📁', '🧪', '💎', '✈️', '🏠', '📚', '💻', '🍵', '🎯', '🛠️', '🌿', '⭐']
function ProjectForm({ initial, who, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: '', emoji: '📁', color: '#7F77DD', shared: false })
  const [confirm, setConfirm] = useState(false)
  const canShare = !initial || initial.owner === who
  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col gap-3">
      <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Tên dự án, ví dụ: Bạch Mẫu Đơn V2"
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base" autoFocus={!initial}/>
      <div className="flex flex-wrap gap-1.5">{P_EMOJI.map(e => <Chip key={e} on={f.emoji === e} onClick={() => setF({ ...f, emoji: e })} cls="text-lg px-2.5 py-1">{e}</Chip>)}</div>
      <div className="flex flex-wrap gap-2.5">{COLORS.map(c => <button key={c} onClick={() => setF({ ...f, color: c })} aria-label={'Màu ' + c}
        className="w-8 h-8 rounded-full" style={{ background: c, outline: f.color === c ? '2px solid #1F2937' : 'none', outlineOffset: 2 }}/>)}</div>
      {canShare && <label className="flex items-center gap-3"><input type="checkbox" checked={!!f.shared} onChange={e => setF({ ...f, shared: e.target.checked })} className="w-5 h-5"/>
        <span className="text-[15px]">Chia sẻ với {PEOPLE[otherOf(who)]}</span></label>}
      <div className="flex gap-2">
        {initial && canShare && <button onClick={() => confirm ? onDelete() : setConfirm(true)}
          className={`flex-1 py-2.5 rounded-xl text-sm ${confirm ? 'bg-red-600 text-white' : 'bg-gray-100 text-red-600'}`}>{confirm ? 'Xoá? Việc vẫn giữ' : 'Xoá'}</button>}
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm">Huỷ</button>
        <button onClick={() => f.name.trim() && onSave({ ...f, name: f.name.trim() })} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold">Lưu</button>
      </div>
    </div>
  )
}

function ProjectCard({ p, tasks, today, onOpen }) {
  const g = projectProgress(p.id, tasks, today)
  return (
      <button onClick={() => onOpen(p.id)} className="w-full bg-white rounded-2xl p-3.5 text-left active:scale-[0.99]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{p.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-gray-800 truncate">{p.name}{p.shared && ' 👥'}</div>
            <div className="text-xs text-gray-500 truncate">{g.next ? `Tiếp: ${g.next.title} · ${dm(g.next.due_date)}` : g.undated ? `${g.undated} việc chưa có ngày` : g.total ? 'Không còn việc có hạn' : 'Chưa có việc'}
              {g.late > 0 && <span className="text-red-600"> · {g.late} quá hạn</span>}</div>
          </div>
          <span className="text-sm font-semibold" style={{ color: p.color }}>{g.total ? g.pct + '%' : ''}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full mt-2.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: g.pct + '%', background: p.color }}/></div>
        <div className="text-[11px] text-gray-400 mt-1">{g.done}/{g.total} việc xong{g.series ? ` · ${g.series} việc lặp` : ''}</div>
      </button>
  )
}

function ProjectsPage({ who, projects, tasks, today, onOpen, onSave, onBack }) {
  const [adding, setAdding] = useState(false), [showArch, setShowArch] = useState(false)
  const active = projects.filter(p => !p.archived), arch = projects.filter(p => p.archived)


  return (
    <div className="pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30"><div className="max-w-2xl mx-auto px-2 py-2 flex items-center">
        <button onClick={onBack} className="w-11 h-11 text-2xl text-gray-500" aria-label="Quay lại">‹</button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800">Dự án</h2>
        <button onClick={() => setAdding(true)} className="w-11 h-11 text-2xl text-purple-600" aria-label="Thêm dự án">+</button></div></header>
      <div className="max-w-2xl mx-auto px-3 pt-3 flex flex-col gap-2.5">
        {adding && <ProjectForm who={who} onCancel={() => setAdding(false)} onSave={f => { onSave({ owner: who, ...f }); setAdding(false) }}/>}
        {active.map(p => <ProjectCard key={p.id} p={p} tasks={tasks} today={today} onOpen={onOpen}/>)}
        {!active.length && !adding && <button onClick={() => setAdding(true)} className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border-2 border-dashed border-gray-200">
          Chưa có dự án nào · bấm để tạo dự án đầu tiên</button>}
        {arch.length > 0 && <button onClick={() => setShowArch(!showArch)} className="text-xs text-gray-400 py-2">{showArch ? '▾' : '▸'} Đã lưu trữ · {arch.length}</button>}
        {showArch && arch.map(p => <div key={p.id} className="opacity-60"><ProjectCard p={p} tasks={tasks} today={today} onOpen={onOpen}/></div>)}
      </div>
    </div>
  )
}

function ProjectDetail({ who, project: p, projects, tasks, today, onSaveProject, onDeleteProject, onAdd, onEdit, onDelete, onTick, onOpenDay, onBack }) {
  const [editP, setEditP] = useState(false), [editing, setEditing] = useState(null)
  const [title, setTitle] = useState(''), [group, setGroup] = useState(''), [newGroup, setNewGroup] = useState(''), [date, setDate] = useState('')
  const ts = tasks.filter(t => t.project_id === p.id)
  const groups = projectGroups(p.id, tasks), g = projectProgress(p.id, tasks, today)
  const grp = group === '__new' ? newGroup.trim() : group
  const add = () => { const t = title.trim(); if (!t) return
    onAdd({ title: t, project_id: p.id, group_name: grp || null, due_date: date || null, shared: p.shared, repeat_unit: '', repeat_every: 1 })
    setTitle(''); if (group === '__new' && grp) setGroup(grp) }
  const order = t => [t.done ? 1 : 0, t.due_date || '9999', t.title]
  const sortT = (a, b) => { const x = order(a), y = order(b); return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2].localeCompare(y[2]) }
  return (
    <div className="pb-6">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30"><div className="max-w-2xl mx-auto px-2 py-2 flex items-center">
        <button onClick={onBack} className="w-11 h-11 text-2xl text-gray-500" aria-label="Quay lại">‹</button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 truncate">{p.emoji} {p.name}</h2>
        <button onClick={() => setEditP(!editP)} className="w-11 h-11 text-lg" aria-label="Sửa dự án">✏️</button></div></header>
      <div className="max-w-2xl mx-auto px-3 pt-3 flex flex-col gap-3">
        {editP ? <ProjectForm initial={p} who={who} onCancel={() => setEditP(false)} onDelete={() => onDeleteProject(p.id)}
            onSave={f => { onSaveProject({ id: p.id, name: f.name, emoji: f.emoji, color: f.color, shared: f.shared }); setEditP(false) }}/>
          : <div className="bg-white rounded-2xl p-3.5">
              <div className="flex items-baseline justify-between"><span className="text-sm text-gray-600">{g.done}/{g.total} việc xong{g.late ? <span className="text-red-600"> · {g.late} quá hạn</span> : ''}</span>
                <span className="text-xl font-bold" style={{ color: p.color }}>{g.pct}%</span></div>
              <div className="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: g.pct + '%', background: p.color }}/></div>
              {(p.owner === who || p.shared) && <button onClick={() => onSaveProject({ id: p.id, archived: !p.archived })} className="text-xs text-gray-400 mt-2">{p.archived ? 'Bỏ lưu trữ' : 'Xong dự án · lưu trữ'}</button>}
            </div>}

        <div className="bg-white rounded-2xl p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="+ Thêm việc vào dự án…"
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>
            <button onClick={add} className="bg-purple-600 text-white rounded-xl px-4 font-semibold">Thêm</button>
          </div>
          <div className="flex gap-2">
            <select value={group} onChange={e => setGroup(e.target.value)} aria-label="Nhóm" className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2 text-base bg-white">
              <option value="">Nhóm: Chung</option>
              {groups.filter(x => x !== 'Chung').map(x => <option key={x} value={x}>Nhóm: {x}</option>)}
              <option value="__new">+ Nhóm mới…</option>
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Ngày" className="flex-1 min-w-0 block appearance-none border border-gray-200 rounded-xl px-2 py-2 text-base bg-white"/>
          </div>
          {group === '__new' && <input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="Tên nhóm mới, ví dụ: Đóng gói" className="border border-gray-200 rounded-xl px-3 py-2.5 text-base"/>}
          <p className="text-xs text-gray-400">{date ? `Việc sẽ hiện trên lịch ngày ${dm(date)}` : 'Không chọn ngày: việc chỉ nằm trong dự án, đặt ngày sau cũng được'}</p>
        </div>

        {groups.map(gn => { const list = ts.filter(t => (t.group_name || 'Chung') === gn).sort(sortT)
          return (
            <div key={gn}>
              <div className="flex justify-between text-xs text-gray-400 px-1 mb-1"><span>{gn}</span><span>{list.filter(t => !t.repeat_unit && t.done).length}/{list.filter(t => !t.repeat_unit).length}</span></div>
              <div className="bg-white rounded-2xl px-3">
                {list.map(t => {
                  const series = isSeries(t), late = !series && !t.done && t.due_date && t.due_date < today
                  const nextD = series ? nextOccurrences(t, today, 1)[0] : null
                  if (editing === t.id) return <EditRow key={t.id} t={t} who={who} projects={projects} tasks={tasks} onCancel={() => setEditing(null)}
                    onDelete={() => { onDelete(t.id); setEditing(null) }} onSave={f => { onEdit(t.id, f); setEditing(null) }}/>
                  return (
                    <div key={t.id} className="flex items-center gap-3 border-b border-gray-100 last:border-0">
                      {series
                        ? <button onClick={() => nextD && onOpenDay(nextD)} className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex-shrink-0" aria-label="Mở lần tới trên lịch">↻</button>
                        : <button onClick={() => onTick(t)} aria-label={t.done ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}
                            className={`w-8 h-8 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-white ${t.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{t.done && '✓'}</button>}
                      <button onClick={() => setEditing(t.id)} className="flex-1 text-left py-3 min-w-0">
                        <div className={`text-[15px] ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</div>
                        <div className={`text-xs mt-0.5 ${late ? 'text-red-600' : 'text-gray-400'}`}>
                          {series ? `↻ ${describe(t)}${nextD ? ' · lần tới ' + dm(nextD) : ''}` : t.due_date ? (late ? 'Quá hạn · ' : '') + dm(t.due_date) + (t.due_time ? ' · ' + t.due_time : '') : 'Chưa có ngày · bấm để đặt'}
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) })}
        {!ts.length && <p className="text-center text-sm text-gray-400 py-6">Chưa có việc nào — thêm ở ô phía trên</p>}
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


// ── THÔNG BÁO ──
const PREF_TIMES = ['06:00', '06:30', '07:00', '07:30', '08:00', '20:30', '21:00', '21:30', '22:00']
function NotifySection({ who }) {
  const toast = useToast()
  const [sp] = useState(pushSupport)
  const [on, setOn] = useState(null)               // null = đang kiểm tra
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    isRegistered().then(setOn).catch(() => setOn(false))
    getPrefs(who).then(setPrefs).catch(() => {})
  }, [who])
  const act = async (fn, ok) => { if (busy) return; setBusy(true); try { await fn(); ok && toast.success(ok) } catch (e) { toast.error(e.message) } setBusy(false) }
  const upd = p => { setPrefs(p); savePrefs(who, p).catch(e => toast.error('Lỗi: ' + e.message)) }
  const status = !sp.supported
    ? (sp.ios ? 'iPhone: cần thêm app vào màn hình chính (Chia sẻ → Thêm vào MH chính) rồi mở từ biểu tượng đó' : 'Trình duyệt này không hỗ trợ thông báo')
    : sp.permission === 'denied' ? 'Điện thoại đang chặn thông báo của app — vào Cài đặt điện thoại để cho phép'
    : on === null ? 'Đang kiểm tra…' : on ? `Máy này đang nhận thông báo của ${PEOPLE[who]}` : 'Máy này chưa bật thông báo'
  const dis = !prefs.all
  return (
    <div className="bg-white rounded-2xl px-4">
      <div className="text-xs text-gray-400 pt-3">Thông báo</div>
      <div className={`text-sm mt-2 rounded-xl px-3 py-2.5 ${on ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{on ? '🔔 ' : '🔕 '}{status}</div>
      {sp.supported && sp.permission !== 'denied' && (
        <div className="flex gap-2 py-3">
          {!on && <button disabled={busy} onClick={() => act(async () => { await enablePush(who); setOn(true) }, 'Đã bật thông báo')}
            className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-50">Bật thông báo</button>}
          {on && <button disabled={busy} onClick={() => act(sendTest, 'Đã gửi — xem thông báo trên máy')} className="flex-1 py-3 rounded-xl bg-purple-50 text-purple-800 font-semibold disabled:opacity-50">Gửi thử</button>}
          {on && <button disabled={busy} onClick={() => act(async () => { await disablePush(); setOn(false) }, 'Đã tắt trên máy này')} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-50">Tắt trên máy này</button>}
        </div>
      )}
      <SetRow title="Nhận nhắc nhở" sub={`Áp dụng cho ${PEOPLE[who]} trên mọi máy`}><Switch on={prefs.all} onClick={() => upd({ ...prefs, all: !prefs.all })} label="Nhận nhắc nhở"/></SetRow>
      <div className={dis ? 'opacity-40 pointer-events-none' : ''}>
        <SetRow title="To-do có giờ" sub="Báo đúng giờ hẹn"><Switch on={prefs.todo} onClick={() => upd({ ...prefs, todo: !prefs.todo })} label="To-do có giờ"/></SetRow>
        <SetRow title="Daily tới giờ" sub="Daily có bật nhắc và có giờ bắt đầu"><Switch on={prefs.daily} onClick={() => upd({ ...prefs, daily: !prefs.daily })} label="Daily tới giờ"/></SetRow>
        <SetRow title="Quên bấm kết thúc" sub="Khi đồng hồ chạy quá 3 lần mục tiêu"><Switch on={prefs.forgot} onClick={() => upd({ ...prefs, forgot: !prefs.forgot })} label="Quên bấm kết thúc"/></SetRow>
        <SetRow title="Tóm tắt buổi sáng" sub="Việc và Daily trong ngày">
          <select value={prefs.moAt} onChange={e => upd({ ...prefs, moAt: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-base bg-white mr-2">{PREF_TIMES.slice(0, 5).map(x => <option key={x}>{x}</option>)}</select>
          <Switch on={prefs.mo} onClick={() => upd({ ...prefs, mo: !prefs.mo })} label="Tóm tắt buổi sáng"/></SetRow>
        <SetRow title="Tổng kết cuối ngày" sub="Làm được gì, bao lâu, bỏ lỡ gì">
          <select value={prefs.evAt} onChange={e => upd({ ...prefs, evAt: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-base bg-white mr-2">{PREF_TIMES.slice(5).map(x => <option key={x}>{x}</option>)}</select>
          <Switch on={prefs.ev} onClick={() => upd({ ...prefs, ev: !prefs.ev })} label="Tổng kết cuối ngày"/></SetRow>
      </div>
      <p className="text-xs text-gray-400 pb-3">Ngày trai nhắc theo giờ đặt ở mục Ngày trai, gửi cho cả hai người.</p>
    </div>
  )
}

// ── CÀI ĐẶT ──
function SettingsPage({ who, cfg, onCfg, daily, onEditDaily, onSwitch, onBack, linkPrefs = DEFAULT_LINKS, onLinkPrefs }) {
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
          <SetRow title="Nhắc ngày trai lúc" sub="Gửi cho cả hai người">
            <select value={cfg.traiAt} onChange={e => onCfg({ ...cfg, traiAt: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-2 text-base bg-white">
              {['05:00', '05:30', '06:00', '06:30', '07:00'].map(x => <option key={x}>{x}</option>)}</select></SetRow>
        </div>
        <NotifySection who={who}/>
        <div className="bg-white rounded-2xl px-4">
          <div className="text-xs text-gray-400 pt-3">Hiện thêm trên lịch · chỉ xem</div>
          <SetRow title="💎 Trang sức" sub="Đặt hàng, hàng dự kiến về, nhập kho, hẹn giao khách"><Switch on={linkPrefs.jewelry} onClick={() => onLinkPrefs({ ...linkPrefs, jewelry: !linkPrefs.jewelry })} label="Mốc Trang sức"/></SetRow>
          <SetRow title="🧪 Lab" sub="Làm lô, đặt nguyên liệu, nguyên liệu về"><Switch on={linkPrefs.lab} onClick={() => onLinkPrefs({ ...linkPrefs, lab: !linkPrefs.lab })} label="Mốc Lab"/></SetRow>
          <SetRow title="✂️ Ngày cắt tóc, móng tay" sub="Ngày tốt có dấu ✂ đỏ; kết quả hiện trong chi tiết ngày"><Switch on={linkPrefs.hair !== false} onClick={() => onLinkPrefs({ ...linkPrefs, hair: linkPrefs.hair === false })} label="Ngày cắt tóc"/></SetRow>
          <p className="text-xs text-gray-400 pb-3">Bật tắt riêng cho {PEOPLE[who]}. Không gửi thông báo cho các mốc này.</p>
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
        <div><span className="text-xs text-gray-500">Giờ bắt đầu</span>
          <div className="flex gap-2 mt-1 items-center">
            <Chip on={!f.start_time} onClick={() => setF(x => ({ ...x, start_time: '', remind: false }))}>Lúc nào cũng được</Chip>
            <input type="time" value={f.start_time || ''} aria-label="Giờ bắt đầu"
              onChange={e => setF(x => ({ ...x, start_time: e.target.value, remind: e.target.value ? (x.start_time ? x.remind : true) : false }))}
              className={`flex-1 min-w-0 block appearance-none border rounded-xl px-3 py-2 text-base bg-white ${f.start_time ? 'border-purple-300' : 'border-gray-200'}`}/>
          </div>
          {f.start_time && <div className="flex items-center gap-3 mt-3">
            <div className="flex-1"><div className="text-[15px] text-gray-800">Nhắc khi tới giờ</div><div className="text-xs text-gray-500">Gửi thông báo lúc {f.start_time} những ngày có làm</div></div>
            <Switch on={!!f.remind} onClick={() => set('remind', !f.remind)} label="Nhắc khi tới giờ"/>
          </div>}
        </div>
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
