// ============================================
// THÔNG BÁO ĐẨY — phía điện thoại
// Bật/tắt trên máy này, gửi thử, tuỳ chọn nhắc của từng người.
// Việc gửi do hàm viec-push trên Supabase làm (chạy mỗi phút).
// ============================================
import { supabase } from './supabase'

const FN = 'viec-push'
export const DEFAULT_PREFS = { all: true, todo: true, daily: true, forgot: true, mo: true, moAt: '07:30', ev: true, evAt: '21:30' }

// Máy này có nhận được thông báo không, và vì sao
export function pushSupport() {
  const ua = navigator.userAgent || ''
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  return { supported, ios, standalone, permission: supported ? Notification.permission : 'unsupported' }
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg || navigator.serviceWorker.ready
}
export async function currentSubscription() {
  if (!pushSupport().supported) return null
  try { return await (await registration()).pushManager.getSubscription() } catch { return null }
}

async function call(body) {
  const { data, error } = await supabase.functions.invoke(FN, { body })
  if (error) throw new Error(error.message || 'Không gọi được máy chủ thông báo')
  if (data?.error) throw new Error(data.error)
  return data
}
const b64ToBytes = b64 => {
  const pad = '='.repeat((4 - b64.length % 4) % 4), s = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

// Bật thông báo cho người đang dùng máy này. PHẢI gọi từ một lần bấm nút.
export async function enablePush(who) {
  const sp = pushSupport()
  if (!sp.supported) throw new Error(sp.ios && !sp.standalone
    ? 'Trên iPhone: thêm app vào màn hình chính rồi mở từ biểu tượng đó'
    : 'Trình duyệt này không hỗ trợ thông báo')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Chưa cho phép thông báo — vào Cài đặt điện thoại để bật cho app')
  const { publicKey } = await call({ action: 'key' })
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
  const j = sub.toJSON()
  const { error } = await supabase.from('viec_push_subs').upsert([{
    who, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: navigator.userAgent.slice(0, 120),
  }], { onConflict: 'endpoint' })
  if (error) throw error
  return sub
}

// Tắt trên máy này (máy khác của cùng người vẫn nhận)
export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  const { error } = await supabase.from('viec_push_subs').delete().eq('endpoint', sub.endpoint)
  if (error) throw error
  await sub.unsubscribe()
}

// Đổi người trên máy này → thông báo đi theo người mới
export async function moveSubscription(who) {
  const sub = await currentSubscription()
  if (!sub) return
  const { error } = await supabase.from('viec_push_subs').update({ who }).eq('endpoint', sub.endpoint)
  if (error) throw error
}

// Máy này còn đăng ký trên máy chủ không (iPhone hay tự mất sau khi cập nhật iOS)
export async function isRegistered() {
  const sub = await currentSubscription()
  if (!sub) return false
  const { data, error } = await supabase.from('viec_push_subs').select('id').eq('endpoint', sub.endpoint)
  if (error) return true                       // lỗi mạng: đừng báo động nhầm
  return (data || []).length > 0
}

export async function sendTest() {
  const sub = await currentSubscription()
  if (!sub) throw new Error('Máy này chưa bật thông báo')
  return call({ action: 'test', endpoint: sub.endpoint })
}

// Tuỳ chọn nhắc của từng người (đi theo người, máy nào cũng như nhau)
export async function getPrefs(who) {
  const { data } = await supabase.from('settings').select('value').eq('key', 'viec_notify_' + who).maybeSingle()
  try { return { ...DEFAULT_PREFS, ...JSON.parse(data?.value || '{}') } } catch { return { ...DEFAULT_PREFS } }
}
export async function savePrefs(who, prefs) {
  const { error } = await supabase.from('settings')
    .upsert([{ key: 'viec_notify_' + who, value: JSON.stringify(prefs) }], { onConflict: 'key' })
  if (error) throw error
}
