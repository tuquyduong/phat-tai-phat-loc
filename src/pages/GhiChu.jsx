// ============================================
// 📝 GHI CHÚ (mở từ nút 📝 trên đầu tab Việc)
// Sổ: mỗi người tự sắp xếp, người khác không thấy.
// Ghi chú: chỉ chủ thấy; chia sẻ từng ghi chú cho từng người — 👁 Xem hoặc ✏️ Sửa.
// Nội dung là các dòng: chữ thường, tiêu đề, gạch đầu dòng, checklist (+ chữ đậm cả dòng).
// ============================================
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useToast } from '../components/Toast'
import { nameOf } from '../lib/viec'
import {
  NOTE_PEOPLE, BOOK_EMOJI, BOOK_COLORS, roleOf, canEdit, listBooks, saveBook, deleteBook, listNotes, getNote,
  createNote, updateNote, deleteNote, seenAt, markSeen, isNewFor, plain, preview, voiceToBlocks,
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
      <div className="flex flex-wrap gap-1.5 mt-3">{BOOK_EMOJI.map(e => (
        <button key={e} onClick={() => setB({ ...b, emoji: e })} className={`w-10 h-10 rounded-xl text-xl ${b.emoji === e ? 'bg-purple-100 ring-2 ring-purple-500' : 'bg-gray-100'}`}>{e}</button>))}</div>
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

// Ô chữ tự giãn theo nội dung
function Grow({ value, onChange, onKeyDown, onFocus, className, placeholder, inputRef }) {
  const r = useRef(null)
  const fit = el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }
  useEffect(() => { fit(r.current) }, [value])
  return <textarea ref={el => { r.current = el; if (inputRef) inputRef(el) }} rows={1} value={value} placeholder={placeholder}
    onChange={e => { fit(e.target); onChange(e.target.value) }} onKeyDown={onKeyDown} onFocus={onFocus}
    className={'w-full resize-none bg-transparent outline-none overflow-hidden leading-[1.45] ' + className}/>
}

