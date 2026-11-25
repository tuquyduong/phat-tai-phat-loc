// ============================================
// SERVICE WORKER — mở app tức thì, mất mạng vẫn chạy
// • Chương trình (index.html + /assets/*) lưu sẵn trong máy: mở là chạy ngay từ máy, không chờ mạng.
// • Bản mới: tải ngầm khi có mạng, lần mở sau dùng bản mới (index.html còn tự tải lại 1 lần khi thấy bản mới).
// • Dữ liệu (Supabase) KHÔNG đi qua đây — do src/lib/offline.js lo, theo từng tài khoản.
// ============================================
const CACHE = 'chimai-app'
const SHELL = '/index.html'

// Lưu index.html + toàn bộ file chương trình theo /asset-list.json (do bản build tạo ra).
// Giữ 2 thế hệ: file của bản cũ chỉ xoá khi đã có bản mới hơn nữa (máy đang chạy bản cũ vẫn mở được tab chưa tải).
async function syncAssets(cache) {
  let list
  try {
    const r = await fetch('/asset-list.json', { cache: 'no-store' })
    if (!r.ok) return
    list = await r.json()
  } catch { return }
  const prevRes = await cache.match('/asset-list.json')
  const prev = prevRes ? await prevRes.json().catch(() => []) : []
  const have = new Set((await cache.keys()).map(q => new URL(q.url).pathname))
  for (const f of list) {
    if (have.has(f)) continue
    try { const r = await fetch(f); if (r.ok) await cache.put(f, r) } catch { /* lần sau thử lại */ }
  }
  if (JSON.stringify(prev) !== JSON.stringify(list)) {
    const keep = new Set([...list, ...prev])
    for (const q of await cache.keys()) {
      const p = new URL(q.url).pathname
      if (p.startsWith('/assets/') && !keep.has(p)) await cache.delete(q)
    }
    await cache.put('/asset-list.json', new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }))
  }
}
async function refreshShell() {
  const cache = await caches.open(CACHE)
  try {
    const r = await fetch(SHELL, { cache: 'no-store' })
    if (r.ok) await cache.put(SHELL, r)
  } catch { return }
  await syncAssets(cache)
}

self.addEventListener('install', event => {
  event.waitUntil(refreshShell())
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const n of await caches.keys()) if (n !== CACHE) await caches.delete(n)   // xoá kho cũ 'order-tracker-v1'
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return          // Supabase, ảnh… đi thẳng
  if (url.searchParams.has('__v')) return                   // kiểm tra phiên bản: luôn hỏi máy chủ

  // Mở app: trả ngay bản trong máy, đồng thời tải ngầm bản mới cho lần sau
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === SHELL) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(SHELL)
      if (hit) { event.waitUntil(refreshShell()); return hit }
      try {
        const r = await fetch(SHELL, { cache: 'no-store' })
        if (r.ok) { await cache.put(SHELL, r.clone()); event.waitUntil(syncAssets(cache)) }
        return r
      } catch { return new Response('Không có mạng và app chưa được lưu trong máy. Mở lại khi có mạng.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }) }
    })())
    return
  }

  // File chương trình có mã băm trong tên → không bao giờ đổi: lấy trong máy trước
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(url.pathname)
      if (hit) return hit
      const r = await fetch(request)
      if (r.ok) await cache.put(url.pathname, r.clone())
      return r
    })())
    return
  }

  // Còn lại (biểu tượng, manifest…): trả bản trong máy nếu có, tải ngầm bản mới
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const hit = await cache.match(request)
    const net = fetch(request).then(r => { if (r.ok) cache.put(request, r.clone()); return r }).catch(() => null)
    if (hit) { event.waitUntil(net); return hit }
    return (await net) || new Response('', { status: 504 })
  })())
})

// ── THÔNG BÁO ĐẨY (tab Việc) ──
// Máy chủ gửi { title, body, tag, url }. Nội dung hỏng thì vẫn hiện thông báo chung,
// vì iPhone sẽ tắt quyền thông báo nếu nhận tin mà không hiện gì.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} }
  catch { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'Chi Mai'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: data.tag || undefined,            // cùng tag thì thay thế, không chồng thêm
    renotify: !!data.tag,
    vibrate: [100, 50, 100],
    data: { url: data.url || '/?tab=viec' },
  }))
})

// Bấm vào thông báo: mở app sẵn có (nếu đang mở) và chuyển tới đúng mục (go=daily:<id> | task:<id>:<ngày>)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/?tab=viec'
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) {
        let go = null
        try { go = new URL(url, self.location.origin).searchParams.get('go') } catch { /* bỏ qua */ }
        c.postMessage({ type: 'open-tab', tab: 'viec', go }); return c.focus()
      }
    }
    return clients.openWindow(url)
  })())
})
