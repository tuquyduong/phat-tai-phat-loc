// ============================================
// HOME PAGE - FILE MỚI
// Trang tổng quan multi-module
// Dùng helpers.js có sẵn, KHÔNG tạo hàm format mới
// ============================================
import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatMoney, sumBy } from '../lib/helpers'

export default function Home({ orders = [], customers = [], onNavigate, onRefresh, activeModules }) {
  // Tính toán từ orders hiện có (cùng logic với Dashboard.jsx cũ)
  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status !== 'completed')
    
    let totalDebt = 0
    let debtorCount = 0
    const debtorSet = new Set()
    let needDelivery = 0

    pending.forEach(o => {
      const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)
      const paid = o.payments
        ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
        ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const debt = totalAmount - paid
      if (debt > 0) {
        totalDebt += debt
        debtorSet.add(o.customer_id)
      }
      const delivered = sumBy(o.deliveries, 'quantity')
      if (delivered < o.quantity) needDelivery++
    })

    return {
      pendingCount: pending.length,
      totalDebt,
      debtorCount: debtorSet.size,
      needDelivery,
      totalOrders: orders.length,
      customerCount: customers.length
    }
  }, [orders, customers])

  // Alerts count
  const alertCount = useMemo(() => {
    let count = 0
    const now = new Date()
    orders.forEach(o => {
      if (o.status === 'completed') return
      const days = Math.floor((now - new Date(o.order_date)) / 86400000)
      const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)
      const paid = o.payments
        ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
        ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const delivered = sumBy(o.deliveries, 'quantity')
      if (delivered < o.quantity && days > 3) count++
      if (totalAmount - paid > 0 && days > 7) count++
    })
    return count
  }, [orders])

  // Module cards
  const modules = [
    {
      id: 'orders', icon: '📦', label: 'Đơn hàng',
      value: `${stats.pendingCount} đơn`,
      sub: `Công nợ: ${formatMoney(stats.totalDebt)}`,
      color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200'
    },
    {
      id: 'expenses', icon: '💰', label: 'Thu Chi',
      value: 'Mở →',
      sub: 'Quản lý thu chi',
      color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200'
    },
    {
      id: 'lab', icon: '🧪', label: 'Lab Hub',
      value: 'Mở →',
      sub: 'Công thức & Nguyên liệu',
      color: '#8B5CF6', bg: 'bg-purple-50', border: 'border-purple-200'
    },
    {
      id: 'invest', icon: '📈', label: 'Đầu tư',
      value: 'Mở →',
      sub: 'Danh mục chứng khoán',
      color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200'
    },
  ]

  const visibleModules = modules.filter(m =>
    m.id === 'orders' || activeModules.includes(m.id)
  )

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 pt-4 pb-6"
        style={{ borderRadius: '0 0 1.5rem 1.5rem' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold">Chi Mai</h1>
              <p className="text-green-200 text-xs">Phát Tài Phát Lộc</p>
            </div>
            <button onClick={onRefresh}
              className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Quick stats */}
          <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between text-center">
              <div className="flex-1">
                <p className="text-green-100 text-xs">Đang xử lý</p>
                <p className="text-xl font-bold">{stats.pendingCount}</p>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="flex-1">
                <p className="text-green-100 text-xs">Công nợ</p>
                <p className="text-xl font-bold">{formatMoney(stats.totalDebt)}</p>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="flex-1">
                <p className="text-green-100 text-xs">Cần xử lý</p>
                <p className="text-xl font-bold">{alertCount > 0 ? `🔔 ${alertCount}` : '✅ 0'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="grid grid-cols-2 gap-3">
          {visibleModules.map(m => (
            <button
              key={m.id}
              onClick={() => onNavigate(m.id)}
              className={`${m.bg} ${m.border} border rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
            >
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-xs font-bold" style={{ color: m.color }}>{m.label}</div>
              <div className="text-base font-bold text-gray-800 mt-0.5">{m.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alertCount > 0 && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-red-700 text-sm">🔔 Cần xử lý ({alertCount})</span>
              <button onClick={() => onNavigate('orders')}
                className="text-xs text-red-500 font-bold">Xem đơn hàng →</button>
            </div>
            <div className="space-y-1.5">
              {orders.filter(o => o.status !== 'completed').slice(0, 3).map(o => {
                const days = Math.floor((new Date() - new Date(o.order_date)) / 86400000)
                const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)
                const paid = o.payments
                  ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
                  ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
                const delivered = sumBy(o.deliveries, 'quantity')
                const hasDeliveryAlert = delivered < o.quantity && days > 3
                const hasPaymentAlert = totalAmount - paid > 0 && days > 7
                if (!hasDeliveryAlert && !hasPaymentAlert) return null
                return (
                  <div key={o.id} className="text-xs text-red-600">
                    {hasDeliveryAlert && <p>📦 {o.customer?.name}: chưa giao đủ ({days} ngày)</p>}
                    {hasPaymentAlert && <p>💰 {o.customer?.name}: nợ {formatMoney(totalAmount - paid)}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tip */}
      <div className="max-w-2xl mx-auto px-4 mt-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-700">
            💡 Bấm vào card module để chuyển nhanh. Dùng thanh tab bên dưới để di chuyển giữa các module.
          </p>
        </div>
      </div>
    </div>
  )
}
