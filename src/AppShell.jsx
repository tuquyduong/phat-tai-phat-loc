// ============================================
// APP SHELL - v2 (thêm ToastProvider cho module mới)
// (App.jsx — module Đơn hàng cũ — đã ẩn, không còn được nạp)
// ============================================
import { useState, useEffect, lazy, Suspense } from 'react'
import { ToastProvider } from './components/Toast'
import BottomTabs from './components/shared/BottomTabs'
import Home from './pages/Home'
import Expenses from './pages/Expenses'
import Lab from './pages/Lab'
import Jewelry from './pages/Jewelry'
// Tab Việc chỉ tải khi mở lần đầu — các tab khác không phải gánh thêm
const Viec = lazy(() => import('./pages/Viec'))
import { supabase } from './lib/supabase'
import { mustChangePassword } from './lib/auth'
import Login, { SetNewPassword } from './components/Login'
import { getActiveModules } from './lib/config'

export default function AppShell() {
  // Mở từ thông báo (…/?tab=viec) thì vào thẳng tab Việc
  const [activeModule, setActiveModule] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).get('tab') !== 'viec') return 'home'
      window.history.replaceState(null, '', window.location.pathname)   // bỏ ?tab=viec để tải lại không bị kéo về
      return 'viec'
    } catch { return 'home' }
  })
  // Mở thẳng một món từ lịch: { type: 'product' | 'sale' | 'batch' | 'ingredient', id }
  // Xoá ngay khi tab đích đã mở xong, để lần sau vào tab đó không bị nhảy lại món cũ
  const [deepLink, setDeepLink] = useState(null)
  const openFromCalendar = (tab, target) => { setDeepLink(target ? { ...target, tab } : null); setActiveModule(tab) }
  const doneDeepLink = () => setDeepLink(null)
  // App đang mở sẵn mà bấm thông báo → Service Worker nhắn chuyển tab
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = e => { if (e.data?.type === 'open-tab' && e.data.tab) setActiveModule(e.data.tab) }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])
  // Phiên đăng nhập Supabase: undefined = đang đọc, null = chưa đăng nhập
  const [session, setSession] = useState(undefined)
  const isAuthenticated = !!session && !mustChangePassword(session)
  const [activeModules, setActiveModulesState] = useState(['expenses', 'lab', 'jewelry'])

  useEffect(() => {
    let alive = true
    // Đọc phiên đã lưu trong máy. Phiên quá hạn mà đang mất mạng → Supabase trả lỗi nhưng VẪN giữ phiên trong máy:
    // khi đó đứng chờ, có mạng lại thì đọc lại — không đá ra màn đăng nhập.
    const load = () => supabase.auth.getSession().then(({ data, error }) => {
      if (alive && !(error && !data.session)) setSession(data.session || null)
    })
    load()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (alive) setSession(s || null) })
    window.addEventListener('online', load)
    return () => { alive = false; sub.subscription.unsubscribe(); window.removeEventListener('online', load) }
  }, [])

  // Load module config
  useEffect(() => {
    if (isAuthenticated) {
      getActiveModules()
        .then(m => setActiveModulesState(m))
        .catch(() => {})
    }
  }, [isAuthenticated])

  if (session === undefined) return (                                            // đang đọc phiên / chờ có mạng
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Đang kết nối…</div>
  )
  if (!session) return <Login />
  if (mustChangePassword(session)) return <SetNewPassword email={session.user?.email} />

  // Module khác → cần ToastProvider riêng (vì nằm ngoài App.jsx)
  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return (
          <Home
            onNavigate={setActiveModule}
            activeModules={activeModules}
            email={session.user?.email}
          />
        )
      case 'expenses':
        return <Expenses />
      case 'lab':
        return <Lab openTarget={deepLink?.tab === 'lab' ? deepLink : null} onTargetDone={doneDeepLink} />
      case 'jewelry':
        return <Jewelry openTarget={deepLink?.tab === 'jewelry' ? deepLink : null} onTargetDone={doneDeepLink} />
      case 'viec':
        return (
          <Suspense fallback={<div className="text-center text-gray-400 py-20">Đang mở Việc…</div>}>
            <Viec onNavigate={openFromCalendar} />
          </Suspense>
        )
      default:
        return null
    }
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-16">
        {renderModule()}
        <BottomTabs
          activeTab={activeModule}
          onTabChange={setActiveModule}
          activeModules={activeModules}
        />
      </div>
    </ToastProvider>
  )
}
