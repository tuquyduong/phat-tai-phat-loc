import { useState, useEffect } from 'react'
import { 
  User, Phone, MapPin, Wallet, Plus, 
  History, Package, ChevronRight, X, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { getCustomerReport, depositToCustomer } from '../lib/supabase'
import { formatMoney, formatMoneyFull, formatDate, sumBy } from '../lib/helpers'

export default function CustomerDetail({ customer, isOpen, onClose, onUpdate, onSelectOrder }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [report, setReport] = useState({ orders: [], transactions: [] })

  // Deposit form
  const [showDeposit, setShowDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositNote, setDepositNote] = useState('')

  useEffect(() => {
    if (isOpen && customer?.id) {
      loadData()
    }
  }, [isOpen, customer?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getCustomerReport(customer.id)
      setReport(data)
    } catch (err) {
      console.error('Error loading customer data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) {
      toast.warning('Vui lòng nhập số tiền hợp lệ')
      return
    }

    setLoading(true)
    try {
      await depositToCustomer(customer.id, Number(depositAmount), depositNote)
      toast.success(`Đã nạp ${formatMoneyFull(depositAmount)} vào tài khoản`)
      setShowDeposit(false)
      setDepositAmount('')
      setDepositNote('')
      loadData()
      onUpdate?.()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!customer) return null

  // Thống kê
  const currentBalance = report?.customer?.balance || customer?.balance || 0
  const totalOrders = report?.orders?.length || 0
  const totalSpent = report?.orders?.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0) || 0
  const totalDeposit = report?.transactions?.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0) || 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customer.name} size="lg">
      <div className="p-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{customer.name}</h3>
              {customer.phone && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone size={14} /> {customer.phone}
                </p>
              )}
            </div>
          </div>

          {/* Balance card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-right">
            <p className="text-xs text-gray-500">Số dư tài khoản</p>
            <p className={`text-xl font-bold ${currentBalance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {formatMoneyFull(currentBalance)}
            </p>
            <button
              onClick={() => setShowDeposit(true)}
              className="mt-1 text-xs text-green-600 hover:text-green-700 flex items-center gap-1 ml-auto"
            >
              <Plus size={12} /> Nạp tiền
            </button>
          </div>
        </div>

        {/* Form nạp tiền */}
        {showDeposit && (
          <div className="mb-4 p-4 bg-green-50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-700">💰 Nạp tiền vào tài khoản</span>
              <button onClick={() => setShowDeposit(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Số tiền (VD: 1000000)"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
              autoFocus
            />
            <input
              type="text"
              value={depositNote}
              onChange={(e) => setDepositNote(e.target.value)}
              placeholder="Ghi chú (VD: Trả trước 1 năm)"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={handleDeposit}
              disabled={loading}
              className="w-full py-2.5 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : `Nạp ${depositAmount ? formatMoneyFull(depositAmount) : '0 đ'}`}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Tổng đơn</p>
            <p className="text-lg font-bold text-blue-600">{totalOrders}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Đã mua</p>
            <p className="text-lg font-bold text-purple-600">{formatMoney(totalSpent)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Đã nạp</p>
            <p className="text-lg font-bold text-amber-600">{formatMoney(totalDeposit)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 mb-4">
          {[
            { id: 'overview', label: 'Tổng quan' },
            { id: 'orders', label: `Đơn hàng (${totalOrders})` },
            { id: 'transactions', label: 'Giao dịch số dư' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">Đang tải...</div>
        ) : activeTab === 'overview' ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Đơn hàng gần đây</h4>
            {report?.orders?.slice(0, 5).map((order) => (
              <button
                key={order.id}
                onClick={() => onSelectOrder?.(order)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 text-left"
              >
                <div>
                  <p className="font-medium text-gray-800">{order.product}</p>
                  <p className="text-sm text-gray-500">
                    {order.quantity} {order.unit} • {formatDate(order.order_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">
                    {formatMoney(order.quantity * order.unit_price)}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </button>
            ))}
            {(!report?.orders || report.orders.length === 0) && (
              <p className="text-center text-gray-400 py-4">Chưa có đơn hàng</p>
            )}
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-2">
            {report?.orders?.map((order) => {
              const delivered = sumBy(order.deliveries, 'quantity')
              const paid = sumBy(order.payments?.filter(p => p.type === 'payment'), 'amount')
              const total = order.quantity * order.unit_price

              return (
                <button
                  key={order.id}
                  onClick={() => onSelectOrder?.(order)}
                  className="w-full p-3 bg-gray-50 rounded-xl hover:bg-gray-100 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{order.product}</p>
                      <p className="text-sm text-gray-500">
                        {order.quantity} {order.unit} × {formatMoney(order.unit_price)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(order.order_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-700">{formatMoney(total)}</p>
                      <p className="text-xs text-gray-500">Giao: {delivered}/{order.quantity}</p>
                      <p className={`text-xs ${paid >= total ? 'text-green-600' : 'text-red-600'}`}>
                        {paid >= total ? '✓ Đã TT' : `Nợ ${formatMoney(total - paid)}`}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
            {(!report?.orders || report.orders.length === 0) && (
              <p className="text-center text-gray-400 py-4">Chưa có đơn hàng</p>
            )}
          </div>
        ) : activeTab === 'transactions' ? (
          <div className="space-y-2">
            {report?.transactions?.filter(t => ['deposit', 'withdraw', 'refund'].includes(t.type)).map((trans) => (
              <div key={trans.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  {trans.type === 'deposit' ? (
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <ArrowDownCircle size={18} className="text-green-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <ArrowUpCircle size={18} className="text-red-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800">
                      {trans.type === 'deposit' ? 'Nạp tiền' : 'Thanh toán từ số dư'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {trans.note || formatDate(trans.payment_date || trans.created_at)}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${trans.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                  {trans.type === 'deposit' ? '+' : '-'}{formatMoney(trans.amount)}
                </span>
              </div>
            ))}
            {(!report?.transactions || report.transactions.filter(t => ['deposit', 'withdraw'].includes(t.type)).length === 0) && (
              <p className="text-center text-gray-400 py-4">Chưa có giao dịch số dư</p>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
