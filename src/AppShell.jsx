// ============================================
// APP SHELL - v2 (thêm ToastProvider cho module mới)
// App.jsx gốc KHÔNG bị sửa
// ============================================
import { useState, useEffect } from 'react'
import App from './App'
import { ToastProvider } from './components/Toast'
import BottomTabs from './components/shared/BottomTabs'
import Home from './pages/Home'
import Expenses from './pages/Expenses'
import Lab from './pages/Lab'
import Jewelry from './pages/Jewelry'
import { verifySessionDetailed, hasLocalSession } from './lib/supabase'
import { getActiveModules } from './lib/config'

export default function AppShell() {
  const [activeModule, setActiveModule] = useState('home')
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasLocalSession())
  const [activeModules, setActiveModulesState] = useState(['expenses', 'lab', 'jewelry'])



  // Kiểm tra auth từ localStorage
  useEffect(() => {
    let alive = true
    const checkAuth = async () => {
      try {
        const r = await verifySessionDetailed()
        if (!alive) return
        // 'offline' → giữ nguyên trạng thái, không tự logout khi mất mạng
        if (r === 'offline') return
        const valid = r === 'valid'
        if (valid !== isAuthenticated) setIsAuthenticated(valid)
      } catch { /* im lặng, giữ trạng thái hiện tại */ }
    }

    // Đồng bộ nhanh khi login/logout (không phải chờ 60s)
    const onAuthChanged = () => {
      const hasToken = hasLocalSession()
      if (alive && hasToken !== isAuthenticated) setIsAuthenticated(hasToken)
      checkAuth()   // xác thực lại chữ ký ở nền
    }

    checkAuth()
    window.addEventListener('auth-changed', onAuthChanged)
    window.addEventListener('storage', onAuthChanged)   // đồng bộ giữa các tab
    const interval = setInterval(checkAuth, 60000)

    return () => {
      alive = false
      clearInterval(interval)
      window.removeEventListener('auth-changed', onAuthChanged)
      window.removeEventListener('storage', onAuthChanged)
    }
  }, [isAuthenticated])

  // Load module config
  useEffect(() => {
    if (isAuthenticated) {
      getActiveModules()
        .then(m => setActiveModulesState(m))
        .catch(() => {})
    }
  }, [isAuthenticated])

  // Load data cho Home

  // Chưa login → App gốc lo màn đăng nhập
  if (!isAuthenticated) {
    return (
      <>
        <div className={isAuthenticated ? 'pb-16' : ''}>
          <App />
        </div>
        {isAuthenticated && (
          <BottomTabs
            activeTab={activeModule}
            onTabChange={setActiveModule}
            activeModules={activeModules}
          />
        )}
      </>
    )
  }

  // Module khác → cần ToastProvider riêng (vì nằm ngoài App.jsx)
  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return (
          <Home
            onNavigate={setActiveModule}
            activeModules={activeModules}
          />
        )
      case 'expenses':
        return <Expenses />
      case 'lab':
        return <Lab />
      case 'jewelry':
        return <Jewelry />
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
