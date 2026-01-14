import { useState, useEffect } from 'react'
import { 
  User, Phone, Wallet, Plus, X, Edit2, Save,
  Package, ChevronRight, ArrowDownCircle, ArrowUpCircle,
  Percent, MessageCircle, Cake
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { getCustomerReport, depositToCustomer, updateCustomer } from '../lib/supabase'
import { formatMoney, formatMoneyFull, formatDate, sumBy, getPhoneLink, getZaloLink, formatBirthday } from '../lib/helpers'

export default function CustomerDetail({ customer, isOpen, onClose, onUpdate, onSelectOrder }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [report, setReport] = useState({ orders: [], transactions: [] })

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editDiscount, setEditDiscount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editBirthday, setEditBirthday] = useState('')  // MỚI

  // Deposit form
  const [showDeposit, setShowDeposit] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositNote, setDepositNote] = useState('')

  useEffect(() => {
    if (isOpen && customer?.id) {
      loadData()
      setEditName(customer.name || '')
      setEditPhone(customer.phone || '')
      setEditDiscount(customer.discount_percent?.toString() || '0')
      setEditNote(customer.note || '')
      setEditBirthday(customer.birthday || '')  // MỚI
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

  // SỬA: Thêm birthday vào handleSaveEdit
  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.warning('Tên khách hàng không được để trống')
      return
    }

    setLoading(true)
    try {
      await updateCustomer(customer.id, {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        discount_percent: Number(editDiscount) || 0,
        note: editNote.trim() || null,
        birthday: editBirthday || null  // MỚI
      })
      toast.success('Đã cập nhật thông tin khách hàng')
      setIsEditing(false)
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
  const currentDiscount = report?.customer?.discount_percent || customer?.discount_percent || 0
  const currentBirthday = report?.customer?.birthday || customer?.birthday  // MỚI
  const totalOrders = report?.orders?.length || 0

  // Tính doanh thu (sử dụng final_amount nếu có, không thì tính từ quantity * unit_price)
  const totalGross = report?.orders?.reduce((sum, o) => sum + (o.quantity * o.unit_price), 0) || 0
  const totalDiscount = report?.orders?.reduce((sum, o) => sum + (Number(o.discount_amount) || 0), 0) || 0
  const totalSpent = report?.orders?.reduce((sum, o) => {
    return sum + (Number(o.final_amount) || (o.quantity * o.unit_price))
  }, 0) || 0

  // SỬA: Thêm balance_used vào filter payments
  const totalPaid = report?.orders?.reduce((sum, o) => {
    const payments = o.payments?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type) || []
    return sum + sumBy(payments, 'amount')
  }, 0) || 0

  const totalDebt = totalSpent - totalPaid
  const totalDeposit = report?.transactions?.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0) || 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết khách hàng" size="lg">
      <div className="p-4 max-h-[80vh] overflow-y-auto">

        {/* === HEADER === */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
              {customer.name?.charAt(0)?.toUpperCase()}
            </div>

            {!isEditing ? (
              <div>
                <h3 className="font-semibold text-gray-800">{report?.customer?.name || customer.name}</h3>
                {(report?.customer?.phone || customer.phone) && (
                  <div className="flex items-center gap-2 mt-1">
                    <a 
                      href={getPhoneLink(report?.customer?.phone || customer.phone)}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Phone size={14} />
                      {report?.customer?.phone || customer.phone}
                    </a>
                    <a
                      href={getZaloLink(report?.customer?.phone || customer.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      Zalo
                    </a>
                  </div>
                )}
                {currentDiscount > 0 && (
                  <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                    <Percent size={14} />
                    Chiết khấu: {currentDiscount}%
                  </p>
                )}
                {/* MỚI: Hiển thị ngày sinh */}
                {currentBirthday && (
                  <p className="text-sm text-pink-600 flex items-center gap-1 mt-1">
                    <Cake size={14} />
                    Sinh nhật: {formatBirthday(currentBirthday)}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Tên khách hàng"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Số điện thoại"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    placeholder="CK %"
                    min="0"
                    max="100"
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <span className="text-gray-500 text-sm">% chiết khấu</span>
                </div>
                {/* MỚI: Input ngày sinh */}
                <div className="flex items-center gap-2">
                  <Cake size={16} className="text-pink-500" />
                  <input
                    type="date"
                    value={editBirthday}
                    onChange={(e) => setEditBirthday(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Nút Edit/Save */}
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Edit2 size={18} />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={loading}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
              >
                <Save size={18} />
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        {/* === SỐ DƯ === */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Số dư tài khoản</p>
              <p className={`text-2xl font-bold ${currentBalance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {formatMoneyFull(currentBalance)}
              </p>
            </div>
            <button
              onClick={() => setShowDeposit(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <Plus size={16} />
              Nạp tiền
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

        {/* === THỐNG KÊ === */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Tổng đơn</p>
            <p className="text-lg font-bold text-blue-600">{totalOrders}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Đã mua</p>
            <p className="text-lg font-bold text-purple-600">{formatMoney(totalSpent)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Đã nạp</p>
            <p className="text-lg font-bold text-amber-600">{formatMoney(totalDeposit)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Công nợ</p>
            <p className={`text-lg font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {formatMoney(totalDebt)}
            </p>
          </div>
        </div>

        {/* Thống kê chiết khấu */}
        {totalDiscount > 0 && (
          <div className="bg-green-50 rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Tổng chiết khấu đã được hưởng:</span>
            <span className="font-semibold text-green-600">{formatMoneyFull(totalDiscount)}</span>
          </div>
        )}

        {/* === TABS === */}
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

        {/* === TAB CONTENT === */}
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
                    {order.discount_percent > 0 && (
                      <span className="text-green-600"> • CK {order.discount_percent}%</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">
                    {formatMoney(order.final_amount || order.quantity * order.unit_price)}
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
              // SỬA: Thêm balance_used vào filter
              const paid = sumBy(order.payments?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type), 'amount')
              const total = order.final_amount || (order.quantity * order.unit_price)

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
                        {order.discount_percent > 0 && (
                          <span className="text-green-600"> (-{order.discount_percent}%)</span>
                        )}
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
            {/* SỬA: Thêm balance_used vào filter */}
            {report?.transactions?.filter(t => ['deposit', 'withdraw', 'balance_used', 'refund'].includes(t.type)).map((trans) => (
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
            {/* SỬA: Thêm balance_used vào filter check */}
            {(!report?.transactions || report.transactions.filter(t => ['deposit', 'withdraw', 'balance_used'].includes(t.type)).length === 0) && (
              <p className="text-center text-gray-400 py-4">Chưa có giao dịch số dư</p>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
