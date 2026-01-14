import { useMemo } from 'react'
import { Package, Truck, Wallet, Users } from 'lucide-react'
import { formatMoney, sumBy } from '../lib/helpers'

export default function Dashboard({ orders, onCardClick }) {
  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status !== 'completed')

    // Đơn cần giao (chưa giao đủ)
    const needDelivery = pending.filter(o => {
      const delivered = sumBy(o.deliveries, 'quantity')
      return delivered < o.quantity
    })

    // Tổng công nợ
    let totalDebt = 0
    const debtorSet = new Set()

    pending.forEach(o => {
      // SỬA: Dùng final_amount thay vì quantity * unit_price
      const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)

      // SỬA: Chỉ tính payments có type = 'payment', 'balance_used', hoặc không có type (dữ liệu cũ)
      const paid = o.payments
        ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
        ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

      const debt = totalAmount - paid
      if (debt > 0) {
        totalDebt += debt
        debtorSet.add(o.customer_id)
      }
    })

    return {
      pendingCount: pending.length,
      needDeliveryCount: needDelivery.length,
      totalDebt,
      debtorCount: debtorSet.size
    }
  }, [orders])

  const cards = [
    {
      id: 'pending',
      label: 'Đơn đang xử lý',
      value: stats.pendingCount,
      icon: Package,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconBg: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      id: 'delivery',
      label: 'Cần giao hàng',
      value: stats.needDeliveryCount,
      icon: Truck,
      color: 'amber',
      bgColor: 'bg-amber-50',
      iconBg: 'bg-amber-500',
      textColor: 'text-amber-600'
    },
    {
      id: 'debt',
      label: 'Tổng công nợ',
      value: formatMoney(stats.totalDebt),
      icon: Wallet,
      color: 'red',
      bgColor: 'bg-red-50',
      iconBg: 'bg-red-500',
      textColor: 'text-red-600'
    },
    {
      id: 'debtors',
      label: 'Khách còn nợ',
      value: stats.debtorCount,
      icon: Users,
      color: 'purple',
      bgColor: 'bg-purple-50',
      iconBg: 'bg-purple-500',
      textColor: 'text-purple-600'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <button
          key={card.id}
          onClick={() => onCardClick?.(card.id)}
          className={`${card.bgColor} rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-xl font-bold ${card.textColor}`}>
                {card.value}
              </p>
            </div>
            <div className={`${card.iconBg} p-2 rounded-lg`}>
              <card.icon size={18} className="text-white" />
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
