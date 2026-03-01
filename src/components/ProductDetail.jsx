import { useMemo } from 'react'
import { Package, Users, ShoppingBag, TrendingUp, ChevronRight } from 'lucide-react'
import Modal from './Modal'
import { formatMoney, formatMoneyFull, groupBy } from '../lib/helpers'

export default function ProductDetail({ 
  product, 
  orders, 
  dateRange, 
  isOpen, 
  onClose, 
  onSelectCustomer 
}) {
  // Lọc đơn hàng theo sản phẩm và thời gian
  const filteredOrders = useMemo(() => {
    if (!product || !orders) return []
    return orders.filter(o => 
      o.product === product &&
      o.order_date >= dateRange.startDate &&
      o.order_date <= dateRange.endDate
    )
  }, [product, orders, dateRange])

  // Thống kê theo khách hàng
  const customerStats = useMemo(() => {
    const grouped = groupBy(filteredOrders, 'customer_id')
    return Object.entries(grouped).map(([customerId, customerOrders]) => {
      const customer = customerOrders[0]?.customer
      const totalQty = customerOrders.reduce((sum, o) => sum + o.quantity, 0)
      const totalGross = customerOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0)
      const totalDiscount = customerOrders.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)
      const totalAmount = customerOrders.reduce((sum, o) => {
        return sum + (Number(o.final_amount) || (o.quantity * o.unit_price))
      }, 0)

      return {
        customerId,
        customer,
        orderCount: customerOrders.length,
        totalQty,
        totalGross,
        totalDiscount,
        totalAmount,
        orders: customerOrders
      }
    }).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filteredOrders])

  // Tổng thống kê
  const stats = useMemo(() => {
    const totalQty = filteredOrders.reduce((sum, o) => sum + o.quantity, 0)
    const totalGross = filteredOrders.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0)
    const totalDiscount = filteredOrders.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0)
    const totalAmount = filteredOrders.reduce((sum, o) => {
      return sum + (Number(o.final_amount) || (o.quantity * o.unit_price))
    }, 0)
    const avgPrice = totalQty > 0 ? totalAmount / totalQty : 0

    return {
      orderCount: filteredOrders.length,
      customerCount: customerStats.length,
      totalQty,
      totalGross,
      totalDiscount,
      totalAmount,
      avgPrice
    }
  }, [filteredOrders, customerStats])

  // Lấy đơn vị từ đơn hàng đầu tiên
  const unit = filteredOrders[0]?.unit || 'sp'

  if (!product) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết sản phẩm" size="lg">
      <div className="p-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Package className="text-white" size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-lg">{product}</h3>
            <p className="text-sm text-gray-500">{dateRange.label}</p>
          </div>
        </div>

        {/* Thống kê tổng quan */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <TrendingUp size={16} />
              <span className="text-xs">Doanh thu</span>
            </div>
            <p className="text-xl font-bold text-green-700">{formatMoney(stats.totalAmount)}</p>
            {stats.totalDiscount > 0 && (
              <p className="text-xs text-gray-500">Gốc: {formatMoney(stats.totalGross)}</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <ShoppingBag size={16} />
              <span className="text-xs">Số lượng</span>
            </div>
            <p className="text-xl font-bold text-blue-700">{stats.totalQty} {unit}</p>
            <p className="text-xs text-gray-500">{stats.orderCount} đơn hàng</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Users size={16} />
              <span className="text-xs">Khách hàng</span>
            </div>
            <p className="text-xl font-bold text-purple-700">{stats.customerCount}</p>
            <p className="text-xs text-gray-500">người mua</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Package size={16} />
              <span className="text-xs">Giá TB</span>
            </div>
            <p className="text-xl font-bold text-amber-700">{formatMoney(stats.avgPrice)}</p>
            <p className="text-xs text-gray-500">/ {unit}</p>
          </div>
        </div>

        {/* Chiết khấu */}
        {stats.totalDiscount > 0 && (
          <div className="bg-green-50 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Tổng chiết khấu đã giảm:</span>
            <span className="font-semibold text-green-600">{formatMoneyFull(stats.totalDiscount)}</span>
          </div>
        )}

        {/* Danh sách khách hàng đã mua */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Users size={16} />
            Khách hàng đã mua ({customerStats.length})
          </h4>

          <div className="space-y-2">
            {customerStats.map((stat, index) => (
              <button
                key={stat.customerId}
                onClick={() => onSelectCustomer?.(stat.customer)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Rank badge */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-gray-200 text-gray-600' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                  </div>

                  <div>
                    <p className="font-medium text-gray-800">{stat.customer?.name || 'Khách'}</p>
                    <p className="text-sm text-gray-500">
                      {stat.orderCount} đơn • {stat.totalQty} {unit}
                      {stat.totalDiscount > 0 && (
                        <span className="text-green-600"> • CK -{formatMoney(stat.totalDiscount)}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">{formatMoney(stat.totalAmount)}</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </button>
            ))}

            {customerStats.length === 0 && (
              <p className="text-center text-gray-400 py-8">
                Chưa có khách hàng mua sản phẩm này trong khoảng thời gian đã chọn
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
