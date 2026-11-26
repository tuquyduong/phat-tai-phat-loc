import { createClient } from '@supabase/supabase-js'
import { getLocalDateString } from './helpers'
import { offlineFetch, setTokenGetter } from './offline'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: offlineFetch } })

// Mã đăng nhập lúc mở app: sau một đêm mã đã hết hạn, Supabase phải gia hạn qua mạng (0,5–2 giây) mới cho vào.
// Lúc mới mở (10 giây đầu) hoặc mất mạng: dùng NGAY phiên đã lưu trong máy → vào app tức thì;
// việc gia hạn vẫn chạy ngầm, xong thì mọi yêu cầu sau dùng mã mới. Yêu cầu nào lỡ gửi bằng mã cũ
// bị máy chủ từ chối (401) sẽ được offline.js lấy mã mới và gửi lại 1 lần.
// Ngoài 10 giây đầu: chờ gia hạn tối đa 2,5 giây, quá thì dùng tạm phiên trong máy.
{
  const auth = supabase.auth
  const realGetSession = auth.getSession.bind(auth)
  const T0 = Date.now()
  let fresh = false                                    // đã gia hạn xong ít nhất 1 lần trong lần mở app này
  const stored = () => {
    try {
      const raw = localStorage.getItem(auth.storageKey)
      const s = raw ? JSON.parse(raw) : null
      return s?.access_token ? (s.currentSession || s) : null
    } catch { return null }
  }
  auth.getSession = () => {
    const real = realGetSession()
    real.then(r => { if (r?.data?.session) fresh = true }, () => {})
    const s = stored()
    if (!s) return real
    if (navigator.onLine === false || (!fresh && Date.now() - T0 < 10000)) {
      return Promise.resolve({ data: { session: s }, error: null })
    }
    const fallback = new Promise(res => setTimeout(() => res({ data: { session: s }, error: null }), 2500))
    return Promise.race([real.then(r => (r?.data?.session || !r?.error) ? r : fallback), fallback])
  }
  setTokenGetter(() => realGetSession().then(r => r?.data?.session?.access_token || null))
}

// ============================================
// CUSTOMERS
// ============================================

export async function getCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getCustomer(id) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCustomer(customer) {
  const { data, error } = await supabase
    .from('customers')
    .insert([{ 
      ...customer, 
      balance: 0,
      discount_percent: customer.discount_percent || 0
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCustomer(id, updates) {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCustomer(id) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// Cập nhật chiết khấu khách hàng
export async function updateCustomerDiscount(id, discountPercent) {
  const { data, error } = await supabase
    .from('customers')
    .update({ discount_percent: discountPercent })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// CUSTOMER BALANCE (Số dư khách hàng)
// ============================================

// Nạp tiền vào tài khoản khách
export async function depositToCustomer(customerId, amount, note = '') {
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      customer_id: customerId,
      order_id: null,
      amount: amount,
      type: 'deposit',
      note: note || 'Nạp tiền vào tài khoản',
      payment_date: getLocalDateString()
    }])
    .select()
    .single()
  if (error) throw error

  await recalcCustomerBalance(customerId)
  return data
}

// Rút tiền từ tài khoản khách (thanh toán từ số dư)
// SỬA: type = 'balance_used' thay vì 'withdraw' để phân biệt rõ
export async function withdrawFromCustomer(customerId, amount, orderId = null, note = '') {
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      customer_id: customerId,
      order_id: orderId,
      amount: amount,
      type: 'balance_used',  // SỬA: Đổi từ 'withdraw' thành 'balance_used'
      note: note || 'Thanh toán từ số dư',
      payment_date: getLocalDateString()
    }])
    .select()
    .single()
  if (error) throw error

  await recalcCustomerBalance(customerId)
  return data
}

