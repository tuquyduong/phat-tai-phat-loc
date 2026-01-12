import { useState } from 'react'
import { 
  Bell, AlertTriangle, Clock, Wallet, Truck, 
  ChevronRight, X, Settings 
} from 'lucide-react'
import { formatMoney, formatDate, sumBy } from '../lib/helpers'
import { differenceInDays } from 'date-fns'

export default function Alerts({ orders, settings, onSelectOrder, onOpenSettings }) {
  const [dismissed, setDismissed] = useState(new Set())
  const [expanded, setExpanded] = useState(false)

  // Tính toán alerts dựa trên settings
  const alerts = []
  const today = new Date()

  orders.forEach(order => {
    if (order.status === 'completed') return

    const orderDate = new Date(order.order_date)
    const daysSinceOrder = differenceInDays(today, orderDate)
    
    const totalDelivered = sumBy(order.deliveries, 'quantity')
    const totalPaid = sumBy(order.payments, 'amount')
    const totalAmount = order.quantity * order.unit_price
    
    const remainingDelivery = order.quantity - totalDelivered
    const remainingPayment = totalAmount - totalPaid

    // Alert: Chưa giao hàng quá lâu
    if (remainingDelivery > 0 && daysSinceOrder >= settings.deliveryAlertDays) {
      const alertId = `delivery-${order.id}`
      if (!dismissed.has(alertId)) {
        alerts.push({
          id: alertId,
          type: 'delivery',
          order,
          severity: daysSinceOrder >= settings.deliveryAlertDays * 2 ? 'high' : 'medium',
          message: `Đơn của ${order.customer?.name} đã ${daysSinceOrder} ngày chưa giao đủ`,
          detail: `Còn ${remainingDelivery} ${order.unit || 'cái'} chưa giao`,
          daysOverdue: daysSinceOrder - settings.deliveryAlertDays
        })
      }
    }

    // Alert: Chưa thanh toán quá lâu
    if (remainingPayment > 0 && daysSinceOrder >= settings.paymentAlertDays) {
      const alertId = `payment-${order.id}`
      if (!dismissed.has(alertId)) {
        alerts.push({
          id: alertId,
          type: 'payment',
          order,
          severity: daysSinceOrder >= settings.paymentAlertDays * 2 ? 'high' : 'medium',
          message: `${order.customer?.name} còn nợ ${formatMoney(remainingPayment)}`,
          detail: `Đã ${daysSinceOrder} ngày kể từ ngày đặt`,
          daysOverdue: daysSinceOrder - settings.paymentAlertDays
        })
      }
    }
  })

  // Sắp xếp theo severity và daysOverdue
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'high' ? -1 : 1
    }
    return b.daysOverdue - a.daysOverdue
  })

  const highAlerts = alerts.filter(a => a.severity === 'high')
  const displayAlerts = expanded ? alerts : alerts.slice(0, 3)

  if (alerts.length === 0) return null

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${highAlerts.length > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
            <Bell size={16} className={highAlerts.length > 0 ? 'text-red-600' : 'text-amber-600'} />
          </div>
          <span className="font-semibold text-gray-800">
            Cần xử lý ({alerts.length})
          </span>
          {highAlerts.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full pulse-soft">
              {highAlerts.length} khẩn cấp
            </span>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          title="Cài đặt cảnh báo"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {displayAlerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onSelect={() => onSelectOrder(alert.order)}
            onDismiss={() => setDismissed(prev => new Set([...prev, alert.id]))}
          />
        ))}
      </div>

      {/* Show more/less */}
      {alerts.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {expanded ? 'Thu gọn' : `Xem thêm ${alerts.length - 3} cảnh báo`}
        </button>
      )}
    </div>
  )
}

function AlertItem({ alert, onSelect, onDismiss }) {
  const isHigh = alert.severity === 'high'
  const isDelivery = alert.type === 'delivery'

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        isHigh 
          ? 'bg-red-50 border-red-200' 
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      {/* Icon */}
      <div className={`p-2 rounded-lg ${isHigh ? 'bg-red-100' : 'bg-amber-100'}`}>
        {isDelivery ? (
          <Truck size={18} className={isHigh ? 'text-red-600' : 'text-amber-600'} />
        ) : (
          <Wallet size={18} className={isHigh ? 'text-red-600' : 'text-amber-600'} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${isHigh ? 'text-red-800' : 'text-amber-800'}`}>
          {alert.message}
        </p>
        <p className={`text-xs ${isHigh ? 'text-red-600' : 'text-amber-600'}`}>
          {alert.detail}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSelect}
          className={`p-1.5 rounded-lg transition-colors ${
            isHigh 
              ? 'hover:bg-red-100 text-red-600' 
              : 'hover:bg-amber-100 text-amber-600'
          }`}
          title="Xem chi tiết"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          title="Bỏ qua"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
