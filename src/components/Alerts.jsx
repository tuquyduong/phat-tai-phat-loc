import { useState } from 'react'
import { 
  Bell, AlertTriangle, Clock, Wallet, Truck, 
  ChevronRight, X, Settings, Cake
} from 'lucide-react'
import { formatMoney, formatDate, sumBy, isUpcomingBirthday, daysUntilBirthday, formatBirthday } from '../lib/helpers'
import { differenceInDays } from 'date-fns'

// MỚI: Nhận thêm prop customers để check sinh nhật
export default function Alerts({ orders, customers, settings, onSelectOrder, onSelectCustomer, onOpenSettings }) {
  const [dismissed, setDismissed] = useState(new Set())
  const [expanded, setExpanded] = useState(false)

  // Tính toán alerts dựa trên settings
  const alerts = []
  const today = new Date()

  // === ALERTS TỪ ORDERS ===
  orders.forEach(order => {
    if (order.status === 'completed') return

    const orderDate = new Date(order.order_date)
    const daysSinceOrder = differenceInDays(today, orderDate)

    const totalDelivered = sumBy(order.deliveries, 'quantity')
    // SỬA: Filter đúng type payments
    const totalPaid = order.payments
      ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
      ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    // SỬA: Dùng final_amount
    const totalAmount = Number(order.final_amount) || (order.quantity * order.unit_price)

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

  // === MỚI: ALERTS SINH NHẬT ===
  const birthdayAlertDays = settings.birthdayAlertDays || 7  // Mặc định 7 ngày trước

  customers?.forEach(customer => {
    if (!customer.birthday) return

    if (isUpcomingBirthday(customer.birthday, birthdayAlertDays)) {
      const alertId = `birthday-${customer.id}`
      if (!dismissed.has(alertId)) {
        const daysLeft = daysUntilBirthday(customer.birthday)
        alerts.push({
          id: alertId,
          type: 'birthday',
          customer,
          severity: daysLeft <= 1 ? 'high' : 'low',  // high nếu hôm nay hoặc ngày mai
          message: daysLeft === 0 
            ? `🎂 Hôm nay là sinh nhật ${customer.name}!`
            : `🎂 Sinh nhật ${customer.name} còn ${daysLeft} ngày`,
          detail: `Ngày sinh: ${formatBirthday(customer.birthday)}`,
          daysOverdue: -daysLeft  // Số âm để sort đúng (sắp tới trước)
        })
      }
    }
  })

  // Sắp xếp theo severity và daysOverdue
  alerts.sort((a, b) => {
    // Birthday alerts có severity 'low' nhưng vẫn hiện trước nếu sắp tới
    if (a.type === 'birthday' && b.type !== 'birthday') {
      if (a.severity === 'high') return -1  // Birthday hôm nay lên đầu
      return 1  // Birthday bình thường xuống dưới
    }
    if (b.type === 'birthday' && a.type !== 'birthday') {
      if (b.severity === 'high') return 1
      return -1
    }

    if (a.severity !== b.severity) {
      return a.severity === 'high' ? -1 : 1
    }
    return b.daysOverdue - a.daysOverdue
  })

  const highAlerts = alerts.filter(a => a.severity === 'high')
  const birthdayAlerts = alerts.filter(a => a.type === 'birthday')
  const displayAlerts = expanded ? alerts : alerts.slice(0, 5)

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
          {/* MỚI: Badge sinh nhật */}
          {birthdayAlerts.length > 0 && (
            <span className="px-2 py-0.5 bg-pink-100 text-pink-700 text-xs font-medium rounded-full">
              🎂 {birthdayAlerts.length}
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
            onSelect={() => {
              if (alert.type === 'birthday') {
                onSelectCustomer?.(alert.customer)
              } else {
                onSelectOrder(alert.order)
              }
            }}
            onDismiss={() => setDismissed(prev => new Set([...prev, alert.id]))}
          />
        ))}
      </div>

      {/* Show more/less */}
      {alerts.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
        >
          {expanded ? 'Thu gọn' : `Xem thêm ${alerts.length - 5} cảnh báo`}
        </button>
      )}
    </div>
  )
}

function AlertItem({ alert, onSelect, onDismiss }) {
  const isHigh = alert.severity === 'high'
  const isBirthday = alert.type === 'birthday'
  const isDelivery = alert.type === 'delivery'

  // MỚI: Màu cho từng loại alert
  const getColors = () => {
    if (isBirthday) {
      return {
        bg: isHigh ? 'bg-pink-100 border-pink-300' : 'bg-pink-50 border-pink-200',
        iconBg: isHigh ? 'bg-pink-200' : 'bg-pink-100',
        iconColor: 'text-pink-600',
        textColor: isHigh ? 'text-pink-800' : 'text-pink-700',
        detailColor: 'text-pink-600',
        hoverBg: 'hover:bg-pink-100'
      }
    }
    if (isHigh) {
      return {
        bg: 'bg-red-50 border-red-200',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        textColor: 'text-red-800',
        detailColor: 'text-red-600',
        hoverBg: 'hover:bg-red-100'
      }
    }
    return {
      bg: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-800',
      detailColor: 'text-amber-600',
      hoverBg: 'hover:bg-amber-100'
    }
  }

  const colors = getColors()

  // MỚI: Icon theo loại
  const getIcon = () => {
    if (isBirthday) return <Cake size={18} className={colors.iconColor} />
    if (isDelivery) return <Truck size={18} className={colors.iconColor} />
    return <Wallet size={18} className={colors.iconColor} />
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${colors.bg}`}
    >
      {/* Icon */}
      <div className={`p-2 rounded-lg ${colors.iconBg}`}>
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${colors.textColor}`}>
          {alert.message}
        </p>
        <p className={`text-xs ${colors.detailColor}`}>
          {alert.detail}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSelect}
          className={`p-1.5 rounded-lg transition-colors ${colors.hoverBg} ${colors.iconColor}`}
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
