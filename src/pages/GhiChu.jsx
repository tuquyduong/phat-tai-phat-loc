// ============================================
// 📝 GHI CHÚ (mở từ nút 📝 trên đầu tab Việc)
// Sổ: mỗi người tự sắp xếp, người khác không thấy.
// Ghi chú: chỉ chủ thấy; chia sẻ từng ghi chú cho từng người — 👁 Xem hoặc ✏️ Sửa.
// Nội dung là các dòng: chữ thường, tiêu đề, gạch đầu dòng, checklist (+ chữ đậm cả dòng).
// ============================================
import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { useToast } from '../components/Toast'
import EmojiPick from '../components/EmojiPick'
import { nameOf } from '../lib/viec'
import {
  NOTE_PEOPLE, BOOK_COLORS, roleOf, canEdit, listBooks, saveBook, deleteBook, listNotes, getNote,
  createNote, updateNote, deleteNote, seenAt, markSeen, isNewFor, plain, preview, toDoc, docTitle,
} from '../lib/notes'

const AV = { linh: '#7c3aed', mai: '#db2777', choo: '#059669', moon: '#d97706' }
const INI = { linh: 'L', mai: 'M', choo: 'C', moon: 'Mo' }
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
function ago(iso) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date(), min = Math.round((now - d) / 60000)
  if (min < 1) return 'vừa xong'
  if (min < 60) return min + ' phút trước'
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hm
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'hôm qua ' + hm
  return `${d.getDate()}/${d.getMonth() + 1}`
}
const Ava = ({ k, size = 22 }) => <span className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 border-2 border-white"
  style={{ background: AV[k], width: size, height: size, fontSize: size * 0.42 }}>{INI[k]}</span>

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-end justify-center" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-2xl rounded-t-3xl px-4 pt-2 max-h-[90vh] overflow-y-auto" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-3"/>
        {title && <h3 className="text-lg font-bold mb-3">{title}</h3>}
        {children}
      </div>
    </div>)
}

// ---------- Chia sẻ một ghi chú ----------
function ShareSheet({ note, me, onClose, onSave }) {
  const [s, setS] = useState({ ...(note.share || {}) })
  const ppl = NOTE_PEOPLE.filter(k => k !== note.owner)
  const all = v => setS(v ? Object.fromEntries(ppl.map(k => [k, v])) : {})
  return (
    <Sheet title={`👥 Chia sẻ “${note.title || 'ghi chú'}”`} onClose={onClose}>
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => all('')} className="px-3 py-2 rounded-full text-sm bg-gray-100">🔒 Chỉ mình tôi</button>
        <button onClick={() => all('view')} className="px-3 py-2 rounded-full text-sm bg-blue-50 text-blue-700">👥 Cả nhà xem</button>
        <button onClick={() => all('edit')} className="px-3 py-2 rounded-full text-sm bg-emerald-50 text-emerald-700">👥 Cả nhà sửa</button>
      </div>
      {ppl.map(k => (
        <div key={k} className="flex items-center gap-3 py-2.5 border-b border-gray-100">
          <Ava k={k} size={32}/><span className="flex-1 text-[15px]">{nameOf(k, me)}</span>
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {[['', 'Không'], ['view', '👁 Xem'], ['edit', '✏️ Sửa']].map(([v, l]) => (
              <button key={v} onClick={() => setS(x => { const n = { ...x }; if (v) n[k] = v; else delete n[k]; return n })}
                className={`px-2.5 py-1.5 rounded-lg text-[13px] ${(s[k] || '') === v ? 'bg-white shadow-sm font-semibold ' + (v === 'edit' ? 'text-emerald-700' : v === 'view' ? 'text-blue-700' : 'text-gray-800') : 'text-gray-500'}`}>{l}</button>))}
          </div>
        </div>))}
      <p className="text-xs text-gray-500 mt-3 leading-relaxed">👁 <b>Xem</b>: đọc, xem và chép mật khẩu, không sửa được.<br/>✏️ <b>Sửa</b>: viết thêm, sửa chữ, tick xong việc.<br/>Chỉ bạn đổi được người chia sẻ hoặc xoá ghi chú.</p>
      <button onClick={() => onSave(s)} className="w-full mt-4 py-3 rounded-xl bg-purple-600 text-white font-semibold">Xong</button>
    </Sheet>)
}

