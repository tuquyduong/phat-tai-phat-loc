import { useState, useEffect } from 'react'
import { User, Package, Calendar, Plus, X, Trash2, Calculator } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { createMultipleOrders, createCustomer, createProduct, getCustomer } from '../lib/supabase'
import { toInputDate, formatMoney, formatMoneyFull, calcUnitPrice } from '../lib/helpers'

// Template sản phẩm rỗng
const createEmptyItem = () => ({
  id: Date.now(),
  product: '',
  quantity: '',
  unit: 'gói',
  unitPrice: '',
  totalPrice: '',
  priceMode: 'unit', // 'unit' = nhập đơn giá, 'total' = nhập tổng tiền
  selectedProductId: '',
  saveAsTemplate: false
})

export default function CreateOrder({ isOpen, onClose, customers, products, onCreated }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)

  // Customer state
  const [customerId, setCustomerId] = useState('')
  const [customerBalance, setCustomerBalance] = useState(0)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  // Products state - mảng nhiều sản phẩm
  const [orderItems, setOrderItems] = useState([createEmptyItem()])

  // Order date
  const [orderDate, setOrderDate] = useState(toInputDate())

  // Load customer balance khi chọn khách
  useEffect(() => {
    if (customerId) {
      getCustomer(customerId).then(c => {
        setCustomerBalance(c?.balance || 0)
      }).catch(() => setCustomerBalance(0))
    } else {
      setCustomerBalance(0)
    }
  }, [customerId])

  const resetForm = () => {
    setCustomerId('')
    setCustomerBalance(0)
    setNewCustomerName('')
    setNewCustomerPhone('')
    setOrderItems([createEmptyItem()])
    setOrderDate(toInputDate())
    setShowNewCustomer(false)
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

      // Tự động tính toán giá
      if (field === 'totalPrice' && updated.quantity) {
        // Nhập tổng tiền -> tính đơn giá
        updated.unitPrice = calcUnitPrice(Number(value) || 0, Number(updated.quantity) || 1)
      } else if (field === 'unitPrice' && updated.quantity) {
        // Nhập đơn giá -> tính tổng tiền
        updated.totalPrice = (Number(value) || 0) * (Number(updated.quantity) || 0)
      } else if (field === 'quantity') {
        // Đổi số lượng -> tính lại
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

  // Đổi mode giá: đơn giá / tổng tiền
  const togglePriceMode = (id) => {
    setOrderItems(orderItems.map(item => {
      if (item.id !== id) return item
      return { ...item, priceMode: item.priceMode === 'unit' ? 'total' : 'unit' }
    }))
  }

  // Tính tổng tiền tất cả sản phẩm
  const calcGrandTotal = () => {
    return orderItems.reduce((sum, item) => {
      const total = Number(item.totalPrice) || (Number(item.unitPrice) * Number(item.quantity)) || 0
      return sum + total
    }, 0)
  }

  // Đếm sản phẩm hợp lệ
  const validItemsCount = orderItems.filter(item => 
    item.product && item.quantity && (item.unitPrice || item.totalPrice)
  ).length

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate
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
          phone: newCustomerPhone.trim() || null
        })
        finalCustomerId = newCustomer.id
      }

      // Chuẩn bị danh sách đơn hàng
      const ordersToCreate = validItems.map(item => {
        const unitPrice = Number(item.unitPrice) || calcUnitPrice(Number(item.totalPrice), Number(item.quantity))
        return {
          customer_id: finalCustomerId,
          product: item.product.trim(),
          quantity: Number(item.quantity),
          unit: item.unit.trim() || 'gói',
          unit_price: unitPrice,
          order_date: orderDate,
          status: 'pending'
        }
      })

      // Tạo tất cả đơn hàng
      await createMultipleOrders(ordersToCreate)

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
      <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

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
                    {c.name} {c.phone && `(${c.phone})`} {c.balance > 0 && `[Số dư: ${formatMoney(c.balance)}]`}
                  </option>
                ))}
              </select>

              {/* Hiển thị số dư */}
              {customerId && customerBalance > 0 && (
                <div className="p-2 bg-green-50 rounded-lg text-sm text-green-700">
                  💰 Số dư tài khoản: <strong>{formatMoneyFull(customerBalance)}</strong>
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
                  onClick={() => { setShowNewCustomer(false); setNewCustomerName(''); setNewCustomerPhone('') }}
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
                  {products?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.default_qty} {p.unit} × {formatMoney(p.default_price)})
                    </option>
                  ))}
                  <option value="custom">✏️ Nhập sản phẩm khác...</option>
                </select>

                {/* Tên sản phẩm (khi chọn custom) */}
                {item.selectedProductId === 'custom' && (
                  <input
                    type="text"
                    value={item.product}
                    onChange={(e) => updateItem(item.id, 'product', e.target.value)}
                    placeholder="Tên sản phẩm *"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
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
                      <option value="ngày">ngày</option>
                      <option value="gói">gói</option>
                      <option value="hộp">hộp</option>
                      <option value="chai">chai</option>
                      <option value="cái">cái</option>
                      <option value="kg">kg</option>
                      <option value="bộ">bộ</option>
                      <option value="lon">lon</option>
                    </select>
                  </div>
                </div>

                {/* === GIÁ TIỀN VỚI TOGGLE === */}
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
                      placeholder="VD: 950000 (cho 30 gói)"
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-blue-50"
                    />
                  )}

                  {/* Hiển thị tính toán */}
                  {item.quantity && (Number(item.unitPrice) > 0 || Number(item.totalPrice) > 0) && (
                    <div className="text-xs text-gray-500 mt-1 p-2 bg-white rounded">
                      {item.priceMode === 'total' ? (
                        <>
                          Đơn giá: <strong>{formatMoneyFull(item.unitPrice)}</strong>/{item.unit}
                          <br/>
                          ({item.totalPrice} ÷ {item.quantity} = {Number(item.unitPrice).toFixed(2)})
                        </>
                      ) : (
                        <>Thành tiền: <strong>{formatMoneyFull(item.totalPrice)}</strong></>
                      )}
                    </div>
                  )}
                </div>

                {/* Checkbox lưu sản phẩm */}
                {item.selectedProductId === 'custom' && item.product && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.saveAsTemplate}
                      onChange={(e) => updateItem(item.id, 'saveAsTemplate', e.target.checked)}
                      className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    Lưu sản phẩm này cho lần sau
                  </label>
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

        {/* === TỔNG CỘNG === */}
        {calcGrandTotal() > 0 && (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Tổng cộng ({validItemsCount} sản phẩm)</p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatMoneyFull(calcGrandTotal())}
                </p>
              </div>
              {customerBalance > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Số dư khách</p>
                  <p className="text-lg font-semibold text-green-600">{formatMoney(customerBalance)}</p>
                </div>
              )}
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
