// ============================================
// APP SHELL - v2 (thêm ToastProvider cho module mới)
// App.jsx gốc KHÔNG bị sửa
// ============================================
import { useState, useEffect, useCallback } from 'react'
import App from './App'
import { ToastProvider } from './components/Toast'
import BottomTabs from './components/shared/BottomTabs'
import Home from './pages/Home'
import Expenses from './pages/Expenses'
import Lab from './pages/Lab'
import Invest from './pages/Invest'
import { getOrders, getCustomers } from './lib/supabase'
import { getActiveModules } from './lib/config'

export default function AppShell() {
  const [activeModule, setActiveModule] = useState('orders')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [activeModules, setActiveModulesState] = useState(['orders', 'expenses', 'lab', 'invest'])

  // Data cho Home page
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])

  // Kiểm tra auth từ localStorage
  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('order_tracker_auth') === 'true'
      if (auth !== isAuthenticated) setIsAuthenticated(auth)
    }
    checkAuth()
    const interval = setInterval(checkAuth, 500)
    return () => clearInterval(interval)
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
  const loadHomeData = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([getOrders(), getCustomers()])
      setOrders(o || [])
      setCustomers(c || [])
    } catch {}
  }, [])

  useEffect(() => {
    if (isAuthenticated && activeModule === 'home') {
      loadHomeData()
    }
  }, [isAuthenticated, activeModule, loadHomeData])

  // Chưa login hoặc tab Orders → App gốc 100%
  if (!isAuthenticated || activeModule === 'orders') {
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
            orders={orders}
            customers={customers}
            onNavigate={setActiveModule}
            onRefresh={loadHomeData}
            activeModules={activeModules}
          />
        )
      case 'expenses':
        return <Expenses />
      case 'lab':
        return <Lab />
      case 'invest':
        return <Invest />
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
