import { useState, useMemo } from 'react'
import { 
  TrendingUp, Users, Package, Wallet, Truck, 
  ChevronDown, ChevronRight, BarChart3, Search,
  Download, Calendar, Filter, Phone, Percent
} from 'lucide-react'
import { 
  formatMoney, formatMoneyFull, formatDate, sumBy, groupBy, sortBy,
  getDateRangePreset, toInputDate, arrayToCSV, downloadCSV,
  getPhoneLink, getZaloLink
} from '../lib/helpers'
import ProductDetail from './ProductDetail'

// Preset options cho dropdown
const DATE_PRESETS = [
  { value: 'this_month', label: 'Tháng này' },
  { value: 'last_month', label: 'Tháng trước' },
  { value: 'this_quarter', label: 'Quý này' },
  { value: 'last_quarter', label: 'Quý trước' },
  { value: 'this_year', label: 'Năm nay' },
  { value: 'last_year', label: 'Năm trước' },
  { value: 'all', label: 'Tất cả' },
  { value: 'custom', label: '📅 Tùy chọn...' },
]

// Filter options cho khách hàng
const CUSTOMER_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'has_debt', label: 'Có nợ' },
  { value: 'has_discount', label: 'Có CK' },
  { value: 'has_balance', label: 'Có số dư' },
]

