import { createClient } from '@supabase/supabase-js'
import { getLocalDateString } from './helpers'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
// AUTHENTICATION
// ============================================

// ============================================
// Hash mật khẩu bằng SHA-256 + salt (Web Crypto API)
// ============================================
const PW_SALT = 'ptpl_v1_'

// SHA-256 thuần JS — dùng khi crypto.subtle không khả dụng (HTTP, WebView cũ)
function sha256Fallback(str) {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
  const bytes = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c < 128) bytes.push(c)
    else if (c < 2048) bytes.push(192|(c>>6), 128|(c&63))
    else bytes.push(224|(c>>12), 128|((c>>6)&63), 128|(c&63))
  }
  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i*8)) & 0xff)

  const rotr = (x,n) => (x>>>n)|(x<<(32-n))
  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(64)
    for (let t = 0; t < 16; t++)
      w[t] = (bytes[i+t*4]<<24)|(bytes[i+t*4+1]<<16)|(bytes[i+t*4+2]<<8)|bytes[i+t*4+3]
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t-15],7)^rotr(w[t-15],18)^(w[t-15]>>>3)
      const s1 = rotr(w[t-2],17)^rotr(w[t-2],19)^(w[t-2]>>>10)
      w[t] = (w[t-16]+s0+w[t-7]+s1)|0
    }
    let [a,b,c,d,e,f,g,hh] = H
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e,6)^rotr(e,11)^rotr(e,25)
      const ch = (e&f)^(~e&g)
      const t1 = (hh+S1+ch+K[t]+w[t])|0
      const S0 = rotr(a,2)^rotr(a,13)^rotr(a,22)
      const maj = (a&b)^(a&c)^(b&c)
      const t2 = (S0+maj)|0
      hh=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0
    }
    H = [(H[0]+a)|0,(H[1]+b)|0,(H[2]+c)|0,(H[3]+d)|0,
         (H[4]+e)|0,(H[5]+f)|0,(H[6]+g)|0,(H[7]+hh)|0]
  }
  return H.map(x => (x>>>0).toString(16).padStart(8,'0')).join('')
}

async function sha256(str) {
  // Ưu tiên Web Crypto (nhanh, native) — fallback JS thuần khi không có
  if (typeof crypto !== 'undefined' && crypto.subtle && window.isSecureContext) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0')).join('')
    } catch { /* rơi xuống fallback */ }
  }
  return sha256Fallback(str)
}

async function hashPassword(password) {
  return sha256(PW_SALT + password)
}

// Rate limiting — chặn brute force
const LOGIN_ATTEMPTS_KEY = 'ptpl_login_attempts'
const MAX_ATTEMPTS   = 5
const LOCKOUT_MS     = 15 * 60 * 1000  // 15 phút

function getAttempts() {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY)
    return raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 }
  } catch { return { count: 0, lockedUntil: 0 } }
}

function setAttempts(obj) {
  try { localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(obj)) } catch {}
}

export function clearLoginAttempts() {
  try { localStorage.removeItem(LOGIN_ATTEMPTS_KEY) } catch {}
}

export function getLockoutRemaining() {
  const a = getAttempts()
  const remain = a.lockedUntil - Date.now()
  return remain > 0 ? Math.ceil(remain / 60000) : 0   // số phút còn lại
}

export async function checkPassword(password) {
  // Đang bị khoá?
  const attempts = getAttempts()
  if (attempts.lockedUntil > Date.now()) {
    const mins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000)
    throw new Error(`Đã nhập sai quá nhiều lần. Thử lại sau ${mins} phút.`)
  }

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'app_password')
    .maybeSingle()

  // Lỗi mạng / DB → KHÔNG cho vào (fail-closed)
  if (error) throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.')

  // Chưa đặt mật khẩu → cho vào để user có thể vào Cài đặt đặt mật khẩu
  if (!data?.value) { clearLoginAttempts(); return true }

  const stored = data.value
  const hashed = await hashPassword(password)

  // Hỗ trợ mật khẩu cũ lưu plain text → tự nâng cấp sang hash
  let ok = false
  if (stored.length === 64 && /^[0-9a-f]+$/.test(stored)) {
    ok = stored === hashed
  } else {
    ok = stored === password
    if (ok) { try { await setPassword(password) } catch {} }  // migrate sang hash
  }

  if (ok) {
    clearLoginAttempts()
    return true
  }

  // Sai → tăng bộ đếm
  const count = attempts.count + 1
  setAttempts({
    count,
    lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
  })
  if (count >= MAX_ATTEMPTS) {
    throw new Error(`Đã nhập sai ${MAX_ATTEMPTS} lần. Khoá 15 phút.`)
  }
  return false
}

export async function setPassword(password) {
  const hashed = await hashPassword(password)
  const { error } = await supabase
    .from('settings')
    .upsert([{ key: 'app_password', value: hashed }], { onConflict: 'key' })
  if (error) throw error
}

// ============================================
// Session token — chặn bypass bằng localStorage
// ============================================
const SESSION_KEY  = 'order_tracker_auth'
const SESSION_DAYS = 30

export async function createSession() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', 'app_password').maybeSingle()
  const pwHash = data?.value || 'nopw'
  // token = hash(pwHash + expiry) — không thể tự chế nếu không biết pwHash
  const expiry = Date.now() + SESSION_DAYS * 86400000
  const sig    = await sha256(pwHash + '|' + expiry)
  const token  = `${expiry}.${sig}`
  try {
    localStorage.setItem(SESSION_KEY, token)
    window.dispatchEvent(new Event('auth-changed'))
  } catch {}
  return token
}

// Trả về: 'valid' | 'invalid' | 'offline'
export async function verifySessionDetailed() {
  let token
  try { token = localStorage.getItem(SESSION_KEY) } catch { return 'invalid' }
  if (!token || !token.includes('.')) return 'invalid'

  const [expiryStr, sig] = token.split('.')
  const expiry = Number(expiryStr)
  if (!expiry || Date.now() > expiry) { clearSession(); return 'invalid' }

  const { data, error } = await supabase
    .from('settings').select('value').eq('key', 'app_password').maybeSingle()

  // Lỗi mạng → KHÔNG xoá session, báo offline để caller tự quyết
  if (error) return 'offline'

  const pwHash   = data?.value || 'nopw'
  const expected = await sha256(pwHash + '|' + expiry)

  if (sig !== expected) { clearSession(); return 'invalid' }
  return 'valid'
}

export async function verifySession() {
  const r = await verifySessionDetailed()
  return r === 'valid'
}

// Có token chưa hết hạn không — kiểm tra offline, không gọi DB
export function hasLocalSession() {
  try {
    const token = localStorage.getItem(SESSION_KEY)
    if (!token || !token.includes('.')) return false
    const expiry = Number(token.split('.')[0])
    return !!expiry && Date.now() < expiry
  } catch { return false }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
    window.dispatchEvent(new Event('auth-changed'))
  } catch {}
}

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

export function fmtBytes(n) {
  const b = Number(n) || 0
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + ' GB'
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + ' MB'
  if (b >= 1024)      return Math.round(b / 1024) + ' KB'
  return b + ' B'
}