// ---------- Sửa / thêm sổ ----------
function BookSheet({ book, count, onClose, onSave, onDelete }) {
  const [b, setB] = useState(book)
  return (
    <Sheet title={book.id ? 'Sửa sổ' : 'Sổ mới'} onClose={onClose}>
      <input value={b.name} onChange={e => setB({ ...b, name: e.target.value })} placeholder="Tên sổ, ví dụ: Mật khẩu, Kinh, Việc nhà" autoFocus={!book.id}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base"/>
      <EmojiPick value={b.emoji} onChange={emoji => setB({ ...b, emoji })}/>
      <div className="flex gap-2.5 mt-3">{BOOK_COLORS.map(c => (
        <button key={c} onClick={() => setB({ ...b, color: c })} aria-label="Màu sổ" className={`w-8 h-8 rounded-full ${b.color === c ? 'ring-2 ring-gray-800 ring-offset-2' : ''}`} style={{ background: c }}/>))}</div>
      <p className="text-xs text-gray-500 mt-3">Sổ chỉ để bạn tự sắp xếp, người khác không thấy. Chia sẻ thì làm ở từng ghi chú (nút 👥).</p>
      <button onClick={() => onSave({ ...b, name: b.name.trim() || 'Sổ mới' })} className="w-full mt-4 py-3 rounded-xl bg-purple-600 text-white font-semibold">Lưu</button>
      {book.id && <button onClick={() => { if (confirm(count ? `Xoá sổ “${book.name}”? ${count} ghi chú bên trong không mất — chuyển về “Chưa xếp sổ”.` : `Xoá sổ “${book.name}”?`)) onDelete(book) }}
        className="w-full mt-2 py-3 rounded-xl bg-red-50 text-red-600 font-medium">Xoá sổ</button>}
    </Sheet>)
}

// ---------- Mật khẩu / tài khoản trong ghi chú ----------
function SecretSheet({ item, onClose, onSave, onDelete }) {
  const [s, setS] = useState(item || { n: '', u: '', p: '' })
  return (
    <Sheet title={item ? 'Sửa mật khẩu' : '🔑 Thêm mật khẩu / tài khoản'} onClose={onClose}>
      <input value={s.n} onChange={e => setS({ ...s, n: e.target.value })} placeholder="Tên (vd: Wifi, Techcombank)" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base"/>
      <input value={s.u} onChange={e => setS({ ...s, u: e.target.value })} placeholder="Tên đăng nhập (không bắt buộc)" autoCapitalize="none" autoCorrect="off"
        className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl text-base"/>
      <input value={s.p} onChange={e => setS({ ...s, p: e.target.value })} placeholder="Mật khẩu / key" autoCapitalize="none" autoCorrect="off" spellCheck={false}
        className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl text-base font-mono"/>
      <button onClick={() => onSave({ n: s.n.trim() || 'Mật khẩu', u: s.u.trim(), p: s.p })} className="w-full mt-4 py-3 rounded-xl bg-purple-600 text-white font-semibold">Lưu</button>
      {item && <button onClick={onDelete} className="w-full mt-2 py-3 rounded-xl bg-red-50 text-red-600 font-medium">Xoá dòng này</button>}
    </Sheet>)
}

function SecretRow({ s, onEdit }) {
  const [show, setShow] = useState(false)
  const toast = useToast()
  const copy = async () => { try { await navigator.clipboard.writeText(s.p); toast.success('Đã chép ' + s.n) } catch { setShow(true); toast.error('Máy không cho chép — mật khẩu đang hiện để bạn tự chép') } }
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 mt-1.5">
      <button onClick={onEdit} disabled={!onEdit} className="w-24 flex-shrink-0 text-left">
        <span className="block text-[13px] font-semibold text-gray-800 truncate">{s.n}</span>
        {s.u && <span className="block text-xs text-gray-400 truncate">{s.u}</span>}
      </button>
      <span className="flex-1 min-w-0 font-mono text-sm truncate select-all">{show ? s.p : '••••••••'}</span>
      <button onClick={() => setShow(!show)} className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-sm" aria-label={show ? 'Ẩn' : 'Xem'}>{show ? '🙈' : '👁'}</button>
      <button onClick={copy} className="px-2.5 py-1.5 rounded-lg bg-gray-100 text-xs font-medium">Chép</button>
    </div>)
}

// ---------- Soạn / xem một ghi chú ----------
const NoteEditor = lazy(() => import('../components/NoteEditor'))
export const preloadEditor = () => import('../components/NoteEditor')

