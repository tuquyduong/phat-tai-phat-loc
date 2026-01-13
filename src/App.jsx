import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Package, Plus, Search, Filter, X,
  RefreshCw, LogOut, Settings, BarChart3
} from 'lucide-react'
import { getOrders, getCustomers, getProducts, checkPassword } from './lib/supabase'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import OrderCard from './components/OrderCard'
import OrderDetail from './components/OrderDetail'
import CreateOrder from './components/CreateOrder'
import DebtSummary from './components/DebtSummary'
import Alerts from './components/Alerts'
import SettingsModal from './components/SettingsModal'
import DashboardDetail from './components/DashboardDetail'
import CustomerDetail from './components/CustomerDetail'
import Reports from './components/Reports'
import { ToastProvider, useToast } from './components/Toast'
import { DashboardSkeleton, ListSkeleton } from './components/Skeleton'
import PWAInstallPrompt from './components/PWAInstallPrompt'

// Tabs
const TABS = {
  ALL: 'all',
  PENDING: 'pending',
  DEBT: 'debt',
  REPORTS: 'reports'
}

// Default settings
const DEFAULT_SETTINGS = {
  deliveryAlertDays: 3,
  paymentAlertDays: 7,
}

function AppContent() {
  const toast = useToast()

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Data state
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // UI state
  const [activeTab, setActiveTab] = useState(TABS.PENDING)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCreateOrder, setShowCreateOrder] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [dashboardDetail, setDashboardDetail] = useState(null)

  // Settings state
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('order_tracker_settings')
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS
  })

  // Check auth on mount
  useEffect(() => {
    const savedAuth = localStorage.getItem('order_tracker_auth')
    if (savedAuth === 'true') {
      setIsAuthenticated(true)
    }
    setCheckingAuth(false)
  }, [])

  // Load data
  const loadData = useCallback(async (showToast = false) => {
    setLoading(true)
    setError(null)
    try {
      const [ordersData, customersData, productsData] = await Promise.all([
        getOrders(),
        getCustomers(),
        getProducts()
      ])
      setOrders(ordersData || [])
      setCustomers(customersData || [])
      setProducts(productsData || [])
      if (showToast) toast.success('Đã cập nhật dữ liệu')
    } catch (err) {
      console.error('Load error:', err)
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
      toast.error('Lỗi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loadData])

  // Handle login
  const handleLogin = async (password) => {
    try {
      const success = await checkPassword(password)
      if (success) {
        setIsAuthenticated(true)
        localStorage.setItem('order_tracker_auth', 'true')
        return true
      }
      return false
    } catch (err) {
      console.error('Login error:', err)
      setIsAuthenticated(true)
      localStorage.setItem('order_tracker_auth', 'true')
      return true
    }
  }

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('order_tracker_auth')
    setOrders([])
    setCustomers([])
  }

  // Save settings
  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings)
    localStorage.setItem('order_tracker_settings', JSON.stringify(newSettings))
  }

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    if (activeTab === TABS.PENDING) {
      result = result.filter(o => o.status !== 'completed')
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.customer?.name?.toLowerCase().includes(query) ||
        o.product?.toLowerCase().includes(query)
      )
    }

    if (filterCustomer) {
      result = result.filter(o => o.customer_id === filterCustomer)
    }

    if (filterDate) {
      result = result.filter(o => o.order_date === filterDate)
    }

    return result
  }, [orders, activeTab, searchQuery, filterCustomer, filterDate])

  const clearFilters = () => {
    setSearchQuery('')
    setFilterCustomer('')
    setFilterDate('')
  }

  const hasFilters = searchQuery || filterCustomer || filterDate

  const pendingOrders = useMemo(() => 
    orders.filter(o => o.status !== 'completed'),
    [orders]
  )

  // Handle chọn order từ modal khác (Reports, CustomerDetail)
  const handleSelectOrderFromModal = (order) => {
    setSelectedCustomer(null)
    setDashboardDetail(null)
    // Tìm order đầy đủ với payments, deliveries
    const fullOrder = orders.find(o => o.id === order.id) || order
    setSelectedOrder(fullOrder)
  }

  // Handle chọn customer
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer)
  }

  // Show loading
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    )
  }

  // Show login
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                <Package className="text-white" size={20} />
              </div>
              <div>
                <h1 className="font-bold text-gray-800">Chi Mai - Phát Tài Phát Lộc</h1>
                <p className="text-xs text-gray-400">
                  {pendingOrders.length} đơn đang xử lý
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData(true)}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Làm mới"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cài đặt"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Đăng xuất"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => loadData()} className="font-medium hover:underline">
              Thử lại
            </button>
          </div>
        )}

        {/* Alerts - Ẩn khi ở tab Báo cáo */}
        {!loading && pendingOrders.length > 0 && activeTab !== TABS.REPORTS && (
          <Alerts
            orders={pendingOrders}
            settings={settings}
            onSelectOrder={setSelectedOrder}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {/* Dashboard - Ẩn khi ở tab Báo cáo */}
        {activeTab !== TABS.REPORTS && (
          <div className="mb-4">
            {loading ? (
              <DashboardSkeleton />
            ) : (
              <Dashboard 
                orders={orders} 
                onCardClick={setDashboardDetail}
              />
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab(TABS.PENDING)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === TABS.PENDING
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Đang xử lý
          </button>
          <button
            onClick={() => setActiveTab(TABS.DEBT)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === TABS.DEBT
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Công nợ
          </button>
          <button
            onClick={() => setActiveTab(TABS.ALL)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              activeTab === TABS.ALL
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setActiveTab(TABS.REPORTS)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === TABS.REPORTS
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 size={16} />
            Báo cáo
          </button>
        </div>

        {/* Search & Filter - Ẩn khi ở tab Công nợ và Báo cáo */}
        {activeTab !== TABS.DEBT && activeTab !== TABS.REPORTS && (
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm khách hoặc sản phẩm..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  showFilters || hasFilters
                    ? 'bg-green-500 text-white border-green-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <Filter size={20} />
              </button>
            </div>

            {showFilters && (
              <div className="bg-white rounded-xl p-4 shadow-card space-y-3 fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Khách hàng</label>
                    <select
                      value={filterCustomer}
                      onChange={(e) => setFilterCustomer(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      <option value="">Tất cả</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ngày đặt</label>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <ListSkeleton count={3} />
        ) : activeTab === TABS.REPORTS ? (
          <Reports
            orders={orders}
            customers={customers}
            onSelectOrder={handleSelectOrderFromModal}
            onSelectCustomer={handleSelectCustomer}
          />
        ) : activeTab === TABS.DEBT ? (
          <DebtSummary
            orders={orders}
            onSelectOrder={setSelectedOrder}
          />
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500 mb-2">
              {hasFilters ? 'Không tìm thấy đơn hàng phù hợp' : 'Chưa có đơn hàng nào'}
            </p>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="text-green-600 font-medium hover:underline"
              >
                Xóa bộ lọc
              </button>
            ) : (
              <button
                onClick={() => setShowCreateOrder(true)}
                className="text-green-600 font-medium hover:underline"
              >
                Tạo đơn đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowCreateOrder(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center btn-press"
      >
        <Plus size={28} />
      </button>

      {/* Modals */}
      <OrderDetail
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onUpdate={() => {
          loadData()
          setSelectedOrder(null)
        }}
      />

      <CreateOrder
        isOpen={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        customers={customers}
        products={products}
        onCreated={loadData}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onDataChanged={loadData}
      />

      <DashboardDetail
        type={dashboardDetail}
        isOpen={!!dashboardDetail}
        onClose={() => setDashboardDetail(null)}
        orders={orders}
        onSelectOrder={(order) => {
          setDashboardDetail(null)
          setSelectedOrder(order)
        }}
      />

      <CustomerDetail
        customer={selectedCustomer}
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onUpdate={loadData}
        onSelectOrder={handleSelectOrderFromModal}
      />

      <PWAInstallPrompt />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
