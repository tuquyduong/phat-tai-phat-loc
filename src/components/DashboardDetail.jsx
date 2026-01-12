import { useMemo } from 'react'
import { Package, Truck, Wallet, Users, ChevronRight } from 'lucide-react'
import Modal from './Modal'
import { formatMoney, formatDate, sumBy } from '../lib/helpers'

export default function DashboardDetail({ type, isOpen, onClose, orders, onSelectOrder }) {
  const data = useMemo(() => {
    if (!type || !orders) return { title: '', items: [], icon: Package }

    const pending = orders.filter(o => o.status !== 'completed')

    switch (type) {
      case 'pending':
        return {
          title: 'Đơn đang xử lý',
          icon: Package,
          color: 'blue',
          items: pending.map(o => ({
            order: o,
            title: o.customer?.name || 'Khách hàng',
            subtitle: `${o.product} • ${o.quantity} ${o.unit}`,
            value: formatMoney(o.quantity * o.unit_price),
            date: formatDate(o.order_date)
          }))
        }

      case 'delivery':
        const needDelivery = pending.filter(o => {
          const delivered = sumBy(o.deliveries, 'quantity')
          return delivered < o.quantity
        })
        return {
          title: 'Cần giao hàng',
          icon: Truck,
          color: 'amber',
          items: needDelivery.map(o => {
            const delivered = sumBy(o.deliveries, 'quantity')
            const remaining = o.quantity - delivered
            return {
              order: o,
              title: o.customer?.name || 'Khách hàng',
              subtitle: o.product,
              value: `Còn ${remaining} ${o.unit}`,
              progress: `${delivered}/${o.quantity}`,
              date: formatDate(o.order_date)
            }
          })
        }

      case 'debt':
        const withDebt = pending.filter(o => {
          const totalAmount = o.quantity * o.unit_price
          const paid = sumBy(o.payments, 'amount')
          return totalAmount - paid > 0
        }).map(o => {
          const totalAmount = o.quantity * o.unit_price
          const paid = sumBy(o.payments, 'amount')
          const debt = totalAmount - paid
          return {
            order: o,
            title: o.customer?.name || 'Khách hàng',
            subtitle: o.product,
            value: formatMoney(debt),
            subvalue: `Đã trả ${formatMoney(paid)}`,
            date: formatDate(o.order_date),
            debt
          }
        }).sort((a, b) => b.debt - a.debt)

        return {
          title: 'Chi tiết công nợ',
          icon: Wallet,
          color: 'red',
          items: withDebt
        }

      case 'debtors':
        // Group by customer
        const debtByCustomer = {}
        pending.forEach(o => {
          const totalAmount = o.quantity * o.unit_price
          const paid = sumBy(o.payments, 'amount')
          const debt = totalAmount - paid
          if (debt > 0) {
            const customerId = o.customer_id
            if (!debtByCustomer[customerId]) {
              debtByCustomer[customerId] = {
                customer: o.customer,
                totalDebt: 0,
                orderCount: 0,
                orders: []
              }
            }
            debtByCustomer[customerId].totalDebt += debt
            debtByCustomer[customerId].orderCount++
            debtByCustomer[customerId].orders.push(o)
          }
        })

        const debtors = Object.values(debtByCustomer)
          .sort((a, b) => b.totalDebt - a.totalDebt)
          .map(d => ({
            order: d.orders[0], // First order to click
            title: d.customer?.name || 'Khách hàng',
            subtitle: `${d.orderCount} đơn còn nợ`,
            value: formatMoney(d.totalDebt),
            orders: d.orders
          }))

        return {
          title: 'Khách còn nợ',
          icon: Users,
          color: 'purple',
          items: debtors
        }

      default:
        return { title: '', items: [], icon: Package, color: 'gray' }
    }
  }, [type, orders])

  const colorClasses = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', iconBg: 'bg-amber-500' },
    red: { bg: 'bg-red-50', text: 'text-red-600', iconBg: 'bg-red-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-500' },
    gray: { bg: 'bg-gray-50', text: 'text-gray-600', iconBg: 'bg-gray-500' }
  }

  const colors = colorClasses[data.color] || colorClasses.gray
  const Icon = data.icon

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={data.title} size="lg">
      <div className="p-4">
        {/* Header summary */}
        <div className={`${colors.bg} rounded-xl p-4 mb-4 flex items-center gap-3`}>
          <div className={`${colors.iconBg} p-3 rounded-xl`}>
            <Icon size={24} className="text-white" />
          </div>
          <div>
            <p className={`text-2xl font-bold ${colors.text}`}>
              {data.items.length}
            </p>
            <p className="text-sm text-gray-500">
              {type === 'debt' ? 'đơn còn nợ' : 
               type === 'debtors' ? 'khách hàng' :
               type === 'delivery' ? 'đơn cần giao' : 'đơn hàng'}
            </p>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {data.items.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Không có dữ liệu</p>
          ) : (
            data.items.map((item, index) => (
              <button
                key={index}
                onClick={() => onSelectOrder(item.order)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{item.title}</p>
                  <p className="text-sm text-gray-500 truncate">{item.subtitle}</p>
                  {item.date && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.date}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <div className="text-right">
                    <p className={`font-semibold ${colors.text}`}>{item.value}</p>
                    {item.subvalue && (
                      <p className="text-xs text-gray-400">{item.subvalue}</p>
                    )}
                    {item.progress && (
                      <p className="text-xs text-gray-400">{item.progress}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}
