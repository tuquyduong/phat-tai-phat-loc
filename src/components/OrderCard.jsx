import { Package, Truck, Wallet, ChevronRight, Check, Clock } from 'lucide-react'
import { formatMoney, formatDate, sumBy, calcProgress, getProgressColor } from '../lib/helpers'

export default function OrderCard({ order, onClick }) {
  // Tính toán tiến độ
  const totalDelivered = sumBy(order.deliveries, 'quantity')
  const totalPaid = sumBy(order.payments, 'amount')
  const totalAmount = order.quantity * order.unit_price
  
  const deliveryPercent = calcProgress(totalDelivered, order.quantity)
  const paymentPercent = calcProgress(totalPaid, totalAmount)
  
  const isCompleted = order.status === 'completed'
  const remainingDelivery = order.quantity - totalDelivered
  const remainingPayment = totalAmount - totalPaid

  return (
    <div
      onClick={onClick}
      className={`order-card bg-white rounded-2xl shadow-card hover:shadow-card-hover cursor-pointer overflow-hidden ${
        isCompleted ? 'opacity-75' : ''
      }`}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Customer info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-800 truncate">
                {order.customer?.name || 'Khách hàng'}
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                  <Check size={12} />
                  Xong
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              {order.product} • {order.quantity} {order.unit || 'cái'} × {formatMoney(order.unit_price)}
            </p>
          </div>
          
          {/* Total */}
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-gray-800">
              {formatMoney(totalAmount)}
            </p>
            <p className="text-xs text-gray-400">
              {formatDate(order.order_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Progress section */}
      {!isCompleted && (
        <div className="px-4 pb-4 space-y-3">
          {/* Delivery progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Truck size={14} className="text-blue-500" />
                Đã giao
              </span>
              <span className="font-medium">
                {totalDelivered}/{order.quantity}
                {remainingDelivery > 0 && (
                  <span className="text-gray-400 font-normal ml-1">
                    (còn {remainingDelivery})
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`progress-bar h-full rounded-full ${getProgressColor(deliveryPercent)}`}
                style={{ width: `${deliveryPercent}%` }}
              />
            </div>
          </div>

          {/* Payment progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="flex items-center gap-1.5 text-gray-600">
                <Wallet size={14} className="text-green-500" />
                Đã thanh toán
              </span>
              <span className="font-medium">
                {formatMoney(totalPaid)}/{formatMoney(totalAmount)}
                {remainingPayment > 0 && (
                  <span className="text-red-500 font-normal ml-1">
                    (nợ {formatMoney(remainingPayment)})
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`progress-bar h-full rounded-full ${getProgressColor(paymentPercent)}`}
                style={{ width: `${paymentPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer - Click hint */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {isCompleted ? 'Hoàn thành ' + formatDate(order.completed_at) : 'Bấm để xem chi tiết'}
        </span>
        <ChevronRight size={16} className="text-gray-400" />
      </div>
    </div>
  )
}