export default function Reports({ orders, customers, onSelectOrder, onSelectCustomer }) {
  const [activeTab, setActiveTab] = useState('overview')

  // Date filter state
  const [datePreset, setDatePreset] = useState('this_month')
  const [customStartDate, setCustomStartDate] = useState(toInputDate())
  const [customEndDate, setCustomEndDate] = useState(toInputDate())
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [customerFilter, setCustomerFilter] = useState('all')

  // Product detail modal
  const [selectedProduct, setSelectedProduct] = useState(null)

  // Expanded customers
  const [expandedCustomers, setExpandedCustomers] = useState({})

  // Tính date range
  const dateRange = useMemo(() => {
    if (datePreset === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        label: `${customStartDate} → ${customEndDate}`
      }
    }
    return getDateRangePreset(datePreset)
  }, [datePreset, customStartDate, customEndDate])

  // Lọc orders theo date range
  const filteredOrders = useMemo(() => {
    return orders?.filter(o => 
      o.order_date >= dateRange.startDate && 
      o.order_date <= dateRange.endDate
    ) || []
  }, [orders, dateRange])

  // ========== THỐNG KÊ TỔNG QUAN ==========
  const overviewStats = useMemo(() => {
    const totalGross = filteredOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0)
    const totalDiscount = filteredOrders.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)
    const totalRevenue = filteredOrders.reduce((sum, o) => {
      return sum + (Number(o.final_amount) || (o.quantity * o.unit_price))
    }, 0)

    const totalPaid = filteredOrders.reduce((sum, o) => {
      const payments = o.payments?.filter(p => p.type === 'payment' || !p.type) || []
      return sum + sumBy(payments, 'amount')
    }, 0)

    const totalDebt = totalRevenue - totalPaid

    const totalDelivered = filteredOrders.reduce((sum, o) => sum + sumBy(o.deliveries || [], 'quantity'), 0)
    const totalQuantity = filteredOrders.reduce((sum, o) => sum + o.quantity, 0)
    const deliveryRate = totalQuantity > 0 ? (totalDelivered / totalQuantity * 100) : 0

    const uniqueCustomers = new Set(filteredOrders.map(o => o.customer_id)).size

    return { 
      totalGross,
      totalDiscount,
      totalRevenue, 
      totalPaid, 
      totalDebt, 
      deliveryRate, 
      uniqueCustomers,
      orderCount: filteredOrders.length
    }
  }, [filteredOrders])

  // ========== THỐNG KÊ KHÁCH HÀNG ==========
  const customerStats = useMemo(() => {
    const grouped = groupBy(filteredOrders, 'customer_id')
    let stats = Object.entries(grouped).map(([customerId, customerOrders]) => {
      const customer = customerOrders[0]?.customer || customers?.find(c => c.id === customerId)
      const totalAmount = customerOrders.reduce((sum, o) => {
        return sum + (Number(o.final_amount) || (o.quantity * o.unit_price))
      }, 0)
      const totalPaid = customerOrders.reduce((sum, o) => {
        const payments = o.payments?.filter(p => p.type === 'payment' || !p.type) || []
        return sum + sumBy(payments, 'amount')
      }, 0)
      const totalDiscount = customerOrders.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)

      return {
        customerId,
        customer,
        orderCount: customerOrders.length,
        totalAmount,
        totalPaid,
        totalDiscount,
        debt: totalAmount - totalPaid,
        orders: customerOrders
      }
    })

    // Áp dụng filter
    if (customerFilter === 'has_debt') {
      stats = stats.filter(s => s.debt > 0)
    } else if (customerFilter === 'has_discount') {
      stats = stats.filter(s => s.customer?.discount_percent > 0)
    } else if (customerFilter === 'has_balance') {
      stats = stats.filter(s => s.customer?.balance > 0)
    }

    // Áp dụng search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      stats = stats.filter(s => 
        s.customer?.name?.toLowerCase().includes(query) ||
        s.customer?.phone?.includes(query)
      )
    }

    return sortBy(stats, 'totalAmount', true)
  }, [filteredOrders, customers, customerFilter, searchQuery])

  // ========== THỐNG KÊ SẢN PHẨM ==========
  const productStats = useMemo(() => {
    const grouped = groupBy(filteredOrders, 'product')
    let stats = Object.entries(grouped).map(([product, productOrders]) => {
      const totalQty = productOrders.reduce((sum, o) => sum + o.quantity, 0)
      const totalAmount = productOrders.reduce((sum, o) => {
        return sum + (Number(o.final_amount) || (o.quantity * o.unit_price))
      }, 0)
      const totalDiscount = productOrders.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)
      const avgPrice = totalQty > 0 ? totalAmount / totalQty : 0
      const unit = productOrders[0]?.unit || 'sp'

      return {
        product,
        orderCount: productOrders.length,
        totalQty,
        totalAmount,
        totalDiscount,
        avgPrice,
        unit
      }
    })

    // Áp dụng search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      stats = stats.filter(s => s.product?.toLowerCase().includes(query))
    }

    return sortBy(stats, 'totalAmount', true)
  }, [filteredOrders, searchQuery])

  // ========== TOP SẢN PHẨM ==========
  const topProducts = useMemo(() => {
    return productStats.slice(0, 5)
  }, [productStats])

  // ========== XUẤT EXCEL ==========
  const exportReport = (type) => {
    let data, columns, filename

    switch (type) {
      case 'overview':
        data = [{
          period: dateRange.label,
          grossRevenue: overviewStats.totalGross,
          discount: overviewStats.totalDiscount,
          netRevenue: overviewStats.totalRevenue,
          collected: overviewStats.totalPaid,
          debt: overviewStats.totalDebt,
          orders: overviewStats.orderCount,
          customers: overviewStats.uniqueCustomers
        }]
        columns = [
          { key: 'period', label: 'Kỳ báo cáo' },
          { key: 'grossRevenue', label: 'Doanh thu gốc' },
          { key: 'discount', label: 'Chiết khấu' },
          { key: 'netRevenue', label: 'Doanh thu thực' },
          { key: 'collected', label: 'Đã thu' },
          { key: 'debt', label: 'Công nợ' },
          { key: 'orders', label: 'Số đơn' },
          { key: 'customers', label: 'Số khách' }
        ]
        filename = `bao-cao-tong-hop-${dateRange.startDate}`
        break

      case 'customers':
        data = customerStats.map((s, i) => ({
          rank: i + 1,
          name: s.customer?.name || 'N/A',
          phone: s.customer?.phone || '',
          discountPercent: s.customer?.discount_percent || 0,
          balance: s.customer?.balance || 0,
          orders: s.orderCount,
          totalAmount: s.totalAmount,
          totalDiscount: s.totalDiscount,
          paid: s.totalPaid,
          debt: s.debt
        }))
        columns = [
          { key: 'rank', label: 'STT' },
          { key: 'name', label: 'Khách hàng' },
          { key: 'phone', label: 'SĐT' },
          { key: 'discountPercent', label: 'CK %' },
          { key: 'balance', label: 'Số dư' },
          { key: 'orders', label: 'Số đơn' },
          { key: 'totalAmount', label: 'Tổng mua' },
          { key: 'totalDiscount', label: 'Đã CK' },
          { key: 'paid', label: 'Đã TT' },
          { key: 'debt', label: 'Còn nợ' }
        ]
        filename = `khach-hang-${dateRange.startDate}`
        break

      case 'products':
        data = productStats.map((s, i) => ({
          rank: i + 1,
          product: s.product,
          orders: s.orderCount,
          quantity: `${s.totalQty} ${s.unit}`,
          revenue: s.totalAmount,
          discount: s.totalDiscount,
          avgPrice: Math.round(s.avgPrice)
        }))
        columns = [
          { key: 'rank', label: 'STT' },
          { key: 'product', label: 'Sản phẩm' },
          { key: 'orders', label: 'Số đơn' },
          { key: 'quantity', label: 'Số lượng' },
          { key: 'revenue', label: 'Doanh thu' },
          { key: 'discount', label: 'Đã CK' },
          { key: 'avgPrice', label: 'Giá TB' }
        ]
        filename = `san-pham-${dateRange.startDate}`
        break

      case 'orders':
        data = filteredOrders.map((o, i) => ({
          rank: i + 1,
          date: o.order_date,
          customer: o.customer?.name || 'N/A',
          product: o.product,
          quantity: `${o.quantity} ${o.unit}`,
          unitPrice: o.unit_price,
          discountPercent: o.discount_percent || 0,
          discountAmount: o.discount_amount || 0,
          finalAmount: o.final_amount || (o.quantity * o.unit_price),
          paid: sumBy(o.payments?.filter(p => p.type === 'payment' || !p.type) || [], 'amount'),
          delivered: sumBy(o.deliveries || [], 'quantity'),
          status: o.status
        }))
        columns = [
          { key: 'rank', label: 'STT' },
          { key: 'date', label: 'Ngày đặt' },
          { key: 'customer', label: 'Khách hàng' },
          { key: 'product', label: 'Sản phẩm' },
          { key: 'quantity', label: 'SL' },
          { key: 'unitPrice', label: 'Đơn giá' },
          { key: 'discountPercent', label: 'CK %' },
          { key: 'discountAmount', label: 'Tiền CK' },
          { key: 'finalAmount', label: 'Thành tiền' },
          { key: 'paid', label: 'Đã TT' },
          { key: 'delivered', label: 'Đã giao' },
          { key: 'status', label: 'Trạng thái' }
        ]
        filename = `don-hang-${dateRange.startDate}`
        break

      default:
        return
    }

    const csv = arrayToCSV(data, columns)
    downloadCSV(csv, filename)
  }

  const toggleCustomerExpand = (customerId) => {
    setExpandedCustomers(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }))
  }

  return (
    <div className="space-y-4">
      {/* Header với Date Filter */}
      <div className="bg-white rounded-xl p-4 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-green-600" />
            <h2 className="font-semibold text-gray-800">Báo cáo</h2>
          </div>

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm font-medium">
              <Download size={16} />
              Xuất
              <ChevronDown size={14} />
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button onClick={() => exportReport('overview')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg">
                📊 Báo cáo tổng hợp
              </button>
              <button onClick={() => exportReport('orders')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">
                📋 Danh sách đơn hàng
              </button>
              <button onClick={() => exportReport('customers')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50">
                👥 Danh sách khách hàng
              </button>
              <button onClick={() => exportReport('products')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg">
                📦 Báo cáo sản phẩm
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value)
              setShowDatePicker(e.target.value === 'custom')
            }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {DATE_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {/* Custom date picker */}
          {showDatePicker && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}

          <span className="text-sm text-gray-500 ml-2">
            {dateRange.label}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { id: 'overview', label: 'Tổng quan', icon: TrendingUp },
            { id: 'customers', label: 'Khách hàng', icon: Users },
            { id: 'products', label: 'Sản phẩm', icon: Package },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-green-600 border-b-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ========== TAB TỔNG QUAN ========== */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Doanh thu</p>
                  <p className="text-2xl font-bold text-green-600">{formatMoney(overviewStats.totalRevenue)}</p>
                  {overviewStats.totalDiscount > 0 && (
                    <p className="text-xs text-gray-500">Đã CK: {formatMoney(overviewStats.totalDiscount)}</p>
                  )}
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Đã thu</p>
                  <p className="text-2xl font-bold text-blue-600">{formatMoney(overviewStats.totalPaid)}</p>
                  <p className="text-xs text-gray-500">{overviewStats.orderCount} đơn hàng</p>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Công nợ</p>
                  <p className={`text-2xl font-bold ${overviewStats.totalDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {formatMoney(overviewStats.totalDebt)}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Khách hàng</p>
                  <p className="text-2xl font-bold text-purple-600">{overviewStats.uniqueCustomers}</p>
                  <p className="text-xs text-gray-500">Giao: {Math.round(overviewStats.deliveryRate)}%</p>
                </div>
              </div>

              {/* Top sản phẩm */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Package size={16} />
                  Top sản phẩm bán chạy
                </h3>
                <div className="space-y-2">
                  {topProducts.map((p, index) => (
                    <button
                      key={p.product}
                      onClick={() => setSelectedProduct(p.product)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-gray-200 text-gray-600' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{p.product}</p>
                          <p className="text-sm text-gray-500">
                            {p.orderCount} đơn • {p.totalQty} {p.unit}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-700">{formatMoney(p.totalAmount)}</p>
                        <p className="text-xs text-gray-500">TB: {formatMoney(p.avgPrice)}/{p.unit}</p>
                      </div>
                    </button>
                  ))}
                  {topProducts.length === 0 && (
                    <p className="text-center text-gray-400 py-4">Chưa có dữ liệu</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========== TAB KHÁCH HÀNG ========== */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên, SĐT..."
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  {CUSTOMER_FILTERS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between text-sm text-gray-500 px-1">
                <span>{customerStats.length} khách hàng</span>
                <span>Tổng: {formatMoney(customerStats.reduce((s, c) => s + c.totalAmount, 0))}</span>
              </div>

              {/* Customer list */}
              <div className="space-y-2">
                {customerStats.map((stat, index) => (
                  <div key={stat.customerId} className="bg-gray-50 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCustomerExpand(stat.customerId)}
                      className="w-full flex items-center justify-between p-3 hover:bg-gray-100 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          stat.customer?.discount_percent > 0 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-800">{stat.customer?.name || 'Khách'}</p>
                            {stat.customer?.discount_percent > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                CK {stat.customer.discount_percent}%
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{stat.orderCount} đơn hàng</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-semibold text-gray-700">{formatMoney(stat.totalAmount)}</p>
                          {stat.debt > 0 && (
                            <p className="text-sm text-red-500">Nợ {formatMoney(stat.debt)}</p>
                          )}
                        </div>
                        {expandedCustomers[stat.customerId] ? (
                          <ChevronDown size={18} className="text-gray-400" />
                        ) : (
                          <ChevronRight size={18} className="text-gray-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {expandedCustomers[stat.customerId] && (
                      <div className="px-3 pb-3 space-y-2">
                        {/* Contact buttons */}
                        {stat.customer?.phone && (
                          <div className="flex gap-2 mb-2">
                            <a
                              href={getPhoneLink(stat.customer.phone)}
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100"
                            >
                              <Phone size={14} />
                              Gọi điện
                            </a>
                            <a
                              href={getZaloLink(stat.customer.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                            >
                              Zalo
                            </a>
                          </div>
                        )}

                        {/* Orders */}
                        {stat.orders.slice(0, 3).map((order) => (
                          <button
                            key={order.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectOrder?.(order)
                            }}
                            className="w-full flex items-center justify-between p-2 bg-white rounded-lg text-sm hover:bg-gray-100"
                          >
                            <span className="text-gray-600">{order.product}</span>
                            <span className="text-gray-800">{formatMoney(order.final_amount || order.quantity * order.unit_price)}</span>
                          </button>
                        ))}

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectCustomer?.(stat.customer)
                          }}
                          className="w-full py-2 text-sm text-green-600 font-medium hover:bg-green-50 rounded-lg"
                        >
                          Xem chi tiết khách hàng →
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {customerStats.length === 0 && (
                  <p className="text-center text-gray-400 py-8">
                    {searchQuery || customerFilter !== 'all' 
                      ? 'Không tìm thấy khách hàng phù hợp' 
                      : 'Chưa có dữ liệu'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ========== TAB SẢN PHẨM ========== */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm sản phẩm..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between text-sm text-gray-500 px-1">
                <span>{productStats.length} sản phẩm</span>
                <span>Tổng: {formatMoney(productStats.reduce((s, p) => s + p.totalAmount, 0))}</span>
              </div>

              {/* Product list */}
              <div className="space-y-2">
                {productStats.map((p, index) => (
                  <button
                    key={p.product}
                    onClick={() => setSelectedProduct(p.product)}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-gray-200 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{p.product}</p>
                        <p className="text-sm text-gray-500">
                          {p.orderCount} đơn • {p.totalQty} {p.unit}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-700">{formatMoney(p.totalAmount)}</p>
                      <p className="text-xs text-gray-500">TB: {formatMoney(p.avgPrice)}/{p.unit}</p>
                    </div>
                  </button>
                ))}

                {productStats.length === 0 && (
                  <p className="text-center text-gray-400 py-8">
                    {searchQuery ? 'Không tìm thấy sản phẩm' : 'Chưa có dữ liệu'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Detail Modal */}
      <ProductDetail
        product={selectedProduct}
        orders={orders}
        dateRange={dateRange}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onSelectCustomer={onSelectCustomer}
      />
    </div>
  )
}
