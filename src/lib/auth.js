// ============================================
// ĐĂNG NHẬP — Supabase Auth (email + mật khẩu)
// Mật khẩu do Supabase giữ (băm bcrypt), máy chủ tự chặn khi thử sai nhiều lần.
// Phiên đăng nhập lưu trong máy, tự gia hạn — mất mạng vẫn mở được app.
// ============================================
import { supabase } from './supabase'

const LAST_EMAIL = 'chimai_last_email'

export function lastEmail() {
  try { return localStorage.getItem(LAST_EMAIL) || '' } catch { return '' }
}

// Đổi lỗi tiếng Anh của máy chủ sang câu dễ hiểu
function niceError(err) {
  const m = err?.message || ''
  if (/invalid login|invalid credentials/i.test(m)) return new Error('Email hoặc mật khẩu không đúng')
  if (/rate limit|too many/i.test(m))              return new Error('Thử sai quá nhiều lần — đợi vài phút rồi thử lại')
  if (/fetch|network|failed to/i.test(m))          return new Error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')
  if (/should be different/i.test(m))              return new Error('Mật khẩu mới phải khác mật khẩu cũ')
  if (/at least|weak|short/i.test(m))              return new Error('Mật khẩu quá ngắn hoặc quá dễ đoán')
  return new Error(m || 'Có lỗi xảy ra')
}

export async function signIn(email, password) {
  const e = (email || '').trim().toLowerCase()
  const { data, error } = await supabase.auth.signInWithPassword({ email: e, password })
  if (error) throw niceError(error)
  try { localStorage.setItem(LAST_EMAIL, e) } catch {}
  return data.session
}

export async function signOut() {
  await supabase.auth.signOut().catch(() => {})
}

// Lần đầu đăng nhập bằng mật khẩu tạm → bắt đổi
export const mustChangePassword = session => !!session?.user?.user_metadata?.must_change_pw

export async function changePassword(newPw) {
  if (!newPw || newPw.length < 8) throw new Error('Mật khẩu mới tối thiểu 8 ký tự')
  const { error } = await supabase.auth.updateUser({ password: newPw, data: { must_change_pw: false } })
  if (error) throw niceError(error)
}

// Đổi mật khẩu khi đang dùng app: hỏi lại mật khẩu cũ (máy bị người khác cầm cũng không đổi được)
export async function changePasswordChecked(currentPw, newPw) {
  const { data } = await supabase.auth.getSession()
  const email = data?.session?.user?.email
  if (!email) throw new Error('Phiên đăng nhập đã hết — đăng nhập lại')
  const { error } = await supabase.auth.signInWithPassword({ email, password: currentPw })
  if (error) throw /invalid/i.test(error.message) ? new Error('Mật khẩu hiện tại không đúng') : niceError(error)
  await changePassword(newPw)
}
