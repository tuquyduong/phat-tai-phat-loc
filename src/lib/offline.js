// ============================================
// DỮ LIỆU HIỆN NGAY + XEM ĐƯỢC KHI MẤT MẠNG
// Mọi lần ĐỌC dữ liệu từ Supabase đều được nhớ lại trong máy (IndexedDB), TÁCH RIÊNG theo tài khoản.
//  • Mới mở app (10 giây đầu): trả ngay dữ liệu đã nhớ → màn hình hiện liền, đồng thời hỏi máy chủ;
//    số liệu khác đi thì bắn sự kiện 'sb-fresh' để các trang tải lại lặng lẽ.
//  • Sau đó: luôn hỏi máy chủ trước; mất mạng mới dùng dữ liệu đã nhớ.
//  • GHI (thêm/sửa/xoá) KHÔNG bao giờ dùng dữ liệu nhớ — luôn gửi thẳng máy chủ.
//  • Đăng xuất → xoá sạch dữ liệu nhớ trong máy.
// Dữ liệu gốc vẫn chỉ nằm trên máy chủ; đây chỉ là bản sao để xem.
// ============================================

const DB = 'chimai-offline', STORE = 'r'
const STARTUP_MS = 10000
const T0 = Date.now()
// Các hàm rpc CHỈ ĐỌC được phép nhớ (rpc khác có thể là ghi → không bao giờ nhớ)
const READ_RPC = ['expense_totals', 'expense_running_totals', 'db_usage']

// ---------- IndexedDB tối giản ----------
let dbp = null
function db() {
  if (dbp) return dbp
  dbp = new Promise((res, rej) => {
    try {
      const q = indexedDB.open(DB, 1)
      q.onupgradeneeded = () => q.result.createObjectStore(STORE)
      q.onsuccess = () => res(q.result)
      q.onerror = () => rej(q.error)
    } catch (e) { rej(e) }
  }).catch(e => { dbp = null; throw e })
  return dbp
}
function tx(mode, fn) {
  return db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), s = t.objectStore(STORE)
    const q = fn(s)
    t.oncomplete = () => res(q?.result)
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  }))
}
const idbGet = k => tx('readonly', s => s.get(k)).catch(() => null)
const idbSet = (k, v) => tx('readwrite', s => s.put(v, k)).catch(() => {})
export const clearOffline = () => tx('readwrite', s => s.clear()).catch(() => {})

// ---------- Trạng thái để hiện dòng báo nhỏ ----------
const st = { offline: typeof navigator !== 'undefined' && navigator.onLine === false, staleAt: 0, syncing: 0 }
const emit = () => { try { window.dispatchEvent(new CustomEvent('sb-status', { detail: { ...st } })) } catch { /* */ } }
export const offlineStatus = () => ({ ...st })
function markStale(at) { st.staleAt = st.staleAt ? Math.min(st.staleAt, at) : at; emit() }
function markOnline() { if (st.offline || st.staleAt) { st.offline = false; st.staleAt = 0; emit() } }
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => { st.offline = true; emit() })
  // Có mạng lại → các trang tải lại dữ liệu mới
  window.addEventListener('online', () => { st.offline = false; emit(); fresh() })
}
let freshTimer = null
function fresh() {
  clearTimeout(freshTimer)
  freshTimer = setTimeout(() => { try { window.dispatchEvent(new Event('sb-fresh')) } catch { /* */ } }, 250)
}

// ---------- Tài khoản từ mã đăng nhập (JWT) ----------
function uidOf(auth) {
  try {
    const tok = (auth || '').replace(/^Bearer\s+/i, '')
    const p = JSON.parse(decodeURIComponent(escape(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))))
    return p.sub || null                       // khoá công khai (chưa đăng nhập) không có sub → không nhớ
  } catch { return null }
}

// Lấy mã đăng nhập mới (sau khi gia hạn) — supabase.js gắn vào
let freshToken = null
export function setTokenGetter(fn) { freshToken = fn }

const KEEP_HEADERS = ['content-type', 'content-range', 'preference-applied']
async function save(key, res) {
  try {
    const body = await res.text()
    const headers = {}
    KEEP_HEADERS.forEach(h => { const v = res.headers.get(h); if (v) headers[h] = v })
    const rec = { at: Date.now(), status: res.status, body, headers }
    await idbSet(key, rec)
    return rec
  } catch { return null }
}
const toRes = rec => new Response(rec.body, { status: rec.status, headers: rec.headers })

const served = new Set()
let revalidating = 0, changed = false

export async function offlineFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url
  const method = (init.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase()
  if (!url.includes('/rest/v1/')) return fetch(input, init)
  const isRpc = url.includes('/rest/v1/rpc/')
  const readRpc = method === 'POST' && isRpc && READ_RPC.some(n => new URL(url).pathname.endsWith('/rpc/' + n))
  if (!(method === 'GET' && !isRpc) && !readRpc) return fetch(input, init)          // GHI: luôn gửi thẳng máy chủ

  const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined))
  const uid = uidOf(headers.get('Authorization'))
  if (!uid) return fetch(input, init)
  const key = [uid, method, headers.get('Accept') || '', url, readRpc ? String(init.body || '') : ''].join('|')

  const cached = await idbGet(key)
  const offline = navigator.onLine === false
  const startup = !served.has(key) && Date.now() - T0 < STARTUP_MS
  served.add(key)

  // Mới mở app hoặc đang mất mạng: trả ngay dữ liệu đã nhớ
  if (cached && (offline || startup)) {
    if (offline) markStale(cached.at)
    else revalidate(input, init, key, cached)
    return toRes(cached)
  }

  try {
    let res = await fetch(input, init)
    // Mã đăng nhập hết hạn (thường do vừa mở app sau nhiều giờ): lấy mã mới rồi thử lại 1 lần
    if (res.status === 401 && freshToken) {
      const tok = await freshToken().catch(() => null)
      if (tok && 'Bearer ' + tok !== headers.get('Authorization')) {
        headers.set('Authorization', 'Bearer ' + tok)
        res = await fetch(input, { ...init, headers })
      }
    }
    if (res.ok) { save(key, res.clone()); markOnline(); return res }
    if (cached && (res.status === 401 || res.status >= 500)) { markStale(cached.at); return toRes(cached) }
    return res
  } catch (e) {
    if (cached) { markStale(cached.at); return toRes(cached) }        // mất mạng giữa chừng
    throw e
  }
}

// Hỏi máy chủ ngầm sau khi đã trả dữ liệu nhớ; khác thì báo các trang tải lại
function revalidate(input, init, key, cached) {
  revalidating++; st.syncing = revalidating; emit()
  ;(async () => {
    try {
      let res = await fetch(input, init)
      if (res.status === 401 && freshToken) {
        const tok = await freshToken().catch(() => null)
        if (tok) { const h = new Headers(init.headers); h.set('Authorization', 'Bearer ' + tok); res = await fetch(input, { ...init, headers: h }) }
      }
      if (res.ok) {
        const rec = await save(key, res)
        if (rec && rec.body !== cached.body) changed = true
        markOnline()
      } else markStale(cached.at)
    } catch { markStale(cached.at) }
    finally {
      revalidating--; st.syncing = revalidating; emit()
      if (revalidating === 0 && changed) { changed = false; fresh() }
    }
  })()
}

// Cho các trang: đăng ký tải lại khi có dữ liệu mới
export function onFresh(fn) {
  window.addEventListener('sb-fresh', fn)
  return () => window.removeEventListener('sb-fresh', fn)
}
