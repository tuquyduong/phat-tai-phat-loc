// Mở link trong ghi chú: link Facebook / YouTube mở THẲNG trong app tương ứng (đúng video),
// link khác mở bằng trình duyệt. App chưa cài → tự mở bằng trình duyệt.
const ua = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '')
const isIOS = () => /iP(hone|ad|od)/.test(ua()) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Địa chỉ mở bằng app (chỉ dùng trên iPhone/iPad; Android tự chuyển sang app khi mở link thường)
export function appUrl(href) {
  let u
  try { u = new URL(href) } catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  const h = u.hostname.toLowerCase().replace(/^(www|m|web|mbasic)\./, '')
  // Facebook: mở đúng trang/video trong app Facebook
  if (h === 'facebook.com' || h === 'fb.com' || h === 'fb.watch') {
    return 'fb://facewebmodal/f?href=' + encodeURIComponent(u.href)
  }
  // YouTube: youtube://www.youtube.com/watch?v=… · youtu.be/ID → watch?v=ID
  if (h === 'youtube.com' || h === 'youtu.be') {
    if (h === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      if (!id) return null
      const q = new URLSearchParams(u.search); q.set('v', id)
      return 'youtube://www.youtube.com/watch?' + q.toString()
    }
    return 'youtube://www.youtube.com' + u.pathname + u.search
  }
  return null
}

export function openLink(href) {
  if (!href) return
  if (typeof window !== 'undefined' && window.__linkSpy) return window.__linkSpy(href, isIOS() ? appUrl(href) : null)   // dùng khi kiểm thử
  const app = isIOS() ? appUrl(href) : null
  if (app) {
    // Mở app; nếu sau 1,5 giây vẫn đứng ở đây (máy chưa cài app) thì mở bằng trình duyệt
    let left = false
    const gone = () => { left = true }
    document.addEventListener('visibilitychange', gone, { once: true })
    window.addEventListener('pagehide', gone, { once: true })
    window.location.href = app
    setTimeout(() => {
      document.removeEventListener('visibilitychange', gone)
      window.removeEventListener('pagehide', gone)
      if (!left && document.visibilityState === 'visible') window.location.href = href
    }, 1500)
    return
  }
  const w = window.open(href, '_blank')            // ('noopener' làm window.open luôn trả null → không dùng)
  if (w) { try { w.opener = null } catch { /* */ } } else window.location.href = href
}
