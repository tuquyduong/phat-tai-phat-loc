import { useState } from 'react'
import {
  Package, Truck, Wallet, Calendar, User, Plus, Trash2,
  Check, X, Clock, AlertCircle
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import {
  formatMoney, formatMoneyFull, formatDate, formatDateShort,
  sumBy, calcProgress, getProgressColor, toInputDate
} from '../lib/helpers'
import { addDelivery, addPayment, deleteDelivery, deletePayment, updateOrder, deleteOrder } from '../lib/supabase'

export default function OrderDetail({ order, isOpen, onClose, onUpdate }) {
  const toast = useToast()
  const [showAddDelivery, setShowAddDelivery] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Form states
  const [deliveryQty, setDeliveryQty] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(toInputDate())
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(toInputDate())

  if (!order) return null

  // Calculations
  const totalDelivered = sumBy(order.deliveries, 'quantity')
  const totalPaid = sumBy(order.payments, 'amount')
  const totalAmount = order.quantity * order.unit_price
  const remainingDelivery = order.quantity - totalDelivered
  const remainingPayment = totalAmount - totalPaid
  const deliveryPercent = calcProgress(totalDelivered, order.quantity)
  const paymentPercent = calcProgress(totalPaid, totalAmount)
  const isCompleted = order.status === 'completed'

  // Add delivery
  const handleAddDelivery = async () => {
    if (!deliveryQty || Number(deliveryQty) <= 0) return
    setLoading(true)
    try {
      await addDelivery({
        order_id: order.id,
        quantity: Number(deliveryQty),
        delivery_date: deliveryDate
      })
      
      // Auto complete if all delivered and paid
      const newTotalDelivered = totalDelivered + Number(deliveryQty)
      if (newTotalDelivered >= order.quantity && totalPaid >= totalAmount) {
        await updateOrder(order.id, { 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        toast.success('Đã giao đủ và hoàn thành đơn!')
      } else {
        toast.success(`Đã ghi nhận giao ${deliveryQty} ${order.unit || 'cái'}`)
      }
      
      setShowAddDelivery(false)
      setDeliveryQty('')
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Add payment
  const handleAddPayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return
    setLoading(true)
    try {
      await addPayment({
        order_id: order.id,
        amount: Number(paymentAmount),
        payment_date: paymentDate
      })
      
      // Auto complete if all delivered and paid
      const newTotalPaid = totalPaid + Number(paymentAmount)
      if (totalDelivered >= order.quantity && newTotalPaid >= totalAmount) {
        await updateOrder(order.id, { 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        toast.success('Đã thanh toán đủ và hoàn thành đơn!')
      } else {
        toast.success(`Đã ghi nhận thanh toán ${formatMoney(paymentAmount)}`)
      }
      
      setShowAddPayment(false)
      setPaymentAmount('')
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Delete delivery
  const handleDeleteDelivery = async (id) => {
    if (!confirm('Xóa lần giao này?')) return
    try {
      await deleteDelivery(id)
      toast.success('Đã xóa')
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  // Delete payment
  const handleDeletePayment = async (id) => {
    if (!confirm('Xóa lần thanh toán này?')) return
    try {
      await deletePayment(id)
      toast.success('Đã xóa')
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  // Mark as complete
  const handleMarkComplete = async () => {
    try {
      await updateOrder(order.id, { 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      toast.success('Đã đánh dấu hoàn thành')
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  // Reopen order
  const handleReopen = async () => {
    try {
      await updateOrder(order.id, { 
        status: 'pending',
        completed_at: null
      })
      toast.success('Đã mở lại đơn')
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  // Delete order
  const handleDeleteOrder = async () => {
    setLoading(true)
    try {
      await deleteOrder(order.id)
      toast.success('Đã xóa đơn hàng')
      onClose()
      onUpdate()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết đơn hàng" size="lg">
      <div className="p-5 space-y-5">
        {/* Order info */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User size={18} className="text-gray-400" />
                <span className="font-semibold text-gray-800">
                  {order.customer?.name}
                </span>
                {isCompleted && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    Hoàn thành
                  </span>
                )}
              </div>
              <p className="text-gray-600">
                {order.product} • {order.quantity} {order.unit || 'cái'}
              </p>
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                <Calendar size={14} />
                Đặt ngày {formatDate(order.order_date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-gray-800">
                {formatMoneyFull(totalAmount)}
              </p>
              <p className="text-sm text-gray-400">
                {formatMoney(order.unit_price)}/{order.unit || 'cái'}
              </p>
            </div>
          </div>
        </div>

        {/* Delivery section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-700">
              <Truck size={18} className="text-blue-500" />
              Giao hàng
            </h3>
            {!isCompleted && (
              <button
                onClick={() => setShowAddDelivery(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Thêm
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Tiến độ</span>
              <span className="font-medium">
                {totalDelivered}/{order.quantity}
                {remainingDelivery > 0 && (
                  <span className="text-amber-600 ml-1">(còn {remainingDelivery})</span>
                )}
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getProgressColor(deliveryPercent)}`}
                style={{ width: `${deliveryPercent}%` }}
              />
            </div>
          </div>

          {/* Delivery list */}
          {order.deliveries?.length > 0 ? (
            <div className="space-y-2">
              {order.deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{formatDateShort(d.delivery_date)}</span>
                    <span className="font-medium">{d.quantity} {order.unit || 'cái'}</span>
                  </div>
                  {!isCompleted && (
                    <button
                      onClick={() => handleDeleteDelivery(d.id)}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa có lần giao nào</p>
          )}

          {/* Add delivery form */}
          {showAddDelivery && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-3">
              <div className="flex gap-3">
                <input
                  type="number"
                  value={deliveryQty}
                  onChange={(e) => setDeliveryQty(e.target.value)}
                  placeholder="Số lượng"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  autoFocus
                />
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddDelivery}
                  disabled={loading || !deliveryQty}
                  className="flex-1 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button
                  onClick={() => setShowAddDelivery(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-medium bg-white rounded-lg hover:bg-gray-100"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Payment section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="flex items-center gap-2 font-semibold text-gray-700">
              <Wallet size={18} className="text-green-500" />
              Thanh toán
            </h3>
            {!isCompleted && (
              <button
                onClick={() => setShowAddPayment(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Thêm
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Đã trả</span>
              <span className="font-medium">
                {formatMoney(totalPaid)}/{formatMoney(totalAmount)}
                {remainingPayment > 0 && (
                  <span className="text-red-600 ml-1">(nợ {formatMoney(remainingPayment)})</span>
                )}
              </span>
            </div>
            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getProgressColor(paymentPercent)}`}
                style={{ width: `${paymentPercent}%` }}
              />
            </div>
          </div>

          {/* Payment list */}
          {order.payments?.length > 0 ? (
            <div className="space-y-2">
              {order.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{formatDateShort(p.payment_date)}</span>
                    <span className="font-medium text-green-600">{formatMoney(p.amount)}</span>
                  </div>
                  {!isCompleted && (
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Chưa thanh toán</p>
          )}

          {/* Add payment form */}
          {showAddPayment && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg space-y-3">
              <div className="flex gap-3">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Số tiền"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  autoFocus
                />
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddPayment}
                  disabled={loading || !paymentAmount}
                  className="flex-1 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Lưu'}
                </button>
                <button
                  onClick={() => setShowAddPayment(false)}
                  className="px-4 py-2 text-gray-600 text-sm font-medium bg-white rounded-lg hover:bg-gray-100"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-gray-100 space-y-2">
          {!isCompleted ? (
            <button
              onClick={handleMarkComplete}
              className="w-full py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Đánh dấu hoàn thành
            </button>
          ) : (
            <button
              onClick={handleReopen}
              className="w-full py-2.5 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
            >
              <Clock size={18} />
              Mở lại đơn
            </button>
          )}
          
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 text-red-500 font-medium rounded-xl hover:bg-red-50 transition-colors"
            >
              Xóa đơn hàng
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleDeleteOrder}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
              >
                {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
