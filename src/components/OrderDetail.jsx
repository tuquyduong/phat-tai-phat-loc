import { useState } from 'react'
import {
  Package, Truck, Wallet, Calendar, User, Plus, Trash2,
  Check, X, Clock, AlertCircle, Percent, Tag
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import {
  formatMoney, formatMoneyFull, formatDate, formatDateShort,
  sumBy, calcProgress, getProgressColor, toInputDate
} from '../lib/helpers'
import { addDelivery, addPayment, deleteDelivery, deletePayment, updateOrder, deleteOrder, withdrawFromCustomer } from '../lib/supabase'

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
  const [useBalance, setUseBalance] = useState(false)  // MỚI: Trừ từ số dư

  if (!order) return null

  // SỬA: Calculations - dùng final_amount và filter payments
  const totalDelivered = sumBy(order.deliveries, 'quantity')

  // SỬA: Chỉ tính payments có type = 'payment', 'balance_used', hoặc không có type
  const totalPaid = order.payments
    ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
    ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

  // MỚI: Tính toán chi tiết
  const grossAmount = order.quantity * order.unit_price
  const discountPercent = Number(order.discount_percent) || 0
  const discountAmount = Number(order.discount_amount) || 0
  const discountCash = Number(order.discount_cash) || 0  // MỚI: CK tiền mặt
  const shippingFee = Number(order.shipping_fee) || 0

  // SỬA: Dùng final_amount, fallback về tính toán nếu không có
  const totalAmount = Number(order.final_amount) || (grossAmount - discountAmount - discountCash + shippingFee)

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
      const amount = Number(paymentAmount)
      
      if (useBalance) {
        // Trừ từ số dư khách hàng
        const customerBalance = order.customer?.balance || 0
        if (amount > customerBalance) {
          toast.error(`Số dư không đủ! Chỉ còn ${formatMoney(customerBalance)}`)
          setLoading(false)
          return
        }
        await withdrawFromCustomer(
          order.customer_id,
          amount,
          order.id,
          `Thanh toán đơn hàng từ số dư`
        )
      } else {
        // Thanh toán thường
        await addPayment({
          order_id: order.id,
          amount: amount,
          payment_date: paymentDate
        })
      }

      // Auto complete if all delivered and paid
      const newTotalPaid = totalPaid + amount
      if (totalDelivered >= order.quantity && newTotalPaid >= totalAmount) {
        await updateOrder(order.id, { 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        toast.success('Đã thanh toán đủ và hoàn thành đơn!')
      } else {
        toast.success(`Đã ghi nhận thanh toán ${formatMoney(amount)}${useBalance ? ' (từ số dư)' : ''}`)
      }

      setShowAddPayment(false)
      setPaymentAmount('')
      setUseBalance(false)
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

  // MỚI: Helper để hiển thị label cho payment type
  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'balance_used':
        return '(Trừ số dư)'
      case 'payment':
      default:
        return ''
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết đơn hàng" size="lg">
      <div className="p-5 space-y-5">
        {/* Order info - MỚI: Hiển thị chi tiết hơn */}
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

          {/* MỚI: Chi tiết giá - chỉ hiện khi có chiết khấu hoặc ship */}
          {(discountPercent > 0 || discountCash > 0 || shippingFee > 0) && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tạm tính:</span>
                <span className="text-gray-600">{formatMoneyFull(grossAmount)}</span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Percent size={12} />
                    Chiết khấu {discountPercent}%:
                  </span>
                  <span className="text-green-600">-{formatMoneyFull(discountAmount)}</span>
                </div>
              )}

              {discountCash > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600 flex items-center gap-1">
                    <Tag size={12} />
                    CK tiền mặt:
                  </span>
                  <span className="text-orange-600">-{formatMoneyFull(discountCash)}</span>
                </div>
              )}

              {shippingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Truck size={12} />
                    Phí ship:
                  </span>
                  <span className="text-gray-600">+{formatMoneyFull(shippingFee)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-semibold pt-1">
                <span className="text-gray-700">Thành tiền:</span>
                <span className="text-gray-800">{formatMoneyFull(totalAmount)}</span>
              </div>
            </div>
          )}
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

          {/* Payment list - MỚI: Hiển thị type */}
          {order.payments?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type).length > 0 ? (
            <div className="space-y-2">
              {order.payments
                .filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
                .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">{formatDateShort(p.payment_date)}</span>
                    <span className="font-medium text-green-600">{formatMoney(p.amount)}</span>
                    {/* MỚI: Hiển thị label nếu trừ số dư */}
                    {p.type === 'balance_used' && (
                      <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                        Trừ số dư
                      </span>
                    )}
                  </div>
                  {!isCompleted && p.type !== 'balance_used' && (
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
              {/* MỚI: Checkbox trừ từ số dư */}
              {order.customer?.balance > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useBalance}
                    onChange={(e) => {
                      setUseBalance(e.target.checked)
                      if (e.target.checked) {
                        // Auto fill số tiền = min(số dư, còn nợ)
                        const maxAmount = Math.min(order.customer.balance, remainingPayment)
                        setPaymentAmount(maxAmount.toString())
                      }
                    }}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <Wallet size={16} className="text-blue-500" />
                  <span className="text-gray-700">
                    Trừ từ số dư ({formatMoney(order.customer.balance)})
                  </span>
                </label>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => {
                      const val = e.target.value
                      // Nếu dùng số dư, không cho nhập quá số dư hoặc quá số nợ
                      if (useBalance && val) {
                        const maxAmount = Math.min(order.customer?.balance || 0, remainingPayment)
                        if (Number(val) > maxAmount) {
                          setPaymentAmount(maxAmount.toString())
                          return
                        }
                      }
                      setPaymentAmount(val)
                    }}
                    placeholder="Số tiền"
                    max={useBalance ? Math.min(order.customer?.balance || 0, remainingPayment) : undefined}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    autoFocus
                  />
                  {/* Hiển thị giới hạn khi dùng số dư */}
                  {useBalance && (
                    <p className="text-xs text-blue-600 mt-1">
                      Tối đa: {formatMoney(Math.min(order.customer?.balance || 0, remainingPayment))}
                    </p>
                  )}
                </div>
                {!useBalance && (
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                )}
              </div>
              
              {/* Cảnh báo nếu số dư không đủ trả hết */}
              {useBalance && order.customer?.balance < remainingPayment && (
                <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg">
                  ⚠️ Số dư ({formatMoney(order.customer.balance)}) không đủ trả hết nợ ({formatMoney(remainingPayment)}). 
                  Còn lại {formatMoney(remainingPayment - order.customer.balance)} sau khi trừ.
                </p>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={handleAddPayment}
                  disabled={loading || !paymentAmount}
                  className={`flex-1 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 ${
                    useBalance 
                      ? 'bg-blue-500 hover:bg-blue-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {loading ? 'Đang lưu...' : useBalance ? 'Trừ số dư' : 'Lưu'}
                </button>
                <button
                  onClick={() => {
                    setShowAddPayment(false)
                    setUseBalance(false)
                  }}
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
