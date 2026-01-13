import { useState, useMemo } from 'react'
import { TrendingUp, Users, Package, Wallet, Truck, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react'
import { formatMoney, formatMoneyFull, formatDate, formatMonthYear, sumBy, groupBy, getPreviousMonth, getEndOfMonth, toInputDate } from '../lib/helpers'

export default function Reports({ orders, customers, onSelectOrder, onSelectCustomer }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [expandedCustomer, setExpandedCustomer] = useState(null)

  // Parse tháng đã chọn
  const [year, month] = selectedMonth.split('-').map(Number)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = toInputDate(getEndOfMonth(new Date(year, month - 1)))

  // Lọc đơn hàng theo tháng
  const filteredOrders = useMemo(() => {
    return orders?.filter(o => o.order_date >= startDate && o.order_date <= endDate) || []
  }, [orders, startDate, endDate])

  // Tính thống kê
  const stats = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0)
    const totalPaid = filteredOrders.reduce((sum, o) => {
      const payments = o.payments?.filter(p => p.type === 'payment' || !p.type) || []
      return sum + sumBy(payments, 'amount')
    }, 0)
    const totalDelivered = filteredOrders.reduce((sum, o) => sum + sumBy(o.deliveries, 'quantity'), 0)
    const totalOrdered = filteredOrders.reduce((sum, o) => sum + o.quantity, 0)
    const uniqueCustomers = new Set(filteredOrders.map(o => o.customer_id)).size

    return {
      totalRevenue,
      totalPaid,
      totalDebt: totalRevenue - totalPaid,
      totalDelivered,
      totalOrdered,
      deliveryRate: totalOrdered > 0 ? (totalDelivered / totalOrdered * 100).toFixed(0) : 0,
      paymentRate: totalRevenue > 0 ? (totalPaid / totalRevenue * 100).toFixed(0) : 0,
      orderCount: filteredOrders.length,
      customerCount: uniqueCustomers
    }
  }, [filteredOrders])

  // Thống kê theo khách hàng
  const customerStats = useMemo(() => {
    const grouped = groupBy(filteredOrders, 'customer_id')
    return Object.entries(grouped).map(([customerId, customerOrders]) => {
      const customer = customers?.find(c => c.id === customerId)
      const totalAmount = customerOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0)
      const totalPaid = customerOrders.reduce((sum, o) => {
        const payments = o.payments?.filter(p => p.type === 'payment' || !p.type) || []
        return sum + sumBy(payments, 'amount')
      }, 0)

      return {
        customerId,
        customer,
        orderCount: customerOrders.length,
        totalAmount,
        totalPaid,
        debt: totalAmount - totalPaid,
        orders: customerOrders
      }
    }).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filteredOrders, customers])

  // Thống kê theo sản phẩm
  const productStats = useMemo(() => {
    const grouped = groupBy(filteredOrders, 'product')
    return Object.entries(grouped).map(([product, productOrders]) => {
      const totalQty = productOrders.reduce((sum, o) => sum + o.quantity, 0)
      const totalRevenue = productOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0)

      return {
        product,
        orderCount: productOrders.length,
        totalQty,
        totalRevenue,
        avgPrice: totalQty > 0 ? totalRevenue / totalQty : 0
      }
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [filteredOrders])

  // Options tháng (12 tháng gần nhất)
  const monthOptions = useMemo(() => {
    const options = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = getPreviousMonth(now, i)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = formatMonthYear(date)
      options.push({ value, label })
    }
    return options
  }, [])

  return (
    <div className="space-y-4">
      {/* Header + Filter */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 size={20} className="text-green-600" />
            Báo cáo
          </h2>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>Tháng {opt.label}</option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'overview', label: 'Tổng quan', icon: TrendingUp },
            { id: 'customers', label: 'Khách hàng', icon: Users },
            { id: 'products', label: 'Sản phẩm', icon: Package },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* === TAB: TỔNG QUAN === */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Cards chính */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-80">Doanh thu</p>
              <p className="text-2xl font-bold">{formatMoney(stats.totalRevenue)}</p>
              <p className="text-xs opacity-70 mt-1">{stats.orderCount} đơn hàng</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
              <p className="text-sm opacity-80">Đã thu</p>
              <p className="text-2xl font-bold">{formatMoney(stats.totalPaid)}</p>
              <p className="text-xs opacity-70 mt-1">{stats.paymentRate}% doanh thu</p>
            </div>
          </div>

          {/* Cards phụ */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-red-500 mb-1">
                <Wallet size={18} />
                <span className="text-sm">Công nợ</span>
              </div>
              <p className="text-xl font-bold text-red-600">{formatMoney(stats.totalDebt)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500 mb-1">
                <Truck size={18} />
                <span className="text-sm">Đã giao</span>
              </div>
              <p className="text-xl font-bold text-amber-600">{stats.deliveryRate}%</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-purple-500 mb-1">
                <Users size={18} />
                <span className="text-sm">Khách</span>
              </div>
              <p className="text-xl font-bold text-purple-600">{stats.customerCount}</p>
            </div>
          </div>

          {/* Top sản phẩm */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-3">🏆 Sản phẩm bán chạy</h3>
            {productStats.length === 0 ? (
              <p className="text-gray-400 text-center py-4">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {productStats.slice(0, 5).map((item, index) => (
                  <div key={item.product} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-gray-700 text-sm">{item.product}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{formatMoney(item.totalRevenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: KHÁCH HÀNG === */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-xl shadow-sm">
          {customerStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Không có dữ liệu trong tháng này</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {customerStats.map((item) => (
                <div key={item.customerId} className="p-4">
                  <button
                    onClick={() => setExpandedCustomer(expandedCustomer === item.customerId ? null : item.customerId)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                        {item.customer?.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-800">{item.customer?.name || 'Không tên'}</p>
                        <p className="text-sm text-gray-500">{item.orderCount} đơn hàng</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">{formatMoney(item.totalAmount)}</p>
                        {item.debt > 0 && <p className="text-xs text-red-600">Nợ {formatMoney(item.debt)}</p>}
                      </div>
                      <ChevronDown size={18} className={`text-gray-400 transition-transform ${expandedCustomer === item.customerId ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Chi tiết đơn hàng */}
                  {expandedCustomer === item.customerId && (
                    <div className="mt-3 ml-13 space-y-2">
                      {item.orders.map(order => (
                        <button
                          key={order.id}
                          onClick={() => onSelectOrder?.(order)}
                          className="w-full flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 text-left text-sm"
                        >
                          <div>
                            <p className="text-gray-700">{order.product}</p>
                            <p className="text-xs text-gray-500">{order.quantity} {order.unit} • {formatDate(order.order_date)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-700">{formatMoney(order.quantity * order.unit_price)}</span>
                            <ChevronRight size={14} className="text-gray-400" />
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => onSelectCustomer?.(item.customer)}
                        className="w-full py-2 text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        Xem chi tiết khách hàng →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === TAB: SẢN PHẨM === */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-xl shadow-sm">
          {productStats.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Không có dữ liệu trong tháng này</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {productStats.map((item, index) => (
                <div key={item.product} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{item.product}</p>
                      <p className="text-sm text-gray-500">{item.orderCount} đơn • {item.totalQty} sản phẩm</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">{formatMoney(item.totalRevenue)}</p>
                    <p className="text-xs text-gray-500">TB: {formatMoneyFull(item.avgPrice)}/sp</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
