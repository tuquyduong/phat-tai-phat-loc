import { useState } from 'react'
import { ChevronDown, ChevronUp, User, Phone, AlertCircle } from 'lucide-react'
import { formatMoney, formatMoneyFull, sumBy } from '../lib/helpers'

export default function DebtSummary({ orders, onSelectOrder }) {
  const [expanded, setExpanded] = useState(null)

  // Group orders by customer and calculate debts
  const customerDebts = {}
  
  orders.forEach(order => {
    if (order.status === 'completed') return
    
    const customerId = order.customer_id
    const customerName = order.customer?.name || 'Không tên'
    const customerPhone = order.customer?.phone
    
    if (!customerDebts[customerId]) {
      customerDebts[customerId] = {
        id: customerId,
        name: customerName,
        phone: customerPhone,
        orders: [],
        totalAmount: 0,
        totalPaid: 0,
        totalDelivered: 0,
        totalQuantity: 0
      }
    }
    
    const totalAmount = order.quantity * order.unit_price
    const totalPaid = sumBy(order.payments, 'amount')
    const totalDelivered = sumBy(order.deliveries, 'quantity')
    
    customerDebts[customerId].orders.push({
      ...order,
      totalAmount,
      totalPaid,
      totalDelivered,
      debt: totalAmount - totalPaid,
      remainingDelivery: order.quantity - totalDelivered
    })
    
    customerDebts[customerId].totalAmount += totalAmount
    customerDebts[customerId].totalPaid += totalPaid
    customerDebts[customerId].totalDelivered += totalDelivered
    customerDebts[customerId].totalQuantity += order.quantity
  })

  // Convert to array and sort by debt amount
  const customerList = Object.values(customerDebts)
    .filter(c => c.totalAmount - c.totalPaid > 0 || c.totalQuantity - c.totalDelivered > 0)
    .sort((a, b) => (b.totalAmount - b.totalPaid) - (a.totalAmount - a.totalPaid))

  if (customerList.length === 0) {
    return (
      <div className="bg-green-50 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="text-green-600" size={24} />
        </div>
        <p className="text-green-700 font-medium">Không có công nợ!</p>
        <p className="text-green-600 text-sm mt-1">Tất cả đơn hàng đã hoàn thành</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {customerList.map((customer) => {
        const debt = customer.totalAmount - customer.totalPaid
        const remainingDelivery = customer.totalQuantity - customer.totalDelivered
        const isExpanded = expanded === customer.id

        return (
          <div
            key={customer.id}
            className="bg-white rounded-xl shadow-card overflow-hidden"
          >
            {/* Customer header */}
            <button
              onClick={() => setExpanded(isExpanded ? null : customer.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <User size={20} className="text-gray-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800">{customer.name}</p>
                  <p className="text-xs text-gray-400">
                    {customer.orders.length} đơn • Còn giao {remainingDelivery} sp
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">
                    {formatMoney(debt)}
                  </p>
                  <p className="text-xs text-gray-400">công nợ</p>
                </div>
                {isExpanded ? (
                  <ChevronUp size={20} className="text-gray-400" />
                ) : (
                  <ChevronDown size={20} className="text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded order list */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                {customer.orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => onSelectOrder(order)}
                    className="w-full text-left p-3 bg-white rounded-lg hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">
                          {order.product} ({order.quantity} {order.unit})
                        </p>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>Giao: {order.totalDelivered}/{order.quantity}</span>
                          <span>•</span>
                          <span>Trả: {formatMoney(order.totalPaid)}/{formatMoney(order.totalAmount)}</span>
                        </div>
                      </div>
                      {order.debt > 0 && (
                        <span className="text-sm font-semibold text-red-600">
                          -{formatMoney(order.debt)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                
                {/* Customer total */}
                <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tổng cộng:</span>
                  <span className="font-bold text-red-600">{formatMoneyFull(debt)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
