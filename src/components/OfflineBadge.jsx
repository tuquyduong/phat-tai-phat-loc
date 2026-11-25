// Dòng báo nhỏ phía trên thanh tab: mất mạng (đang xem dữ liệu lúc …) hoặc đang cập nhật số mới.
import { useEffect, useState } from 'react'
import { offlineStatus } from '../lib/offline'

const hhmm = at => {
  const d = new Date(at), now = new Date()
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toDateString() === now.toDateString() ? t : `${t} ${d.getDate()}/${d.getMonth() + 1}`
}

export default function OfflineBadge({ bottom = true }) {
  const [s, setS] = useState(offlineStatus)
  const [showSync, setShowSync] = useState(false)
  useEffect(() => {
    const f = e => setS(e.detail)
    window.addEventListener('sb-status', f)
    return () => window.removeEventListener('sb-status', f)
  }, [])
  // Chỉ báo "đang cập nhật" nếu kéo dài quá 0,8 giây — nhanh thì không nhấp nháy
  useEffect(() => {
    if (!s.syncing) { setShowSync(false); return }
    const t = setTimeout(() => setShowSync(true), 800)
    return () => clearTimeout(t)
  }, [s.syncing])

  let text = null, cls = ''
  if (s.offline) { text = `📴 Mất mạng · đang xem dữ liệu${s.staleAt ? ' lúc ' + hhmm(s.staleAt) : ' đã lưu'}`; cls = 'bg-gray-800 text-white' }
  else if (s.staleAt) { text = `⚠️ Mạng yếu · dữ liệu lúc ${hhmm(s.staleAt)}`; cls = 'bg-amber-100 text-amber-900' }
  else if (showSync) { text = '↻ Đang cập nhật…'; cls = 'bg-white text-gray-500 border border-gray-200' }
  if (!text) return null
  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center pointer-events-none"
      style={bottom ? { bottom: 'calc(70px + env(safe-area-inset-bottom))' } : { top: 'calc(8px + env(safe-area-inset-top))' }}>
      <div className={`px-3 py-1 rounded-full text-[11.5px] font-medium shadow-sm ${cls}`}>{text}</div>
    </div>
  )
}
