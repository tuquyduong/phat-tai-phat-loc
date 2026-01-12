import { useState, useEffect } from 'react'
import { 
  Bell, Truck, Wallet, Lock, Save, Trash2, 
  Package, Plus, Users, Edit2, Check
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toast'
import { 
  setPassword, cleanupOldOrders, 
  getProducts, createProduct, updateProduct, deleteProduct,
  getCustomers, deleteCustomer 
} from '../lib/supabase'
import { formatMoney } from '../lib/helpers'

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onSaveSettings,
  onDataChanged
}) {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('alerts')
  const [localSettings, setLocalSettings] = useState(settings)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [cleanupDays, setCleanupDays] = useState(30)

  // Products state
  const [products, setProducts] = useState([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState({ name: '', default_qty: '', unit: 'gói', default_price: '' })

  // Customers state
  const [customers, setCustomers] = useState([])

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadProducts()
      loadCustomers()
    }
  }, [isOpen])

  const loadProducts = async () => {
    try {
      const data = await getProducts()
      setProducts(data || [])
    } catch (err) {
      toast.error('Lỗi tải sản phẩm')
    }
  }

  const loadCustomers = async () => {
    try {
      const data = await getCustomers()
      setCustomers(data || [])
    } catch (err) {
      toast.error('Lỗi tải khách hàng')
    }
  }

  const handleSave = () => {
    onSaveSettings(localSettings)
    toast.success('Đã lưu cài đặt')
    onClose()
  }

  const handleChangePassword = async () => {
    if (!newPassword) {
      toast.error('Vui lòng nhập mật khẩu mới')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp')
      return
    }
    if (newPassword.length < 4) {
      toast.error('Mật khẩu phải có ít nhất 4 ký tự')
      return
    }

    setLoading(true)
    try {
      await setPassword(newPassword)
      toast.success('Đã đổi mật khẩu')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!confirm(`Xóa tất cả đơn đã hoàn thành hơn ${cleanupDays} ngày?`)) return

    setLoading(true)
    try {
      await cleanupOldOrders(cleanupDays)
      toast.success('Đã dọn dẹp đơn cũ')
      onDataChanged?.()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Product handlers
  const handleAddProduct = async () => {
    if (!productForm.name || !productForm.default_qty || !productForm.default_price) {
      toast.warning('Vui lòng điền đầy đủ thông tin')
      return
    }
    setLoading(true)
    try {
      await createProduct({
        name: productForm.name.trim(),
        default_qty: Number(productForm.default_qty),
        unit: productForm.unit || 'gói',
        default_price: Number(productForm.default_price)
      })
      toast.success('Đã thêm sản phẩm')
      setProductForm({ name: '', default_qty: '', unit: 'gói', default_price: '' })
      setShowAddProduct(false)
      loadProducts()
      onDataChanged?.()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProduct = async () => {
    if (!productForm.name || !productForm.default_qty || !productForm.default_price) {
      toast.warning('Vui lòng điền đầy đủ thông tin')
      return
    }
    setLoading(true)
    try {
      await updateProduct(editingProduct.id, {
        name: productForm.name.trim(),
        default_qty: Number(productForm.default_qty),
        unit: productForm.unit || 'gói',
        default_price: Number(productForm.default_price)
      })
      toast.success('Đã cập nhật sản phẩm')
      setEditingProduct(null)
      setProductForm({ name: '', default_qty: '', unit: 'gói', default_price: '' })
      loadProducts()
      onDataChanged?.()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!confirm('Xóa sản phẩm này?')) return
    try {
      await deleteProduct(id)
      toast.success('Đã xóa sản phẩm')
      loadProducts()
      onDataChanged?.()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  const startEditProduct = (product) => {
    setEditingProduct(product)
    setProductForm({
      name: product.name,
      default_qty: product.default_qty.toString(),
      unit: product.unit,
      default_price: product.default_price.toString()
    })
    setShowAddProduct(false)
  }

  // Customer handlers
  const handleDeleteCustomer = async (id, name) => {
    if (!confirm(`Xóa khách hàng "${name}" và TẤT CẢ đơn hàng của họ?`)) return
    try {
      await deleteCustomer(id)
      toast.success('Đã xóa khách hàng')
      loadCustomers()
      onDataChanged?.()
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  const tabs = [
    { id: 'alerts', label: 'Cảnh báo', icon: Bell },
    { id: 'products', label: 'Sản phẩm', icon: Package },
    { id: 'customers', label: 'Khách hàng', icon: Users },
    { id: 'security', label: 'Bảo mật', icon: Lock },
  ]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cài đặt" size="lg">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* Tab: Alerts */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Truck size={16} className="text-blue-500" />
                Nhắc giao hàng sau
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={localSettings.deliveryAlertDays}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    deliveryAlertDays: Number(e.target.value) || 0
                  }))}
                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center"
                  min="1"
                  max="90"
                />
                <span className="text-gray-600">ngày kể từ ngày đặt</span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Wallet size={16} className="text-green-500" />
                Nhắc thanh toán sau
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={localSettings.paymentAlertDays}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    paymentAlertDays: Number(e.target.value) || 0
                  }))}
                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center"
                  min="1"
                  max="90"
                />
                <span className="text-gray-600">ngày kể từ ngày đặt</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Lưu cài đặt
            </button>
          </div>
        )}

        {/* Tab: Products */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Sản phẩm mẫu giúp tạo đơn nhanh hơn
            </p>

            {/* Product list */}
            <div className="space-y-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  {editingProduct?.id === product.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={productForm.name}
                        onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm"
                        placeholder="Tên sản phẩm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={productForm.default_qty}
                          onChange={(e) => setProductForm(prev => ({ ...prev, default_qty: e.target.value }))}
                          className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm"
                          placeholder="SL"
                        />
                        <select
                          value={productForm.unit}
                          onChange={(e) => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                          className="px-2 py-1.5 border border-gray-200 rounded text-sm"
                        >
                          <option value="ngày">ngày</option>
                          <option value="gói">gói</option>
                          <option value="hộp">hộp</option>
                          <option value="chai">chai</option>
                          <option value="cái">cái</option>
                        </select>
                        <input
                          type="number"
                          value={productForm.default_price}
                          onChange={(e) => setProductForm(prev => ({ ...prev, default_price: e.target.value }))}
                          className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm"
                          placeholder="Giá"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateProduct}
                          disabled={loading}
                          className="flex-1 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                        >
                          <Check size={16} className="inline mr-1" />
                          Lưu
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(null)
                            setProductForm({ name: '', default_qty: '', unit: 'gói', default_price: '' })
                          }}
                          className="px-3 py-1.5 bg-gray-200 text-gray-600 text-sm rounded hover:bg-gray-300"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="font-medium text-gray-800">{product.name}</p>
                        <p className="text-sm text-gray-500">
                          {product.default_qty} {product.unit} × {formatMoney(product.default_price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {products.length === 0 && !showAddProduct && (
                <p className="text-center text-gray-400 py-4">Chưa có sản phẩm mẫu</p>
              )}
            </div>

            {/* Add product form */}
            {showAddProduct && (
              <div className="p-3 bg-green-50 rounded-lg space-y-2">
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Tên sản phẩm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={productForm.default_qty}
                    onChange={(e) => setProductForm(prev => ({ ...prev, default_qty: e.target.value }))}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="SL"
                  />
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="ngày">ngày</option>
                    <option value="gói">gói</option>
                    <option value="hộp">hộp</option>
                    <option value="chai">chai</option>
                    <option value="cái">cái</option>
                  </select>
                  <input
                    type="number"
                    value={productForm.default_price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, default_price: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Đơn giá"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddProduct}
                    disabled={loading}
                    className="flex-1 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600"
                  >
                    Thêm
                  </button>
                  <button
                    onClick={() => {
                      setShowAddProduct(false)
                      setProductForm({ name: '', default_qty: '', unit: 'gói', default_price: '' })
                    }}
                    className="px-4 py-2 bg-white text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}

            {!showAddProduct && !editingProduct && (
              <button
                onClick={() => setShowAddProduct(true)}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 text-gray-500 font-medium rounded-xl hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Thêm sản phẩm mẫu
              </button>
            )}
          </div>
        )}

        {/* Tab: Customers */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Xóa khách hàng sẽ xóa luôn tất cả đơn hàng của họ
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-800">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {customers.length === 0 && (
                <p className="text-center text-gray-400 py-4">Chưa có khách hàng</p>
              )}
            </div>
          </div>
        )}

        {/* Tab: Security */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Change password */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Đổi mật khẩu</h3>
              <div className="space-y-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
                <button
                  onClick={handleChangePassword}
                  disabled={loading || !newPassword}
                  className="w-full py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </div>

            {/* Cleanup */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Dọn dẹp dữ liệu</h3>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-700 mb-3">
                  Xóa đơn hàng đã hoàn thành để giảm dung lượng
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm text-gray-600">Xóa đơn hoàn thành hơn</span>
                  <input
                    type="number"
                    value={cleanupDays}
                    onChange={(e) => setCleanupDays(Number(e.target.value) || 30)}
                    className="w-16 px-2 py-1 border border-gray-200 rounded text-center text-sm"
                    min="7"
                  />
                  <span className="text-sm text-gray-600">ngày</span>
                </div>
                <button
                  onClick={handleCleanup}
                  disabled={loading}
                  className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Đang xóa...' : 'Dọn dẹp ngay'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