// Tính lại số dư khách hàng
// SỬA: Cập nhật để tính cả 'balance_used'
export async function recalcCustomerBalance(customerId) {
  const { data: deposits } = await supabase
    .from('payments')
    .select('amount')
    .eq('customer_id', customerId)
    .eq('type', 'deposit')

  // SỬA: Lấy cả 'withdraw' (cũ) và 'balance_used' (mới)
  const { data: withdrawals } = await supabase
    .from('payments')
    .select('amount')
    .eq('customer_id', customerId)
    .in('type', ['withdraw', 'balance_used'])

  const totalDeposit = deposits?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
  const totalWithdraw = withdrawals?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
  const balance = totalDeposit - totalWithdraw

  await supabase
    .from('customers')
    .update({ balance })
    .eq('id', customerId)

  return balance
}

// Lấy lịch sử giao dịch số dư
// SỬA: Thêm 'balance_used' vào danh sách type
export async function getCustomerTransactions(customerId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .in('type', ['deposit', 'withdraw', 'balance_used', 'refund'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ============================================
// PRODUCTS (Sản phẩm mẫu)
// ============================================

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name')
  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return data?.filter(p => p.is_active !== false) || []
}

export async function createProduct(product) {
  const { data, error } = await supabase
    .from('products')
    .insert([{ ...product, is_active: true }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ============================================
// ORDERS
// ============================================

export async function getOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      deliveries(*),
      payments(*)
    `)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getOrdersByCustomer(customerId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      deliveries(*),
      payments(*)
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// SỬA: Thêm shipping_fee và discount_cash vào tính toán
export async function createOrder(order) {
  // Tính toán chiết khấu và thành tiền
  const grossAmount = order.quantity * order.unit_price
  const discountPercent = order.discount_percent || 0
  const discountAmount = (grossAmount * discountPercent) / 100
  const discountCash = order.discount_cash || 0  // MỚI: Chiết khấu tiền mặt
  const shippingFee = order.shipping_fee || 0
  const finalAmount = grossAmount - discountAmount - discountCash + shippingFee  // SỬA: Trừ thêm CK tiền mặt

  const { data, error } = await supabase
    .from('orders')
    .insert([{
      ...order,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      discount_cash: discountCash,  // MỚI
      shipping_fee: shippingFee,
      final_amount: finalAmount
    }])
    .select(`
      *,
      customer:customers(*),
      deliveries(*),
      payments(*)
    `)
    .single()
  if (error) throw error
  return data
}

// Tạo nhiều đơn cùng lúc (1 khách mua nhiều sản phẩm)
// SỬA: Thêm shipping_fee và discount_cash vào tính toán
export async function createMultipleOrders(orders) {
  // Tính toán chiết khấu cho từng đơn
  const ordersWithDiscount = orders.map(order => {
    const grossAmount = order.quantity * order.unit_price
    const discountPercent = order.discount_percent || 0
    const discountAmount = (grossAmount * discountPercent) / 100
    const discountCash = order.discount_cash || 0  // MỚI: Chiết khấu tiền mặt
    const shippingFee = order.shipping_fee || 0
    const finalAmount = grossAmount - discountAmount - discountCash + shippingFee  // SỬA: Trừ thêm CK tiền mặt

    return {
      ...order,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      discount_cash: discountCash,  // MỚI
      shipping_fee: shippingFee,
      final_amount: finalAmount
    }
  })

  const { data, error } = await supabase
    .from('orders')
    .insert(ordersWithDiscount)
    .select(`
      *,
      customer:customers(*),
      deliveries(*),
      payments(*)
    `)
  if (error) throw error
  return data
}

// SỬA: Thêm shipping_fee và discount_cash vào updateOrder
export async function updateOrder(id, updates) {
  // Nếu có thay đổi quantity, unit_price, discount_percent, discount_cash, hoặc shipping_fee, tính lại
  if (updates.quantity !== undefined || updates.unit_price !== undefined || 
      updates.discount_percent !== undefined || updates.discount_cash !== undefined ||
      updates.shipping_fee !== undefined) {
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    const quantity = updates.quantity ?? currentOrder.quantity
    const unitPrice = updates.unit_price ?? currentOrder.unit_price
    const discountPercent = updates.discount_percent ?? currentOrder.discount_percent ?? 0
    const discountCash = updates.discount_cash ?? currentOrder.discount_cash ?? 0  // MỚI
    const shippingFee = updates.shipping_fee ?? currentOrder.shipping_fee ?? 0

    const grossAmount = quantity * unitPrice
    const discountAmount = (grossAmount * discountPercent) / 100
    const finalAmount = grossAmount - discountAmount - discountCash + shippingFee  // SỬA: Trừ thêm CK tiền mặt

    updates.discount_amount = discountAmount
    updates.discount_cash = discountCash  // MỚI
    updates.shipping_fee = shippingFee
    updates.final_amount = finalAmount
  }

  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteOrder(id) {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ============================================
// DELIVERIES
// ============================================

export async function addDelivery(delivery) {
  const { data, error } = await supabase
    .from('deliveries')
    .insert([delivery])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDelivery(id) {
  const { error } = await supabase
    .from('deliveries')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ============================================
// PAYMENTS
// ============================================

export async function addPayment(payment) {
  let customerId = payment.customer_id
  if (!customerId && payment.order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('customer_id')
      .eq('id', payment.order_id)
      .single()
    customerId = order?.customer_id
  }

  const { data, error } = await supabase
    .from('payments')
    .insert([{
      ...payment,
      customer_id: customerId,
      type: payment.type || 'payment'
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePayment(id) {
  const { error } = await supabase
    .from('payments')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ============================================
// REPORTS (Báo cáo)
// ============================================

// Báo cáo chi tiết khách hàng
export async function getCustomerReport(customerId) {
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  const { data: orders } = await supabase
    .from('orders')
    .select(`*, deliveries(*), payments(*)`)
    .eq('customer_id', customerId)
    .order('order_date', { ascending: false })

  const { data: transactions } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  return { customer, orders: orders || [], transactions: transactions || [] }
}

// Lấy danh sách khách hàng với thống kê
// SỬA: Tính totalPaid bao gồm cả balance_used (tiền trừ từ số dư)
export async function getCustomersWithStats() {
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('name')

  const { data: orders } = await supabase
    .from('orders')
    .select('customer_id, quantity, unit_price, final_amount, payments(*)')

  // Tính toán thống kê cho từng khách
  const stats = {}
  orders?.forEach(order => {
    if (!stats[order.customer_id]) {
      stats[order.customer_id] = {
        orderCount: 0,
        totalAmount: 0,
        totalPaid: 0
      }
    }
    stats[order.customer_id].orderCount++
    stats[order.customer_id].totalAmount += Number(order.final_amount) || (order.quantity * order.unit_price)

    // SỬA: Tính totalPaid bao gồm payment + balance_used (có order_id)
    stats[order.customer_id].totalPaid += order.payments
      ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
      ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
  })

  return customers?.map(c => ({
    ...c,
    orderCount: stats[c.id]?.orderCount || 0,
    totalAmount: stats[c.id]?.totalAmount || 0,
    totalPaid: stats[c.id]?.totalPaid || 0,
    debt: (stats[c.id]?.totalAmount || 0) - (stats[c.id]?.totalPaid || 0)
  })) || []
}

// MỚI: Lấy tổng doanh thu (tiền đã nhận từ khách)
export async function getTotalRevenue() {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, type')
    .in('type', ['payment', 'deposit'])

  if (error) throw error

  return data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
}

// MỚI: Lấy thống kê tổng quan
export async function getDashboardStats() {
  // Lấy tất cả payments
  const { data: allPayments } = await supabase
    .from('payments')
    .select('amount, type, customer_id')

  // Lấy tất cả orders chưa hoàn thành
  const { data: pendingOrders } = await supabase
    .from('orders')
    .select(`
      *,
      customer:customers(*),
      deliveries(*),
      payments(*)
    `)
    .neq('status', 'completed')

  // Tính doanh thu = tổng tiền đã nhận (payment + deposit)
  const totalRevenue = allPayments
    ?.filter(p => p.type === 'payment' || p.type === 'deposit' || !p.type)
    ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

  // Tính tổng công nợ
  let totalDebt = 0
  const debtorSet = new Set()

  pendingOrders?.forEach(order => {
    const orderTotal = Number(order.final_amount) || (order.quantity * order.unit_price)
    // Tính tiền đã thanh toán cho đơn này (payment + balance_used)
    const orderPaid = order.payments
      ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
      ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

    const debt = orderTotal - orderPaid
    if (debt > 0) {
      totalDebt += debt
      debtorSet.add(order.customer_id)
    }
  })

  return {
    totalRevenue,
    totalDebt,
    debtorCount: debtorSet.size,
    pendingCount: pendingOrders?.length || 0
  }
}

// ============================================
// CLEANUP & MAINTENANCE
// ============================================

// Cleanup old orders (xóa đơn cũ)
export async function cleanupOldOrders(daysOld = 365) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  const dateStr = getLocalDateString(cutoffDate)

  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('status', 'completed')
    .lt('order_date', dateStr)
    .select()

  if (error) throw error
  return data?.length || 0
}

// ============================================
// ĐĂNG NHẬP: xem src/lib/auth.js (Supabase Auth)
// ============================================

// ============================================
// DUNG LƯỢNG ĐÃ DÙNG
// ============================================
const FREE_DB_BYTES      = 500 * 1024 * 1024   // gói miễn phí: 500 MB database
const FREE_STORAGE_BYTES = 1024 * 1024 * 1024  // 1 GB ảnh
export const USAGE_LIMITS = { db: FREE_DB_BYTES, storage: FREE_STORAGE_BYTES }

// Dung lượng thật của từng bảng — cần hàm db_usage trong database
export async function getDbUsage() {
  const { data, error } = await supabase.rpc('db_usage')
  if (error) return { ok: false, message: error.message, tables: [], total: 0 }
  const tables = (data || []).map(r => ({
    name:  r.table_name,
    rows:  Number(r.rows_est) || 0,
    bytes: Number(r.bytes) || 0,
  }))
  return { ok: true, tables, total: tables.reduce((s, t) => s + t.bytes, 0) }
}

// Dung lượng ảnh: duyệt từng trang 100 file cho tới hết
export async function getStorageUsage(bucket = 'jewelry-images') {
  let bytes = 0, files = 0
  for (let page = 0; page < 60; page++) {
    const { data, error } = await supabase.storage.from(bucket)
      .list('', { limit: 100, offset: page * 100 })
    if (error) return { ok: false, message: error.message, bytes: 0, files: 0 }
    if (!data || data.length === 0) break
    data.forEach(f => { bytes += Number(f.metadata?.size) || 0 })
    files += data.length
    if (data.length < 100) break
  }
  return { ok: true, bytes, files }
}

// Nhớ kết quả trong máy để không phải tính lại mỗi lần mở Home.
// Đếm ảnh phải duyệt nhiều trang nên khá tốn băng thông.
const USAGE_KEY = 'chimai_usage_cache'
const USAGE_TTL = 12 * 60 * 60 * 1000   // 12 tiếng

export function readUsageCache() {
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return (Date.now() - (c.at || 0) < USAGE_TTL) ? c : { ...c, stale: true }
  } catch { return null }
}

export async function loadUsage({ force = false } = {}) {
  if (!force) {
    const c = readUsageCache()
    if (c && !c.stale) return c
  }
  const [db, storage] = await Promise.all([getDbUsage(), getStorageUsage()])
  const data = { at: Date.now(), db, storage }
  try { localStorage.setItem(USAGE_KEY, JSON.stringify(data)) } catch {}
  return data
}

export function fmtBytes(n) {
  const b = Number(n) || 0
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + ' GB'
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + ' MB'
  if (b >= 1024)      return Math.round(b / 1024) + ' KB'
  return b + ' B'
}