function Editor({ note, me, books, isNew, onBack, onChange, onDelete, onShare, onMove, onMakeTask }) {
  const role = roleOf(note, me), ed = canEdit(note, me), own = role === 'own'
  const [secrets, setSecretsState] = useState(note.secrets || [])
  const [pinned, setPinned] = useState(!!note.pinned)
  const [secret, setSecret] = useState(null)          // { i } sửa · { i: -1 } thêm mới
  const [more, setMore] = useState(false)
  const doc0 = useMemo(() => toDoc(note), [note.id])   // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đọc lúc mở
  const names = useMemo(() => Object.fromEntries(NOTE_PEOPLE.map(k => [k, nameOf(k, me)])), [me])
  // Ghi chú cũ (dạng dòng) → lưu sang dạng mới ngay lần sửa đầu tiên
  const onDoc = json => onChange(note, { body: json, title: docTitle(json) })
  const setSecrets = L => { setSecretsState(L); onChange(note, { secrets: L }) }
  const share = note.share || {}
  const others = [note.owner, ...Object.keys(share)].filter(k => k !== me)
  const book = books.find(b => b.id === note.book_id)

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white border-b border-gray-200 relative z-[86]"><div className="max-w-2xl mx-auto flex items-center gap-1 px-2 py-2">
        <button onClick={onBack} className="w-10 h-10 text-2xl text-purple-600" aria-label="Quay lại">‹</button>
        <span className="flex-1 min-w-0 text-sm text-gray-400 truncate">{own ? (book ? `${book.emoji} ${book.name}` : '📥 Chưa xếp sổ') : 'của ' + nameOf(note.owner, me)}</span>
        {own && <button onClick={onShare} className="px-3 h-9 rounded-xl bg-purple-50 text-purple-700 text-sm font-semibold">👥 Chia sẻ</button>}
        {own && <button onClick={() => setMore(true)} className="w-10 h-10 text-xl" aria-label="Thêm">⋯</button>}
      </div></div>
      <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 pt-3" style={{ paddingBottom: ed ? 150 : 40 }}>
        {role === 'view' && <div className="rounded-xl px-3 py-2 mb-2 text-sm bg-blue-50 text-blue-700">👁 {nameOf(note.owner, me)} chia sẻ để bạn xem</div>}
        {role !== 'view' && others.length > 0 && <button onClick={own ? onShare : undefined}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-[13px] bg-purple-50 text-purple-800 text-left">
          <span className="flex -space-x-1.5">{others.map(k => <Ava key={k} k={k}/>)}</span>
          <span className="flex-1 min-w-0">{own ? Object.entries(share).map(([k, v]) => nameOf(k, me) + (v === 'edit' ? ' ✏️' : ' 👁')).join(', ') : 'Bạn được sửa cùng ' + others.map(k => nameOf(k, me)).join(', ')}
            {note.updated_by && note.updated_by !== me && <span className="text-purple-500"> · {nameOf(note.updated_by, me)} sửa {ago(note.updated_at)}</span>}</span>
        </button>}
        <Suspense fallback={<p className="text-sm text-gray-400 py-6">Đang mở…</p>}>
          <NoteEditor doc={doc0} editable={ed} me={me} names={names} autoFocus={isNew} onChange={onDoc}
            onSecret={() => setSecret({ i: -1 })} onMakeTask={onMakeTask}/>
        </Suspense>
        {secrets.length > 0 && <div className="bg-purple-50/60 border border-dashed border-purple-200 rounded-2xl p-3 mt-3">
          <p className="text-[13px] font-semibold text-purple-800">🔑 Mật khẩu & tài khoản</p>
          {secrets.map((s, i) => <SecretRow key={i} s={s} onEdit={ed ? () => setSecret({ i }) : null}/>)}
          {ed && <button onClick={() => setSecret({ i: -1 })} className="text-sm text-purple-700 mt-2">+ Thêm dòng</button>}
        </div>}
        <p className="text-[11px] text-gray-400 text-center mt-6">Sửa {ago(note.updated_at)}{note.updated_by ? ' · ' + nameOf(note.updated_by, me) : ''}</p>
      </div></div>
      {secret && <SecretSheet item={secret.i >= 0 ? secrets[secret.i] : null} onClose={() => setSecret(null)}
        onSave={s => { const L = [...secrets]; if (secret.i >= 0) L[secret.i] = s; else L.push(s); setSecrets(L); setSecret(null) }}
        onDelete={() => { setSecrets(secrets.filter((_, j) => j !== secret.i)); setSecret(null) }}/>}
      {more && <Sheet onClose={() => setMore(false)} title="Ghi chú">
        <button onClick={() => { setPinned(!pinned); onChange(note, { pinned: !pinned }); setMore(false) }} className="w-full text-left py-3 border-b border-gray-100">{pinned ? '📌 Bỏ ghim' : '📌 Ghim lên đầu'}</button>
        <p className="text-xs text-gray-500 mt-3 mb-1.5">Chuyển sang sổ</p>
        <div className="flex flex-wrap gap-1.5">{[{ id: null, emoji: '📥', name: 'Chưa xếp sổ' }, ...books].map(b => (
          <button key={b.id || 'none'} onClick={() => { onChange(note, { book_id: b.id }); onMove?.(); setMore(false) }}
            className={`px-3 py-2 rounded-full text-sm ${note.book_id === b.id ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>{b.emoji} {b.name}</button>))}</div>
        <button onClick={() => { if (confirm('Xoá ghi chú này?' + (Object.keys(share).length ? ' Người được chia sẻ cũng không còn thấy.' : ''))) { setMore(false); onDelete() } }}
          className="w-full mt-4 py-3 rounded-xl bg-red-50 text-red-600 font-medium">🗑 Xoá ghi chú</button>
      </Sheet>}
    </div>)
}

// ============================================
export default function GhiChu({ me, onBack, openId, onOpened, onMakeTask, onSeen }) {
  const toast = useToast()
  const [books, setBooks] = useState([])
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookId, setBookId] = useState(undefined)      // undefined = trang sổ; null = Chưa xếp sổ; id = một sổ
  const [noteId, setNoteId] = useState(null)
  const [q, setQ] = useState('')
  const [bookEdit, setBookEdit] = useState(null)
  const [shareFor, setShareFor] = useState(null)
  const [seen] = useState(() => seenAt(me))
  const pend = useRef({}), timer = useRef(null), saving = useRef(Promise.resolve())

  const load = useCallback(async () => {
    try { const [b, n] = await Promise.all([listBooks(), listNotes()]); setBooks(b); setNotes(n) }
    catch (e) { toast.error('Lỗi tải ghi chú: ' + e.message) }
    setLoading(false)
  }, [toast])
  useEffect(() => { load(); markSeen(me); onSeen?.() }, [load, me])        // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openId && !loading) { openNote(openId); onOpened?.() } }, [openId, loading])   // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Lưu tự động: gom các thay đổi, ghi sau 0,7 giây ----
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const all = pend.current; pend.current = {}
    saving.current = saving.current.then(() => Promise.all(Object.entries(all).map(([id, f]) =>
      updateNote(id, f).then(row => setNotes(ns => ns.map(x => x.id === id ? { ...x, updated_at: row.updated_at, updated_by: row.updated_by, share: row.share } : x)))
        .catch(e => toast.error('Chưa lưu được: ' + e.message)))))
    return saving.current
  }, [toast])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); else load() }
    document.addEventListener('visibilitychange', onHide)
    return () => { document.removeEventListener('visibilitychange', onHide); flush() }
  }, [flush, load])
  const change = (x, patch) => {
    setNotes(ns => ns.map(n => n.id === x.id ? { ...n, ...patch } : n))
    pend.current[x.id] = { ...(pend.current[x.id] || {}), ...patch }
    clearTimeout(timer.current); timer.current = setTimeout(flush, 700)
  }

  const openNote = async id => {
    await flush()
    const fresh = await getNote(id).catch(() => null)          // bản mới nhất (người khác có thể vừa sửa)
    if (fresh === null && !notes.some(x => x.id === id)) return
    if (fresh) setNotes(ns => ns.map(x => x.id === id ? fresh : x))
    else { setNotes(ns => ns.filter(x => x.id !== id)); toast.info('Ghi chú này không còn được chia sẻ với bạn'); return }
    setNoteId(id)
  }
  const closeNote = async () => {
    const n = notes.find(x => x.id === noteId)
    await flush()
    setNoteId(null)
    setFresh(null)
    if (n && n.owner === me && !plain({ ...n, secrets: [] }).trim() && !(n.secrets || []).length) {   // ghi chú trống → bỏ
      deleteNote(n.id).then(() => setNotes(ns => ns.filter(x => x.id !== n.id))).catch(() => {})
    }
  }
  // Ghi chú mới: mở NGAY (id tạo sẵn trên máy) rồi mới lưu ngầm → bàn phím bật lên trong cùng lần chạm
  const [fresh, setFresh] = useState(null)
  const newNote = () => {
    const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) })
    const now = new Date().toISOString()
    const doc = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 } }] }
    const n = { id, owner: me, book_id: bookId !== undefined ? bookId : null, title: '', body: doc, secrets: [], share: {}, pinned: false, created_at: now, updated_at: now, updated_by: me }
    setNotes(ns => [n, ...ns]); setFresh(id); setNoteId(id)
    saving.current = saving.current.then(() => createNote({ id, book_id: n.book_id, body: doc })
      .catch(e => { toast.error('Lỗi tạo ghi chú: ' + e.message); setNotes(ns => ns.filter(x => x.id !== id)); setNoteId(null) }))
  }
  useEffect(() => { preloadEditor() }, [])

  const mine = notes.filter(n => n.owner === me)
  const shared = notes.filter(n => n.owner !== me)
  const sortN = L => [...L].sort((a, b) => (b.pinned - a.pinned) || b.updated_at.localeCompare(a.updated_at))
  const found = useMemo(() => q.trim() ? notes.filter(n => norm(plain(n)).includes(norm(q.trim()))) : null, [q, notes])
  const cur = notes.find(n => n.id === noteId)

  const Card = ({ n }) => {
    const r = roleOf(n, me), fresh = isNewFor(n, me, seen)
    const sh = Object.entries(n.share || {})
    return (
      <button onClick={() => openNote(n.id)} className="w-full text-left bg-white rounded-2xl px-3.5 py-3 mt-2 shadow-sm active:bg-gray-50">
        <span className="flex items-center gap-1.5">
          {r !== 'own' && <Ava k={n.owner}/>}
          {n.pinned && r === 'own' && <span>📌</span>}
          <span className="font-semibold text-[15px] text-gray-800 truncate flex-1">{n.title || 'Ghi chú không tên'}</span>
          {fresh && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"/>}
        </span>
        <span className="block text-[13px] text-gray-500 truncate mt-0.5">{preview(n) || ' '}</span>
        <span className="block text-[11px] text-gray-400 mt-1 truncate">
          {r === 'own' ? (sh.length ? '👥 ' + sh.map(([k, v]) => nameOf(k, me) + (v === 'edit' ? ' ✏️' : ' 👁')).join(', ') : '🔒 Chỉ mình tôi')
            : `của ${nameOf(n.owner, me)} · ${r === 'edit' ? '✏️ bạn được sửa' : '👁 chỉ xem'}`}
          {' · '}{n.updated_by && n.updated_by !== me ? nameOf(n.updated_by, me) + ' sửa ' : ''}{ago(n.updated_at)}
        </span>
      </button>)
  }

  const inBook = bookId !== undefined
  const curBook = inBook && books.find(b => b.id === bookId)
  const header = (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10"><div className="max-w-2xl mx-auto flex items-center gap-1 px-2 py-2">
      <button onClick={() => inBook ? setBookId(undefined) : onBack()} className="w-10 h-10 text-2xl text-purple-600" aria-label="Quay lại">‹</button>
      <h2 className="flex-1 text-lg font-bold truncate">{inBook ? (curBook ? `${curBook.emoji} ${curBook.name}` : '📥 Chưa xếp sổ') : '📝 Ghi chú'}</h2>
      {curBook && <button onClick={() => setBookEdit(curBook)} className="w-10 h-10 text-xl" aria-label="Sửa sổ">⋯</button>}
    </div></div>)

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {header}
      <div className="max-w-2xl mx-auto px-3 pt-3">
        {!inBook && <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Tìm trong mọi ghi chú…" aria-label="Tìm ghi chú"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-base"/>}
        {loading ? <p className="text-center text-sm text-gray-400 py-10">Đang tải…</p>
        : found ? <>
          <p className="text-xs font-semibold text-gray-400 mt-4">{found.length} KẾT QUẢ</p>
          {sortN(found).map(n => <Card key={n.id} n={n}/>)}
        </> : inBook ? <>
          {sortN(mine.filter(n => (n.book_id || null) === bookId)).map(n => <Card key={n.id} n={n}/>)}
          {!mine.some(n => (n.book_id || null) === bookId) && <p className="text-center text-sm text-gray-400 py-12">Sổ trống — bấm ＋ để viết</p>}
        </> : <>
          {shared.length > 0 && <>
            <p className="text-xs font-semibold text-gray-400 mt-4">👥 NGƯỜI NHÀ CHIA SẺ VỚI TÔI</p>
            {sortN(shared).map(n => <Card key={n.id} n={n}/>)}
          </>}
          <div className="flex items-center justify-between mt-5 mb-2">
            <p className="text-xs font-semibold text-gray-400">SỔ CỦA TÔI</p>
            <button onClick={() => setBookEdit({ name: '', emoji: '📌', color: BOOK_COLORS[books.length % BOOK_COLORS.length] })} className="text-sm text-purple-600 font-medium">+ Sổ mới</button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {books.map(b => { const L = mine.filter(n => n.book_id === b.id), sh = L.filter(n => Object.keys(n.share || {}).length).length
              return <button key={b.id} onClick={() => setBookId(b.id)} className="rounded-2xl p-3 min-h-[104px] text-left flex flex-col active:scale-[.98]" style={{ background: b.color }}>
                <span className="text-[26px]">{b.emoji}</span>
                <span className="font-bold text-[15px] mt-1 truncate">{b.name}</span>
                <span className="text-xs text-gray-600">{L.length} ghi chú</span>
                {sh > 0 && <span className="text-[11px] text-gray-600 mt-auto pt-1">👥 {sh} đang chia sẻ</span>}
              </button> })}
            {mine.some(n => !n.book_id) && <button onClick={() => setBookId(null)} className="rounded-2xl p-3 min-h-[104px] text-left flex flex-col bg-white">
              <span className="text-[26px]">📥</span><span className="font-bold text-[15px] mt-1">Chưa xếp sổ</span>
              <span className="text-xs text-gray-600">{mine.filter(n => !n.book_id).length} ghi chú</span></button>}
            <button onClick={() => setBookEdit({ name: '', emoji: '📌', color: BOOK_COLORS[books.length % BOOK_COLORS.length] })}
              className="rounded-2xl p-3 min-h-[104px] border-2 border-dashed border-gray-300 text-gray-400 text-sm">＋ Sổ mới</button>
          </div>
          {!notes.length && <p className="text-sm text-gray-500 text-center mt-6 leading-relaxed">Chưa có ghi chú nào.<br/>Bấm <b>＋</b> để viết. Muốn nói thì chạm 🎤 trên bàn phím iPhone.</p>}
        </>}
      </div>

      {<div className="fixed right-4 flex gap-3 z-20" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={() => newNote()} className="w-14 h-14 rounded-full bg-purple-600 text-white text-3xl shadow-lg active:scale-95" aria-label="Ghi chú mới">＋</button>
      </div>}

      {cur && <Editor key={cur.id} note={cur} me={me} books={books} isNew={fresh === cur.id} onBack={closeNote} onChange={change} onMakeTask={onMakeTask}
        onShare={() => setShareFor(cur)}
        onDelete={async () => { try { await flush(); await deleteNote(cur.id); setNotes(ns => ns.filter(x => x.id !== cur.id)); setNoteId(null); toast.success('Đã xoá ghi chú') } catch (e) { toast.error('Lỗi xoá: ' + e.message) } }}/>}
      {shareFor && <ShareSheet note={shareFor} me={me} onClose={() => setShareFor(null)}
        onSave={async s => { setShareFor(null); change(shareFor, { share: s }); await flush(); toast.success(Object.keys(s).length ? 'Đã chia sẻ — người được chọn thấy ngay' : 'Đã chuyển về chỉ mình tôi') }}/>}
      {bookEdit && <BookSheet book={bookEdit} count={mine.filter(n => n.book_id === bookEdit.id).length} onClose={() => setBookEdit(null)}
        onSave={async b => { try { const row = await saveBook(b); setBooks(bs => b.id ? bs.map(x => x.id === row.id ? row : x) : [...bs, row]); setBookEdit(null); toast.success('Đã lưu sổ') } catch (e) { toast.error('Lỗi: ' + e.message) } }}
        onDelete={async b => { try { await deleteBook(b.id); setBooks(bs => bs.filter(x => x.id !== b.id)); setNotes(ns => ns.map(n => n.book_id === b.id ? { ...n, book_id: null } : n)); setBookEdit(null); setBookId(undefined); toast.success('Đã xoá sổ') } catch (e) { toast.error('Lỗi: ' + e.message) } }}/>}
    </div>)
}
