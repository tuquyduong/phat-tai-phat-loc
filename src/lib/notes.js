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

// ---- Nội dung: danh sách khối {t:'p'|'h'|'b'|'c', x, ok, by, bold} ----
export const plain = n => [n.title, ...(n.body || []).map(b => b.x), ...(n.secrets || []).map(s => s.n + ' ' + (s.u || ''))].join(' ')
export function preview(n) {
  const B = n.body || []
  const c = B.filter(b => b.t === 'c')
  if (c.length) return `☑ ${c.filter(b => b.ok).length}/${c.length} xong` + (c.some(b => !b.ok) ? ' · còn: ' + c.filter(b => !b.ok).map(b => b.x).filter(Boolean).join(', ') : '')
  const t = B.map(b => b.x).filter(Boolean).join(' · ')
  if (t) return t
  if ((n.secrets || []).length) return '🔑 ' + n.secrets.map(s => s.n).join(' · ')
  return ''
}

// Giọng nói → khối: "… danh sách: a, b, c" → checklist; "xuống dòng"; "gạch đầu dòng …"
export function voiceToBlocks(txt) {
  const s = String(txt || '').trim()
  if (!s) return []
  const m = s.match(/^(.*?)[,.\s]*danh sách\s*[:：]?\s*(.+)$/i)
  if (m) {
    const out = m[1].trim() ? [{ t: 'p', x: m[1].trim() }] : []
    return [...out, ...m[2].split(/,|;| và /i).map(x => x.trim()).filter(Boolean).map(x => ({ t: 'c', x, ok: false }))]
  }
  return s.split(/\s*xuống dòng\s*/i).filter(Boolean).map(p => {
    const g = p.match(/^gạch đầu dòng\s*(.+)/i)
    return g ? { t: 'b', x: g[1] } : { t: 'p', x: p }
  })
}
