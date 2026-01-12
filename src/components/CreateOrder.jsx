import { useState } from 'react'
import { User, Package, Hash, DollarSign, Calendar, Plus, X, Save } from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { createOrder, createCustomer, createProduct } from '../lib/supabase'
import { toInputDate, formatMoney } from '../lib/helpers'

export default function CreateOrder({ isOpen, onClose, customers, products, onCreated }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showSaveProduct, setShowSaveProduct] = useState(false)

  // Form state
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('gói')
  const [unitPrice, setUnitPrice] = useState('')
  const [orderDate, setOrderDate] = useState(toInputDate())
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)

  const resetForm = () => {
    setCustomerId('')
    setNewCustomerName('')
    setNewCustomerPhone('')
    setSelectedProductId('')
    setProduct('')
    setQuantity('')
    setUnit('gói')
    setUnitPrice('')
    setOrderDate(toInputDate())
    setShowNewCustomer(false)
    setShowSaveProduct(false)
    setSaveAsTemplate(false)
  }

  // Khi chọn sản phẩm mẫu
  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId)
    setShowSaveProduct(false)
    setSaveAsTemplate(false)

    if (productId === 'custom') {
      setProduct('')
      setQuantity('')
      setUnit('gói')
      setUnitPrice('')
      setShowSaveProduct(true)
    } else if (productId) {
      const selected = products?.find(p => p.id === productId)
      if (selected) {
        setProduct(selected.name)
        setQuantity(selected.default_qty.toString())
        setUnit(selected.unit)
        setUnitPrice(selected.default_price.toString())
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!product || !quantity || !unitPrice) {
      toast.warning('Vui lòng điền đầy đủ thông tin')
      return
    }

    if (!customerId && !newCustomerName) {
      toast.warning('Vui lòng chọn hoặc tạo khách hàng')
      return
    }

    setLoading(true)
    try {
      let finalCustomerId = customerId

      // Create new customer if needed
      if (showNewCustomer && newCustomerName) {
        const newCustomer = await createCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null
        })
        finalCustomerId = newCustomer.id
      }

      // Save product as template if requested
      if (saveAsTemplate && selectedProductId === 'custom' && product) {
        try {
          await createProduct({
            name: product.trim(),
            default_qty: Number(quantity) || 1,
            unit: unit || 'gói',
            default_price: Number(unitPrice) || 0
          })
          toast.success('Đã lưu sản phẩm mẫu')
        } catch (err) {
          console.error('Error saving product template:', err)
        }
      }

      // Create order
      await createOrder({
        customer_id: finalCustomerId,
        product: product.trim(),
        quantity: Number(quantity),
        unit: unit.trim() || 'gói',
        unit_price: Number(unitPrice),
        order_date: orderDate,
        status: 'pending'
      })

      toast.success('Đã tạo đơn hàng mới')
      resetForm()
      onCreated()
      onClose()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tạo đơn hàng mới" size="lg">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Customer selection */}
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
                    {c.name} {c.phone && `(${c.phone})`}
                  </option>
                ))}
              </select>
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
                  onClick={() => {
                    setShowNewCustomer(false)
                    setNewCustomerName('')
                    setNewCustomerPhone('')
                  }}
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                autoFocus
              />
              <input
                type="tel"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Số điện thoại (tùy chọn)"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          )}
        </div>

        {/* Product selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Package size={16} className="inline mr-1" />
            Sản phẩm
          </label>

          {/* Dropdown chọn sản phẩm mẫu */}
          <select
            value={selectedProductId}
            onChange={(e) => handleSelectProduct(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white mb-3"
          >
            <option value="">-- Chọn sản phẩm --</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.default_qty} {p.unit} × {formatMoney(p.default_price)})
              </option>
            ))}
            <option value="custom">✏️ Nhập sản phẩm khác...</option>
          </select>

          {/* Input tên sản phẩm khi chọn custom */}
          {selectedProductId === 'custom' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-xl">
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="Tên sản phẩm *"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                autoFocus
              />

              {/* Checkbox lưu sản phẩm */}
              {product && quantity && unitPrice && (
                <label className="flex items-center gap-2 text-sm text-blue-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                  />
                  <Save size={14} />
                  Lưu sản phẩm này cho lần sau
                </label>
              )}
            </div>
          )}
        </div>

        {/* Quantity & Unit */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Hash size={16} className="inline mr-1" />
              Số lượng
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="VD: 30"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Đơn vị
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
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

        {/* Unit price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign size={16} className="inline mr-1" />
            Đơn giá (VNĐ)
          </label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="VD: 50000"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        {/* Order date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar size={16} className="inline mr-1" />
            Ngày đặt
          </label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        {/* Preview */}
        {product && quantity && unitPrice && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500 mb-1">Tổng đơn hàng:</p>
            <p className="text-2xl font-bold text-gray-800">
              {(Number(quantity) * Number(unitPrice)).toLocaleString('vi-VN')} đ
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {quantity} {unit} × {Number(unitPrice).toLocaleString('vi-VN')} đ
            </p>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 btn-press shadow-md"
          >
            {loading ? 'Đang tạo...' : 'Tạo đơn hàng'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-3 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Hủy
          </button>
        </div>
      </form>
    </Modal>
  )
}
