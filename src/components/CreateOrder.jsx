import { useState, useEffect } from 'react'
import { 
  User, Package, Calendar, Plus, X, Trash2, Calculator, 
  Percent, Wallet, ChevronDown, ChevronUp, Truck, Tag
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { createMultipleOrders, createCustomer, createProduct, getCustomer, withdrawFromCustomer } from '../lib/supabase'
import { toInputDate, formatMoney, formatMoneyFull, calcUnitPrice, calcDiscount, calcFinalAmount } from '../lib/helpers'

// Template sản phẩm rỗng
const createEmptyItem = () => ({
  id: Date.now(),
  product: '',
  quantity: '',
  unit: 'gói',
  unitPrice: '',
  totalPrice: '',
  priceMode: 'unit',
  selectedProductId: '',
  saveAsTemplate: false
})

export default function CreateOrder({ isOpen, onClose, customers, products, units = [], onCreated }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Customer state
  const [customerId, setCustomerId] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerDiscount, setNewCustomerDiscount] = useState('')

  // Products state
  const [orderItems, setOrderItems] = useState([createEmptyItem()])

  // Discount & Payment state
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountCash, setDiscountCash] = useState(0)  // MỚI: Chiết khấu tiền mặt
  const [useBalance, setUseBalance] = useState(false)
  const [balanceToUse, setBalanceToUse] = useState(0)

  // MỚI: Phí ship
  const [shippingFee, setShippingFee] = useState(0)

  // Order date
  const [orderDate, setOrderDate] = useState(toInputDate())

  // Load customer info khi chọn khách
  useEffect(() => {
    if (customerId) {
      getCustomer(customerId).then(c => {
        setSelectedCustomer(c)
        setDiscountPercent(c?.discount_percent || 0)
      }).catch(() => setSelectedCustomer(null))
    } else {
      setSelectedCustomer(null)
      setDiscountPercent(0)
    }
    setUseBalance(false)
    setBalanceToUse(0)
    setDiscountCash(0)  // MỚI: Reset CK tiền mặt
  }, [customerId])

  // Tính toán tổng
  const calcGrossTotal = () => {
    return orderItems.reduce((sum, item) => {
      const total = Number(item.totalPrice) || (Number(item.unitPrice) * Number(item.quantity)) || 0
      return sum + total
    }, 0)
  }

  const grossTotal = calcGrossTotal()
  const discountAmount = calcDiscount(grossTotal, discountPercent)
  const afterDiscountPercent = grossTotal - discountAmount
  // MỚI: Trừ tiếp CK tiền mặt
  const afterDiscountCash = afterDiscountPercent - Number(discountCash || 0)
  // Cộng thêm phí ship
  const afterShipping = afterDiscountCash + Number(shippingFee || 0)
  const actualBalanceToUse = useBalance ? Math.min(balanceToUse, selectedCustomer?.balance || 0, afterShipping) : 0
  const finalTotal = afterShipping - actualBalanceToUse

  const resetForm = () => {
    setCustomerId('')
    setSelectedCustomer(null)
    setNewCustomerName('')
    setNewCustomerPhone('')
    setNewCustomerDiscount('')
    setOrderItems([createEmptyItem()])
    setDiscountPercent(0)
    setDiscountCash(0)  // MỚI: Reset CK tiền mặt
    setUseBalance(false)
    setBalanceToUse(0)
    setShippingFee(0)
    setOrderDate(toInputDate())
    setShowNewCustomer(false)
    setShowAdvanced(false)
  }

  // Thêm sản phẩm mới
  const addItem = () => {
    setOrderItems([...orderItems, createEmptyItem()])
  }

  // Xóa sản phẩm
  const removeItem = (id) => {
    if (orderItems.length === 1) return
    setOrderItems(orderItems.filter(item => item.id !== id))
  }

  // Cập nhật 1 sản phẩm
  const updateItem = (id, field, value) => {
    setOrderItems(orderItems.map(item => {
      if (item.id !== id) return item

      const updated = { ...item, [field]: value }

      if (field === 'totalPrice' && updated.quantity) {
        updated.unitPrice = calcUnitPrice(Number(value) || 0, Number(updated.quantity) || 1)
      } else if (field === 'unitPrice' && updated.quantity) {
        updated.totalPrice = (Number(value) || 0) * (Number(updated.quantity) || 0)
      } else if (field === 'quantity') {
        if (updated.priceMode === 'total' && updated.totalPrice) {
          updated.unitPrice = calcUnitPrice(Number(updated.totalPrice) || 0, Number(value) || 1)
        } else if (updated.unitPrice) {
          updated.totalPrice = (Number(updated.unitPrice) || 0) * (Number(value) || 0)
        }
      }

      return updated
    }))
  }

  // Chọn sản phẩm mẫu
  const selectProduct = (id, productId) => {
    setOrderItems(orderItems.map(item => {
      if (item.id !== id) return item

      if (productId === 'custom') {
        return {
          ...item,
          selectedProductId: 'custom',
          product: '',
          quantity: '',
          unit: 'gói',
          unitPrice: '',
          totalPrice: ''
        }
      } else if (productId) {
        const selected = products?.find(p => p.id === productId)
        if (selected) {
          return {
            ...item,
            selectedProductId: productId,
            product: selected.name,
            quantity: selected.default_qty.toString(),
            unit: selected.unit,
            unitPrice: selected.default_price.toString(),
            totalPrice: (selected.default_qty * selected.default_price).toString()
          }
        }
      }
      return { ...item, selectedProductId: productId }
    }))
  }

  // Đổi mode giá
  const togglePriceMode = (id) => {
    setOrderItems(orderItems.map(item => {
      if (item.id !== id) return item
      return { ...item, priceMode: item.priceMode === 'unit' ? 'total' : 'unit' }
    }))
  }

  // Đếm sản phẩm hợp lệ
  const validItemsCount = orderItems.filter(item => 
    item.product && item.quantity && (item.unitPrice || item.totalPrice)
  ).length

  const handleSubmit = async (e) => {
    e.preventDefault()

    const validItems = orderItems.filter(item => 
      item.product && item.quantity && (item.unitPrice || item.totalPrice)
    )

    if (validItems.length === 0) {
      toast.warning('Vui lòng thêm ít nhất 1 sản phẩm')
      return
    }

    if (!customerId && !newCustomerName) {
      toast.warning('Vui lòng chọn hoặc tạo khách hàng')
      return
    }

    setLoading(true)
    try {
      let finalCustomerId = customerId

      // Tạo khách mới nếu cần
      if (showNewCustomer && newCustomerName) {
        const newCustomer = await createCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          discount_percent: Number(newCustomerDiscount) || 0
        })
        finalCustomerId = newCustomer.id
      }

      // SỬA: Chia đều phí ship và CK tiền mặt cho các đơn hàng (hoặc gán cho đơn đầu tiên)
      const shipPerOrder = validItems.length > 1 ? 0 : Number(shippingFee) || 0
      const shipForFirstOrder = validItems.length > 1 ? Number(shippingFee) || 0 : 0
      // MỚI: Chia CK tiền mặt tương tự
      const discountCashPerOrder = validItems.length > 1 ? 0 : Number(discountCash) || 0
      const discountCashForFirstOrder = validItems.length > 1 ? Number(discountCash) || 0 : 0

      // Chuẩn bị danh sách đơn hàng
      const ordersToCreate = validItems.map((item, index) => {
        const unitPrice = Number(item.unitPrice) || calcUnitPrice(Number(item.totalPrice), Number(item.quantity))
        return {
          customer_id: finalCustomerId,
          product: item.product.trim(),
          quantity: Number(item.quantity),
          unit: item.unit.trim() || 'gói',
          unit_price: unitPrice,
          discount_percent: discountPercent,
          // MỚI: Thêm discount_cash (chỉ đơn đầu tiên có CK tiền mặt nếu nhiều đơn)
          discount_cash: index === 0 ? (discountCashPerOrder || discountCashForFirstOrder) : 0,
          // Thêm shipping_fee (chỉ đơn đầu tiên có ship nếu nhiều đơn)
          shipping_fee: index === 0 ? (shipPerOrder || shipForFirstOrder) : 0,
          order_date: orderDate,
          status: 'pending'
        }
      })

      // Tạo tất cả đơn hàng
      await createMultipleOrders(ordersToCreate)

      // Trừ số dư nếu có
      if (actualBalanceToUse > 0) {
        await withdrawFromCustomer(
          finalCustomerId, 
          actualBalanceToUse, 
          null, 
          `Thanh toán đơn hàng ngày ${orderDate}`
        )
      }

      // Lưu sản phẩm mới nếu được chọn
      for (const item of validItems) {
        if (item.selectedProductId === 'custom' && item.saveAsTemplate && item.product) {
          try {
            await createProduct({
              name: item.product.trim(),
              default_qty: Number(item.quantity) || 1,
              unit: item.unit || 'gói',
              default_price: Number(item.unitPrice) || 0
            })
          } catch (err) {
            console.error('Error saving product template:', err)
          }
        }
      }

      toast.success(`Đã tạo ${ordersToCreate.length} đơn hàng`)
      resetForm()
      onCreated()
      onClose()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose() }} title="Tạo đơn hàng mới" size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">

        {/* === KHÁCH HÀNG === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <User size={16} className="inline mr-1" />
            Khách hàng
          </label>

          {!showNewCustomer ? (
            <div className="space-y-2">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
              >
                <option value="">-- Chọn khách hàng --</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone && `(${c.phone})`} {c.discount_percent > 0 && `[CK ${c.discount_percent}%]`}
                  </option>
                ))}
              </select>

              {/* Hiển thị thông tin khách */}
              {selectedCustomer && (
                <div className="p-3 bg-green-50 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Chiết khấu mặc định:</span>
                    <span className="font-semibold text-green-600">{selectedCustomer.discount_percent || 0}%</span>
                  </div>
                  {selectedCustomer.balance > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Số dư tài khoản:</span>
                      <span className="font-semibold text-blue-600">{formatMoneyFull(selectedCustomer.balance)}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
              >
                <Plus size={16} />
                Thêm khách mới
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-3 bg-green-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-700">Khách hàng mới</span>
                <button
                  type="button"
                  onClick={() => { setShowNewCustomer(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerDiscount('') }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Tên khách hàng *"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
                autoFocus
              />
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Số điện thoại (tùy chọn)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={newCustomerDiscount}
                  onChange={(e) => setNewCustomerDiscount(e.target.value)}
                  placeholder="Chiết khấu %"
                  min="0"
                  max="100"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg"
                />
                <span className="text-gray-500">%</span>
              </div>
            </div>
          )}
        </div>

        {/* === DANH SÁCH SẢN PHẨM === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package size={16} className="inline mr-1" />
            Sản phẩm ({orderItems.length})
          </label>

          <div className="space-y-4">
            {orderItems.map((item, index) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-xl space-y-3 relative">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Sản phẩm {index + 1}</span>
                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Dropdown sản phẩm mẫu */}
                <select
                  value={item.selectedProductId}
                  onChange={(e) => selectProduct(item.id, e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm"
                >
                  <option value="">-- Chọn sản phẩm mẫu --</option>
                  <option value="custom">✏️ Nhập sản phẩm mới (dùng 1 lần)</option>
                  {products?.length > 0 && (
                    <option disabled>───────────────</option>
                  )}
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.default_qty} {p.unit} × {formatMoney(p.default_price)})
                    </option>
                  ))}
                </select>

                {/* Tên sản phẩm (khi chọn custom) */}
                {item.selectedProductId === 'custom' && (
                  <input
                    type="text"
                    value={item.product}
                    onChange={(e) => updateItem(item.id, 'product', e.target.value)}
                    placeholder="Nhập tên sản phẩm *"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
                    autoFocus
                  />
                )}

                {/* Số lượng + Đơn vị */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Số lượng</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      placeholder="VD: 30"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Đơn vị</label>
                    <select
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {(units.length > 0 ? units : ['ngày', 'gói', 'hộp', 'chai', 'cái', 'kg', 'bộ', 'lon']).map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* GIÁ TIỀN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">
                      {item.priceMode === 'unit' ? 'Đơn giá (VNĐ)' : '💰 Tổng tiền trọn gói (VNĐ)'}
                    </label>
                    <button
                      type="button"
                      onClick={() => togglePriceMode(item.id)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Calculator size={12} />
                      {item.priceMode === 'unit' ? 'Nhập tổng tiền' : 'Nhập đơn giá'}
                    </button>
                  </div>

                  {item.priceMode === 'unit' ? (
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                      placeholder="VD: 45000"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  ) : (
                    <input
                      type="number"
                      value={item.totalPrice}
                      onChange={(e) => updateItem(item.id, 'totalPrice', e.target.value)}
                      placeholder="VD: 950000"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-blue-50"
                    />
                  )}

                  {/* Hiển thị tính toán */}
                  {item.quantity && (Number(item.unitPrice) > 0 || Number(item.totalPrice) > 0) && (
                    <div className="text-xs text-gray-500 mt-1 p-2 bg-white rounded">
                      {item.priceMode === 'total' ? (
                        <>Đơn giá: <strong>{formatMoneyFull(item.unitPrice)}</strong>/{item.unit}</>
                      ) : (
                        <>Thành tiền: <strong>{formatMoneyFull(item.totalPrice)}</strong></>
                      )}
                    </div>
                  )}
                </div>

                {/* Checkbox lưu sản phẩm */}
                {item.selectedProductId === 'custom' && item.product && (
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.saveAsTemplate}
                        onChange={(e) => updateItem(item.id, 'saveAsTemplate', e.target.checked)}
                        className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <span className={item.saveAsTemplate ? 'text-green-600 font-medium' : 'text-gray-600'}>
                        {item.saveAsTemplate ? '✓ Lưu vào danh sách sản phẩm' : 'Sản phẩm dùng 1 lần (không lưu)'}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Nút thêm sản phẩm */}
          <button
            type="button"
            onClick={addItem}
            className="w-full mt-3 py-2.5 border-2 border-dashed border-gray-300 text-gray-500 font-medium rounded-xl hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Thêm sản phẩm
          </button>
        </div>

        {/* === NGÀY ĐẶT === */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar size={16} className="inline mr-1" />
            Ngày đặt
          </label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl"
          />
        </div>

        {/* === PHÍ SHIP & CHIẾT KHẤU === */}
        {grossTotal > 0 && (
          <div className="space-y-3">
            {/* MỚI: Hiện luôn phí ship và chiết khấu (không cần toggle) */}
            <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                {/* Chiết khấu */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Chiết khấu đơn hàng</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                      min="0"
                      max="100"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  {discountAmount > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      Giảm: {formatMoneyFull(discountAmount)}
                    </p>
                  )}
                </div>

                {/* MỚI: Phí ship */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <Truck size={14} />
                    Phí ship
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={shippingFee}
                      onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value)))}
                      min="0"
                      placeholder="0"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500">đ</span>
                  </div>
                </div>

                {/* MỚI: Chiết khấu tiền mặt */}
                <div>
                  <label className="block text-sm text-gray-600 mb-2 flex items-center gap-1">
                    <Tag size={14} className="text-orange-500" />
                    CK tiền mặt
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discountCash}
                      onChange={(e) => setDiscountCash(Math.max(0, Number(e.target.value)))}
                      min="0"
                      placeholder="0"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <span className="text-gray-500">đ</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Giảm trực tiếp số tiền</p>
                </div>

                {/* Trừ số dư */}
                {selectedCustomer?.balance > 0 && (
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useBalance}
                        onChange={(e) => {
                          setUseBalance(e.target.checked)
                          if (e.target.checked) {
                            setBalanceToUse(Math.min(selectedCustomer.balance, afterShipping))
                          }
                        }}
                        className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <Wallet size={16} />
                      Trừ từ số dư ({formatMoney(selectedCustomer.balance)})
                    </label>

                    {useBalance && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={balanceToUse}
                          onChange={(e) => setBalanceToUse(Math.min(selectedCustomer.balance, afterShipping, Number(e.target.value)))}
                          min="0"
                          max={Math.min(selectedCustomer.balance, afterShipping)}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <span className="text-gray-500">đ</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
          </div>
        )}

        {/* === TỔNG CỘNG === */}
        {grossTotal > 0 && (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tạm tính ({validItemsCount} SP):</span>
              <span>{formatMoneyFull(grossTotal)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Chiết khấu {discountPercent}%:</span>
                <span>-{formatMoneyFull(discountAmount)}</span>
              </div>
            )}

            {/* MỚI: Hiển thị phí ship */}
            {Number(shippingFee) > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Truck size={12} />
                  Phí ship:
                </span>
                <span>+{formatMoneyFull(shippingFee)}</span>
              </div>
            )}

            {/* MỚI: Hiển thị CK tiền mặt */}
            {Number(discountCash) > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span className="flex items-center gap-1">
                  <Tag size={12} />
                  CK tiền mặt:
                </span>
                <span>-{formatMoneyFull(discountCash)}</span>
              </div>
            )}

            {actualBalanceToUse > 0 && (
              <div className="flex justify-between text-sm text-blue-600">
                <span>Trừ số dư:</span>
                <span>-{formatMoneyFull(actualBalanceToUse)}</span>
              </div>
            )}

            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-700">
                  {actualBalanceToUse > 0 ? 'Còn phải trả:' : 'Thành tiền:'}
                </span>
                <span className="text-xl font-bold text-gray-800">
                  {formatMoneyFull(finalTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* === NÚT TẠO === */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-md"
          >
            {loading ? 'Đang tạo...' : `Tạo ${validItemsCount > 0 ? validItemsCount : ''} đơn hàng`}
          </button>
          <button
            type="button"
            onClick={() => { resetForm(); onClose() }}
            className="px-6 py-3 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200"
          >
            Hủy
          </button>
        </div>
      </form>
    </Modal>
  )
}
