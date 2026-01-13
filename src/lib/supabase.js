import { createClient } from '@supabase/supabase-js'

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
      payment_date: new Date().toISOString().split('T')[0]
    }])
    .select()
    .single()
  if (error) throw error

  await recalcCustomerBalance(customerId)
  return data
}

// Rút tiền từ tài khoản khách (thanh toán từ số dư)
export async function withdrawFromCustomer(customerId, amount, orderId = null, note = '') {
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      customer_id: customerId,
      order_id: orderId,
      amount: amount,
      type: 'withdraw',
      note: note || 'Thanh toán từ số dư',
      payment_date: new Date().toISOString().split('T')[0]
    }])
    .select()
    .single()
  if (error) throw error

  await recalcCustomerBalance(customerId)
  return data
}

// Tính lại số dư khách hàng
export async function recalcCustomerBalance(customerId) {
  const { data: deposits } = await supabase
    .from('payments')
    .select('amount')
    .eq('customer_id', customerId)
    .eq('type', 'deposit')

  const { data: withdrawals } = await supabase
    .from('payments')
    .select('amount')
    .eq('customer_id', customerId)
    .eq('type', 'withdraw')

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
export async function getCustomerTransactions(customerId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .in('type', ['deposit', 'withdraw', 'refund'])
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

export async function createOrder(order) {
  // Tính toán chiết khấu và thành tiền
  const grossAmount = order.quantity * order.unit_price
  const discountPercent = order.discount_percent || 0
  const discountAmount = (grossAmount * discountPercent) / 100
  const finalAmount = grossAmount - discountAmount

  const { data, error } = await supabase
    .from('orders')
    .insert([{
      ...order,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
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
export async function createMultipleOrders(orders) {
  // Tính toán chiết khấu cho từng đơn
  const ordersWithDiscount = orders.map(order => {
    const grossAmount = order.quantity * order.unit_price
    const discountPercent = order.discount_percent || 0
    const discountAmount = (grossAmount * discountPercent) / 100
    const finalAmount = grossAmount - discountAmount

    return {
      ...order,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
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

export async function updateOrder(id, updates) {
  // Nếu có thay đổi quantity hoặc unit_price, tính lại
  if (updates.quantity !== undefined || updates.unit_price !== undefined || updates.discount_percent !== undefined) {
    const { data: currentOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    const quantity = updates.quantity ?? currentOrder.quantity
    const unitPrice = updates.unit_price ?? currentOrder.unit_price
    const discountPercent = updates.discount_percent ?? currentOrder.discount_percent ?? 0

    const grossAmount = quantity * unitPrice
    const discountAmount = (grossAmount * discountPercent) / 100
    const finalAmount = grossAmount - discountAmount

    updates.discount_amount = discountAmount
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
    stats[order.customer_id].totalPaid += order.payments
      ?.filter(p => p.type === 'payment' || !p.type)
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

// ============================================
// CLEANUP & MAINTENANCE
// ============================================

// Cleanup old orders (xóa đơn cũ)
export async function cleanupOldOrders(daysOld = 365) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  const dateStr = cutoffDate.toISOString().split('T')[0]

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

export async function checkPassword(password) {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'app_password')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return true
    throw error
  }

  return data.value === password
}

export async function setPassword(password) {
  const { error } = await supabase
    .from('settings')
    .upsert([{ key: 'app_password', value: password }])
  if (error) throw error
}
