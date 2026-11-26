// Mở link trong ghi chú.
// • Facebook (video, reel, bài viết) và trang web: mở bằng link thật (thẻ <a target=_blank>) ngay trong lần chạm.
//   iPhone nhận ra link facebook.com thuộc app Facebook ("Universal Link") → mở thẳng app tới ĐÚNG video,
//   giống khi chạm link trong Tin nhắn/Zalo. Chưa cài app → mở trang web của video.
//   (Không dùng fb://facewebmodal: Facebook đã bỏ, chỉ mở trang chủ. Không dùng window.open: iPhone có thể
//    làm app trắng màn hình khi quay lại — lỗi WebKit 199029.)
// • YouTube trên iPhone: youtube:// mở thẳng app đúng video (giữ cả giây t=).
const ua = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '')
const isIOS = () => /iP(hone|ad|od)/.test(ua()) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Địa chỉ mở bằng app riêng (chỉ YouTube trên iPhone/iPad)
export function appUrl(href) {
  let u
  try { u = new URL(href) } catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  const h = u.hostname.toLowerCase().replace(/^(www|m)\./, '')
  if (h === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    if (!id) return null
    const q = new URLSearchParams(u.search); q.set('v', id)
    return 'youtube://www.youtube.com/watch?' + q.toString()
  }
  if (h === 'youtube.com') return 'youtube://www.youtube.com' + u.pathname + u.search
  return null
}

// Bấm một link thật, mở ở cửa sổ mới — phải gọi NGAY trong lần chạm của người dùng
function clickOut(href) {
  const a = document.createElement('a')
  a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function openLink(href) {
  if (!href) return
  let u
  try { u = new URL(href, window.location.href) } catch { return }
  if (!/^https?:$/.test(u.protocol)) return clickOut(u.href)
  const app = isIOS() ? appUrl(u.href) : null
  if (typeof window !== 'undefined' && window.__linkSpy) return window.__linkSpy(u.href, app)   // dùng khi kiểm thử
  if (app) {
    // YouTube: mở app; sau 1,5 giây vẫn đứng ở đây (chưa cài app) → mở trang web
    let left = false
    const gone = () => { left = true }
    document.addEventListener('visibilitychange', gone, { once: true })
    window.addEventListener('pagehide', gone, { once: true })
    window.location.href = app
    setTimeout(() => {
      document.removeEventListener('visibilitychange', gone)
      window.removeEventListener('pagehide', gone)
      if (!left && document.visibilityState === 'visible') clickOut(u.href)
    }, 1500)
    return
  }
  clickOut(u.href)
}
