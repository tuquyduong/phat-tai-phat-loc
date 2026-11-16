// Màn đăng nhập (email + mật khẩu) và màn đặt mật khẩu mới lần đầu
import { useState } from 'react'
import { Lock, Mail, Eye, EyeOff, Package, KeyRound } from 'lucide-react'
import { signIn, signOut, changePassword, lastEmail } from '../lib/auth'

function Shell({ title, sub, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-4">
            <Package className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-gray-500 mt-1">{sub}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function PwInput({ value, onChange, placeholder, autoFocus, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Lock size={20} /></div>
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} autoFocus={autoFocus} placeholder={placeholder}
        className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" />
      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-400">
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}

const errBox = e => e && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{e}</div>
const btnCls = 'w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl disabled:opacity-50 shadow-md active:scale-[.98]'

export default function Login() {
  const [email, setEmail] = useState(lastEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError(''); setLoading(true)
    try { await signIn(email, password) }          // vào app: AppShell tự nhận phiên mới
    catch (err) { setError(err.message); setPassword('') }
    finally { setLoading(false) }
  }

  return (
    <Shell title="Chi Mai" sub="Đăng nhập để tiếp tục">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail size={20} /></div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"
              autoFocus={!email} placeholder="email@gmail.com" inputMode="email"
              className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu</label>
          <PwInput value={password} onChange={setPassword} placeholder="Nhập mật khẩu..." autoFocus={!!email} autoComplete="current-password" />
        </div>
        {errBox(error)}
        <button type="submit" disabled={loading || !email || !password} className={btnCls}>
          {loading ? 'Đang kiểm tra...' : 'Đăng nhập'}
        </button>
      </form>
    </Shell>
  )
}

// Lần đầu vào bằng mật khẩu tạm → đặt mật khẩu riêng rồi mới dùng app
export function SetNewPassword({ email }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('Mật khẩu mới tối thiểu 8 ký tự')
    if (pw !== pw2) return setError('Hai lần nhập không khớp')
    setLoading(true)
    try { await changePassword(pw) }               // xong → AppShell nhận phiên đã cập nhật, vào app
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Shell title="Đặt mật khẩu riêng" sub={email}>
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-card p-6 space-y-4">
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <KeyRound size={18} className="flex-shrink-0 mt-0.5" />
          <span>Bạn đang dùng mật khẩu tạm. Đặt mật khẩu của riêng bạn (tối thiểu 8 ký tự) để tiếp tục.</span>
        </div>
        <PwInput value={pw} onChange={setPw} placeholder="Mật khẩu mới" autoFocus autoComplete="new-password" />
        <PwInput value={pw2} onChange={setPw2} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
        {errBox(error)}
        <button type="submit" disabled={loading || !pw || !pw2} className={btnCls}>
          {loading ? 'Đang lưu...' : 'Lưu và vào app'}
        </button>
        <button type="button" onClick={signOut} className="w-full py-2 text-sm text-gray-500">Đăng xuất</button>
      </form>
    </Shell>
  )
}