// ---------- Soạn / xem một ghi chú ----------
function Editor({ note, me, books, onBack, onChange, onDelete, onShare, onMove, onMakeTask }) {
  const toast = useToast()
  const role = roleOf(note, me), ed = canEdit(note, me), own = role === 'own'
  const [n, setN] = useState(note)
  const [focus, setFocus] = useState(null)
  const [secret, setSecret] = useState(null)          // { i } | { i: -1 } thêm mới
  const [more, setMore] = useState(false)
  const [rec, setRec] = useState(false)
  const refs = useRef([]), focusNext = useRef(null), recRef = useRef(null)
  useEffect(() => { if (focusNext.current !== null) { refs.current[focusNext.current]?.focus(); focusNext.current = null } })
  useEffect(() => () => recRef.current?.abort?.(), [])

  // Luôn sửa trên bản mới nhất (nRef) — gõ nhanh ngay sau khi bấm nút cũng không mất thay đổi
  const nRef = useRef(note)
  const put = patch => { const p = typeof patch === 'function' ? patch(nRef.current) : patch; const x = { ...nRef.current, ...p }; nRef.current = x; setN(x); onChange(x, p) }
  const bodyOf = x => x.body?.length ? x.body : [{ t: 'p', x: '' }]
  const B = bodyOf(n)
  const setBody = body => put({ body })
  const setBlock = (i, p) => put(cur => ({ body: bodyOf(cur).map((b, j) => j === i ? { ...b, ...p } : b) }))

  const onKey = (i, e) => {
    const B = bodyOf(nRef.current), b = B[i]
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!b.x && (b.t === 'c' || b.t === 'b')) { setBlock(i, { t: 'p' }); return }      // dòng trống của danh sách → thoát danh sách
      const el = e.target, pos = el.selectionStart ?? b.x.length
      const t = b.t === 'h' ? 'p' : b.t
      const nb = [...B.slice(0, i), { ...b, x: b.x.slice(0, pos) }, { t, x: b.x.slice(pos), ok: false, bold: false }, ...B.slice(i + 1)]
      focusNext.current = i + 1; setBody(nb)
    } else if (e.key === 'Backspace' && e.target.selectionStart === 0 && e.target.selectionEnd === 0 && i > 0) {
      e.preventDefault()
      if (b.t !== 'p') { setBlock(i, { t: 'p', ok: false }); return }
      const prev = B[i - 1]
      focusNext.current = i - 1; setBody([...B.slice(0, i - 1), { ...prev, x: prev.x + b.x }, ...B.slice(i + 1)])
    }
  }
  // Nút định dạng: đổi kiểu dòng đang gõ; chưa chọn dòng thì thêm dòng mới ở cuối
  const fmt = t => {
    const B = bodyOf(nRef.current), i = focus ?? -1
    if (i < 0 || !B[i]) { focusNext.current = B.length; setBody([...B, { t, x: '', ok: false }]); return }
    if (t === 'bold') { setBlock(i, { bold: !B[i].bold }); refs.current[i]?.focus(); return }
    setBlock(i, { t: B[i].t === t ? 'p' : t }); refs.current[i]?.focus()
  }
  const tick = i => {
    if (!ed) { toast.info('Bạn chỉ được xem ghi chú này'); return }
    const ok = !bodyOf(nRef.current)[i].ok; setBlock(i, { ok, by: ok ? me : null })
  }
  const mic = () => {
    if (rec) { recRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Máy này chưa cho ghi âm trong app — chạm vào dòng chữ rồi dùng nút 🎤 trên bàn phím'); return }
    try {
      const r = new SR(); recRef.current = r
      r.lang = 'vi-VN'; r.interimResults = false; r.continuous = false
      r.onresult = e => {
        const txt = [...e.results].map(x => x[0].transcript).join(' ')
        const add = voiceToBlocks(txt)
        if (!add.length) return
        put(cur => { const B = bodyOf(cur), base = B.length === 1 && !B[0].x ? [] : B
          return { body: [...base, ...add], title: cur.title || txt.split(/[,.:]/)[0].trim().replace(/^./, c => c.toUpperCase()).slice(0, 60) } })
        toast.success('Đã chuyển giọng nói thành chữ')
      }
      r.onerror = e => { setRec(false); if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast.error('Chưa được phép dùng micro — dùng nút 🎤 trên bàn phím') }
      r.onend = () => setRec(false)
      r.start(); setRec(true)
    } catch { setRec(false); toast.error('Không bật được ghi âm — dùng nút 🎤 trên bàn phím') }
  }
  const share = note.share || {}
  const others = [note.owner, ...Object.keys(share)].filter(k => k !== me)
  const book = books.find(b => b.id === n.book_id)

  return (
    <div className="fixed inset-0 z-[70] bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="bg-white border-b border-gray-200"><div className="max-w-2xl mx-auto flex items-center gap-1 px-2 py-2">
        <button onClick={onBack} className="w-10 h-10 text-2xl text-purple-600" aria-label="Quay lại">‹</button>
        <span className="flex-1 min-w-0 text-sm text-gray-400 truncate">{own ? (book ? `${book.emoji} ${book.name}` : '📥 Chưa xếp sổ') : 'của ' + nameOf(note.owner, me)}</span>
        {own && <button onClick={onShare} className="px-3 h-9 rounded-xl bg-purple-50 text-purple-700 text-sm font-semibold">👥 Chia sẻ</button>}
        {own && <button onClick={() => setMore(true)} className="w-10 h-10 text-xl" aria-label="Thêm">⋯</button>}
      </div></div>
      <div className="flex-1 overflow-y-auto"><div className="max-w-2xl mx-auto px-4 pt-3" style={{ paddingBottom: ed ? 90 : 30 }}>
        {role === 'view' && <div className="rounded-xl px-3 py-2 mb-2 text-sm bg-blue-50 text-blue-700">👁 {nameOf(note.owner, me)} chia sẻ để bạn xem</div>}
        {role !== 'view' && others.length > 0 && <button onClick={own ? onShare : undefined}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 mb-2 text-[13px] bg-purple-50 text-purple-800 text-left">
          <span className="flex -space-x-1.5">{others.map(k => <Ava key={k} k={k}/>)}</span>
          <span className="flex-1 min-w-0">{own ? Object.entries(share).map(([k, v]) => nameOf(k, me) + (v === 'edit' ? ' ✏️' : ' 👁')).join(', ') : 'Bạn được sửa cùng ' + others.map(k => nameOf(k, me)).join(', ')}
            {note.updated_by && note.updated_by !== me && <span className="text-purple-500"> · {nameOf(note.updated_by, me)} sửa {ago(note.updated_at)}</span>}</span>
        </button>}
        {ed ? <Grow value={n.title} onChange={v => put({ title: v })} placeholder="Tiêu đề" className="text-[22px] font-bold py-1"/>
          : <h1 className="text-[22px] font-bold py-1">{n.title || 'Ghi chú'}</h1>}
        <div className="mt-1">{B.map((b, i) => (
          <div key={i} className={`flex items-start gap-2 py-0.5 ${b.t === 'c' && b.ok ? 'opacity-60' : ''}`}>
            {b.t === 'c' && <button onClick={() => tick(i)} aria-label={b.ok ? 'Bỏ đánh dấu' : 'Đánh dấu xong'}
              className={`w-[22px] h-[22px] mt-[3px] rounded-md border-2 flex-shrink-0 flex items-center justify-center text-white text-sm ${b.ok ? 'bg-purple-600 border-purple-600' : 'border-purple-300 bg-white'}`}>{b.ok ? '✓' : ''}</button>}
            {b.t === 'b' && <span className="w-1.5 h-1.5 bg-gray-700 rounded-full mt-[11px] mx-2 flex-shrink-0"/>}
            <div className="flex-1 min-w-0">{ed
              ? <Grow value={b.x} onChange={v => setBlock(i, { x: v })} onKeyDown={e => onKey(i, e)} onFocus={() => setFocus(i)} inputRef={el => { refs.current[i] = el }}
                  placeholder={i === 0 && B.length === 1 ? 'Viết gì đó… hoặc bấm 🎤 để nói' : ''}
                  className={`text-[16px] ${b.t === 'h' ? 'text-lg font-bold' : ''} ${b.bold ? 'font-bold' : ''} ${b.t === 'c' && b.ok ? 'line-through' : ''}`}/>
              : <p className={`text-[16px] leading-[1.45] whitespace-pre-wrap break-words ${b.t === 'h' ? 'text-lg font-bold' : ''} ${b.bold ? 'font-bold' : ''} ${b.t === 'c' && b.ok ? 'line-through' : ''}`}>{b.x || ' '}</p>}
            </div>
            {b.t === 'c' && b.ok && b.by && others.length > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded-md mt-1 flex-shrink-0 font-medium" style={{ background: AV[b.by] + '22', color: AV[b.by] }}>✓ {nameOf(b.by, me)}</span>}
            {b.t === 'c' && !b.ok && b.x && onMakeTask && <button onClick={() => onMakeTask(b.x)} className="text-[11px] px-1.5 py-1 rounded-md bg-purple-50 text-purple-700 mt-0.5 flex-shrink-0" aria-label="Tạo việc">⏰</button>}
          </div>))}</div>
        {(n.secrets || []).length > 0 && <div className="bg-purple-50/60 border border-dashed border-purple-200 rounded-2xl p-3 mt-3">
          <p className="text-[13px] font-semibold text-purple-800">🔑 Mật khẩu & tài khoản</p>
          {n.secrets.map((s, i) => <SecretRow key={i} s={s} onEdit={ed ? () => setSecret({ i }) : null}/>)}
          {ed && <button onClick={() => setSecret({ i: -1 })} className="text-sm text-purple-700 mt-2">+ Thêm dòng</button>}
        </div>}
        <p className="text-[11px] text-gray-400 text-center mt-6">Sửa {ago(note.updated_at)}{note.updated_by ? ' · ' + nameOf(note.updated_by, me) : ''}</p>
      </div></div>
      {ed && <div className="bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="max-w-2xl mx-auto flex justify-around px-2 py-2">
          {[['bold', <b key="b">B</b>, 'Chữ đậm'], ['h', 'H', 'Tiêu đề'], ['b', '•', 'Gạch đầu dòng'], ['c', '☑', 'Checklist']].map(([t, l, a]) => (
            <button key={t} onMouseDown={e => e.preventDefault()} onClick={() => fmt(t)} aria-label={a}
              className={`w-11 h-10 rounded-xl text-lg ${focus !== null && (t === 'bold' ? B[focus]?.bold : B[focus]?.t === t) ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}>{l}</button>))}
          <button onClick={() => setSecret({ i: -1 })} className="w-11 h-10 rounded-xl bg-gray-100 text-lg" aria-label="Thêm mật khẩu">🔑</button>
          <button onClick={mic} className={`w-14 h-10 rounded-xl text-white text-lg ${rec ? 'bg-red-600 animate-pulse' : 'bg-red-500'}`} aria-label="Nói để ghi">🎤</button>
        </div></div>}
      {secret && <SecretSheet item={secret.i >= 0 ? n.secrets[secret.i] : null} onClose={() => setSecret(null)}
        onSave={s => { const L = [...(n.secrets || [])]; if (secret.i >= 0) L[secret.i] = s; else L.push(s); put({ secrets: L }); setSecret(null) }}
        onDelete={() => { put({ secrets: n.secrets.filter((_, j) => j !== secret.i) }); setSecret(null) }}/>}
      {more && <Sheet onClose={() => setMore(false)} title="Ghi chú">
        <button onClick={() => { put({ pinned: !n.pinned }); setMore(false) }} className="w-full text-left py-3 border-b border-gray-100">{n.pinned ? '📌 Bỏ ghim' : '📌 Ghim lên đầu'}</button>
        <p className="text-xs text-gray-500 mt-3 mb-1.5">Chuyển sang sổ</p>
        <div className="flex flex-wrap gap-1.5">{[{ id: null, emoji: '📥', name: 'Chưa xếp sổ' }, ...books].map(b => (
          <button key={b.id || 'none'} onClick={() => { put({ book_id: b.id }); onMove?.(); setMore(false) }}
            className={`px-3 py-2 rounded-full text-sm ${n.book_id === b.id ? 'bg-gray-800 text-white' : 'bg-gray-100'}`}>{b.emoji} {b.name}</button>))}</div>
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
    if (n && n.owner === me && !n.title.trim() && !(n.body || []).some(b => b.x) && !(n.secrets || []).length) {   // ghi chú trống → bỏ
      deleteNote(n.id).then(() => setNotes(ns => ns.filter(x => x.id !== n.id))).catch(() => {})
    }
  }
  const newNote = async (fields = {}) => {
    try {
      const n = await createNote({ book_id: bookId !== undefined ? bookId : null, ...fields })
      setNotes(ns => [n, ...ns]); setNoteId(n.id)
    } catch (e) { toast.error('Lỗi tạo ghi chú: ' + e.message) }
  }
  const [listen, setListen] = useState(null)          // đang nghe để tạo ghi chú mới
  const voiceNote = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.info('Máy này chưa cho ghi âm trong app — mở ghi chú mới, chạm vào dòng chữ rồi dùng nút 🎤 trên bàn phím'); newNote(); return }
    try {
      const r = new SR(); r.lang = 'vi-VN'; r.interimResults = true; r.continuous = false
      let txt = ''
      r.onresult = e => { txt = [...e.results].map(x => x[0].transcript).join(' '); setListen({ r, txt }) }
      r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast.error('Chưa được phép dùng micro — dùng nút 🎤 trên bàn phím') }
      r.onend = () => {
        setListen(null)
        const body = voiceToBlocks(txt)
        if (body.length) newNote({ title: txt.split(/[,.:]/)[0].trim().replace(/^./, c => c.toUpperCase()).slice(0, 60), body })
      }
      r.start(); setListen({ r, txt: '' })
    } catch { toast.error('Không bật được ghi âm') }
  }

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
          {!notes.length && <p className="text-sm text-gray-500 text-center mt-6 leading-relaxed">Chưa có ghi chú nào.<br/>Bấm <b>＋</b> để viết, hoặc <b>🎤</b> để nói.</p>}
        </>}
      </div>

      {listen && <div className="fixed inset-x-3 z-30 bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-900 shadow-lg" style={{ bottom: 'calc(150px + env(safe-area-inset-bottom, 0px))' }}>
        <b>🎙 Đang nghe…</b> {listen.txt || 'nói đi, vd: “đi chợ, danh sách: rau, thịt, sữa”'}
        <button onClick={() => listen.r.stop()} className="block mt-2 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm">Xong</button></div>}
      {<div className="fixed right-4 flex gap-3 z-20" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={voiceNote} className="w-14 h-14 rounded-full bg-red-500 text-white text-2xl shadow-lg active:scale-95" aria-label="Ghi chú bằng giọng nói">🎤</button>
        <button onClick={() => newNote()} className="w-14 h-14 rounded-full bg-purple-600 text-white text-3xl shadow-lg active:scale-95" aria-label="Ghi chú mới">＋</button>
      </div>}

      {cur && <Editor key={cur.id} note={cur} me={me} books={books} onBack={closeNote} onChange={change} onMakeTask={onMakeTask}
        onShare={() => setShareFor(cur)}
        onDelete={async () => { try { await flush(); await deleteNote(cur.id); setNotes(ns => ns.filter(x => x.id !== cur.id)); setNoteId(null); toast.success('Đã xoá ghi chú') } catch (e) { toast.error('Lỗi xoá: ' + e.message) } }}/>}
      {shareFor && <ShareSheet note={shareFor} me={me} onClose={() => setShareFor(null)}
        onSave={async s => { setShareFor(null); change(shareFor, { share: s }); await flush(); toast.success(Object.keys(s).length ? 'Đã chia sẻ — người được chọn thấy ngay' : 'Đã chuyển về chỉ mình tôi') }}/>}
      {bookEdit && <BookSheet book={bookEdit} count={mine.filter(n => n.book_id === bookEdit.id).length} onClose={() => setBookEdit(null)}
        onSave={async b => { try { const row = await saveBook(b); setBooks(bs => b.id ? bs.map(x => x.id === row.id ? row : x) : [...bs, row]); setBookEdit(null); toast.success('Đã lưu sổ') } catch (e) { toast.error('Lỗi: ' + e.message) } }}
        onDelete={async b => { try { await deleteBook(b.id); setBooks(bs => bs.filter(x => x.id !== b.id)); setNotes(ns => ns.map(n => n.book_id === b.id ? { ...n, book_id: null } : n)); setBookEdit(null); setBookId(undefined); toast.success('Đã xoá sổ') } catch (e) { toast.error('Lỗi: ' + e.message) } }}/>}
    </div>)
}
