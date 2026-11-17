// ============================================
// GHI CHÚ — riêng từng tài khoản; người khác chỉ thấy khi được chia sẻ (khoá ở database)
// Bảng: viec_note_books (sổ, chỉ chủ thấy) · viec_notes (ghi chú, share = {"mai":"view"|"edit"})
// ============================================
import { supabase } from './supabase'

export const NOTE_PEOPLE = ['linh', 'mai', 'choo', 'moon']
export const BOOK_COLORS = ['#ede9fe', '#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#e5e7eb']
const NOTE_COLS = 'id, owner, book_id, title, body, secrets, share, pinned, created_at, updated_at, updated_by'

// Quyền của người đang xem trên một ghi chú: own | edit | view | null
export const roleOf = (n, me) => !n ? null : n.owner === me ? 'own' : (n.share || {})[me] || null
export const canEdit = (n, me) => ['own', 'edit'].includes(roleOf(n, me))

export async function listBooks() {
  const { data, error } = await supabase.from('viec_note_books').select('*').order('sort').order('created_at')
  if (error) throw error
  return data || []
}
export async function saveBook(b) {
  const f = { name: b.name, emoji: b.emoji, color: b.color }
  const q = b.id ? supabase.from('viec_note_books').update(f).eq('id', b.id) : supabase.from('viec_note_books').insert([f])
  const { data, error } = await q.select().single()
  if (error) throw error
  return data
}
// Xoá sổ: ghi chú bên trong KHÔNG mất, chuyển về "Chưa xếp sổ" (database tự đặt book_id = null)
export async function deleteBook(id) {
  const { error } = await supabase.from('viec_note_books').delete().eq('id', id)
  if (error) throw error
}

export async function listNotes() {
  const { data, error } = await supabase.from('viec_notes').select(NOTE_COLS).order('updated_at', { ascending: false })
  if (error) throw error
  return data || []
}
export async function getNote(id) {
  const { data, error } = await supabase.from('viec_notes').select(NOTE_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}
export async function createNote(fields) {
  const { data, error } = await supabase.from('viec_notes').insert([{ title: '', body: [{ t: 'p', x: '' }], ...fields }]).select(NOTE_COLS).single()
  if (error) throw error
  return data
}
export async function updateNote(id, fields) {
  const { data, error } = await supabase.from('viec_notes').update(fields).eq('id', id).select(NOTE_COLS).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Không còn quyền sửa ghi chú này')
  return data
}
export async function deleteNote(id) {
  const { error } = await supabase.from('viec_notes').delete().eq('id', id)
  if (error) throw error
}

// ---- Ghi chú người khác vừa chia sẻ / sửa mà mình chưa xem → số đỏ trên nút 📝 ----
const SEEN = me => 'ghichu_seen_' + me
export function seenAt(me) { try { return localStorage.getItem(SEEN(me)) || '' } catch { return '' } }
export function markSeen(me) { try { localStorage.setItem(SEEN(me), new Date().toISOString()) } catch { /* bỏ qua */ } }
export const isNewFor = (n, me, seen) => n.owner !== me ? (n.updated_by !== me && n.updated_at > seen) : false
export async function countNew(me) {
  const seen = seenAt(me)
  let q = supabase.from('viec_notes').select('id, owner, updated_at, updated_by').neq('owner', me)
  if (seen) q = q.gt('updated_at', seen)
  const { data, error } = await q
  if (error) return 0
  return (data || []).filter(n => n.updated_by !== me).length
}

// ---- Nội dung ----
// Định dạng mới: body = tài liệu của trình soạn {type:'doc', content:[…]}.
// Định dạng cũ (bản đầu): body = [{t:'p'|'h'|'b'|'c', x, ok, by, bold}] + cột title — tự chuyển khi mở.
export const isDoc = b => !!b && !Array.isArray(b) && b.type === 'doc'
const txt = (t, marks) => t ? [{ type: 'text', text: t, ...(marks ? { marks } : {}) }] : undefined
const para = (t, marks) => ({ type: 'paragraph', ...(t ? { content: txt(t, marks) } : {}) })

export function toDoc(n) {
  if (isDoc(n?.body)) return n.body
  const out = [], push = (kind, item) => {             // gộp các dòng liên tiếp cùng loại vào một danh sách
    const last = out[out.length - 1]
    if (last?.type === kind) last.content.push(item); else out.push({ type: kind, ...(kind === 'taskList' ? {} : {}), content: [item] })
  }
  const title = String(n?.title || '').trim()
  if (title) out.push({ type: 'heading', attrs: { level: 1 }, content: txt(title) })
  for (const b of (Array.isArray(n?.body) ? n.body : [])) {
    const lines = String(b.x || '').split('\n')
    lines.forEach((line, i) => {
      const t = line.replace(/\s+$/, '')
      const marks = b.bold && t.length <= 80 ? [{ type: 'bold' }] : undefined   // đậm cả bài (lỡ bấm) thì bỏ
      if (b.t === 'c') push('taskList', { type: 'taskItem', attrs: { checked: !!b.ok, by: b.ok ? b.by || null : null }, content: [para(t, marks)] })
      else if (b.t === 'b') push('bulletList', { type: 'listItem', content: [para(t, marks)] })
      else if (b.t === 'h') out.push({ type: 'heading', attrs: { level: 2 }, ...(t ? { content: txt(t, marks) } : {}) })
      else if (!title && !out.length && i === 0 && t && t.length <= 80) out.push({ type: 'heading', attrs: { level: 1 }, content: txt(t) })   // dòng đầu làm tiêu đề
      else out.push(para(t, marks))
    })
  }
  return { type: 'doc', content: out.length ? out : [{ type: 'heading', attrs: { level: 1 } }] }
}

// Các dòng chữ của tài liệu (mỗi khối một dòng), kèm loại
function lines(doc) {
  const L = []
  const walk = (node, kind) => {
    if (!node) return
    if (node.type === 'paragraph' || node.type === 'heading') {
      L.push({ kind, text: (node.content || []).map(x => x.text || '').join('') }); return
    }
    const k = node.type === 'taskItem' ? (node.attrs?.checked ? 'done' : 'todo') : kind
    ;(node.content || []).forEach(ch => walk(ch, k))
  }
  walk(doc, 'p')
  return L
}
export const docTitle = doc => (lines(doc).find(l => l.text.trim())?.text.trim() || '').slice(0, 100)

export const plain = n => [n.title, ...lines(toDoc({ ...n, title: isDoc(n.body) ? '' : n.title })).map(l => l.text), ...(n.secrets || []).map(s => s.n + ' ' + (s.u || ''))].join(' ')
export function preview(n) {
  const L = lines(toDoc(n)).filter(l => l.text.trim())
  const rest = L[0]?.text.trim() === (n.title || '').trim() ? L.slice(1) : L
  const todo = rest.filter(l => l.kind === 'todo'), done = rest.filter(l => l.kind === 'done')
  if (todo.length + done.length) return `☑ ${done.length}/${todo.length + done.length} xong` + (todo.length ? ' · còn: ' + todo.map(l => l.text).join(', ') : '')
  const t = rest.map(l => l.text).join(' · ')
  if (t) return t
  if ((n.secrets || []).length) return '🔑 ' + n.secrets.map(s => s.n).join(' · ')
  return ''
}
