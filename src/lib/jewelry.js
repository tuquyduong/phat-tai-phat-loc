// ============================================
// JEWELRY LIB - Trang sức
// ============================================
import { supabase } from './supabase'

const BUCKET = 'jewelry-images'

// ============================================
// IMAGE
// ============================================
export async function resizeImage(file, maxPx = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const ratio  = Math.min(maxPx / img.width, maxPx / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('resize failed')),
        'image/jpeg', quality
      )
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

export async function uploadImage(blob, jewelryCode) {
  const safeName = jewelryCode.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path     = `${safeName}_${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob,
    { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export function thumbUrl(url, size = 200) {
  if (!url) return null
  try {
    // resize=contain: ảnh ngang/dọc/vuông đều vừa khung, không bị cắt
    return url.replace('/object/public/', '/render/image/public/')
      + `?width=${size}&height=${size}&resize=contain&quality=70`
  } catch { return url }
}

// ============================================
// JEWELRY CRUD
// ============================================
export async function getJewelry() {
  const { data, error } = await supabase
    .from('jewelry')
    .select('*, jewelry_trips(id, name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(j => ({
    ...j,
    trip_name: j.jewelry_trips?.name || null,
    jewelry_trips: undefined,
  }))
}

export async function createJewelry(item) {
  const { data, error } = await supabase
    .from('jewelry').insert([item]).select().single()
  if (error) throw error
  return data
}

export async function updateJewelry(id, updates) {
  const { error } = await supabase
    .from('jewelry')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteJewelry(id) {
  const { data: item } = await supabase
    .from('jewelry').select('image_url').eq('id', id).single()
  if (item?.image_url) {
    const path = item.image_url.split('/').pop().split('?')[0]
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
  }
  const { error } = await supabase.from('jewelry').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// SALES CRUD
// ============================================
export async function getJewelrySales() {
  const { data, error } = await supabase
    .from('jewelry_sales')
    .select('*, jewelry(code, name, category)')
    .order('sold_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Tạo đơn — hỗ trợ cả hàng có sẵn (jewelry_id) và hàng order (item_name)
export async function createSale(sale) {
  const sellQty  = Number(sale.qty) || 1
  const isInStock = !!sale.jewelry_id

  const row = {
    jewelry_id:     sale.jewelry_id || null,
    item_name:      sale.item_name?.trim() || null,
    item_image:     sale.item_image || null,
    qty:            sellQty,
    sell_price:     Number(sale.sell_price) || 0,
    customer_name:  sale.customer_name?.trim()  || null,
    customer_phone: sale.customer_phone?.trim() || null,
    deposit:        sale.deposit ? Number(sale.deposit) : null,
    due_date:       sale.due_date || null,
    note:           sale.note?.trim() || null,
    sold_at:        sale.sold_at,
    delivered:      sale.delivered ?? true,
    paid:           sale.paid ?? true,
    delivered_at:   (sale.delivered ?? true) ? sale.sold_at : null,
    paid_at:        (sale.paid      ?? true) ? sale.sold_at : null,
  }

  // Đọc trạng thái món hàng trước — hàng đang về KHÔNG BAO GIỜ được đánh dấu đã giao
  let stockItem = null
  if (isInStock) {
    const { data, error: ge } = await supabase
      .from('jewelry').select('stock_qty, status').eq('id', sale.jewelry_id).single()
    if (ge) throw ge
    stockItem = data
    if (stockItem.status === 'ordered' && row.delivered) {
      // Ép về chưa giao — hàng chưa có trong tay thì không thể giao
      row.delivered    = false
      row.delivered_at = null
    }
  }

  // Hàng có sẵn trong kho + đã giao → trừ kho ngay
  if (isInStock && row.delivered) {
    const currentQty = Number(stockItem.stock_qty) || 0
    if (sellQty > currentQty) throw new Error(`Không đủ hàng — tồn kho chỉ còn ${currentQty} cái`)

    const [r1, r2] = await Promise.all([
      supabase.from('jewelry_sales').insert([row]).select().single(),
      supabase.from('jewelry').update({
        stock_qty: currentQty - sellQty,
        updated_at: new Date().toISOString(),
      }).eq('id', sale.jewelry_id),
    ])
    if (r1.error) throw r1.error
    if (r2.error) throw r2.error
    return r1.data
  }

  // Hàng có sẵn chưa giao, hoặc hàng ĐANG VỀ → chưa trừ kho, nhưng vẫn giới hạn số lượng
  if (isInStock) {
    // Đã bán trước bao nhiêu cho món này (các đơn chưa giao)
    const { data: prev } = await supabase
      .from('jewelry_sales').select('qty')
      .eq('jewelry_id', sale.jewelry_id).eq('delivered', false)
    const soldAhead = (prev || []).reduce((s, x) => s + (Number(x.qty) || 0), 0)

    const limit = Number(stockItem.stock_qty) || 0
    if (soldAhead + sellQty > limit) {
      const left = Math.max(0, limit - soldAhead)
      throw new Error(stockItem.status === 'ordered'
        ? `Chỉ còn ${left} cái đang về chưa bán — không đặt quá số lượng nhập`
        : `Chỉ còn ${left} cái — không bán quá tồn kho`)
    }
  }

  const { data, error } = await supabase
    .from('jewelry_sales').insert([row]).select().single()
  if (error) throw error
  return data
}

// ============================================
// NHẬN HÀNG VỀ — đổi status, cập nhật số thực nhận
// ============================================
export async function receiveOrder(jewelryId, actualQty) {
  const { data: item, error: ge } = await supabase
    .from('jewelry').select('stock_qty, code').eq('id', jewelryId).single()
  if (ge) throw ge

  const received = Number(actualQty)
  if (!(received >= 0)) throw new Error('Số lượng thực nhận không hợp lệ')

  // Số đã bán trước (đơn chưa giao)
  const { data: prev } = await supabase
    .from('jewelry_sales').select('qty')
    .eq('jewelry_id', jewelryId).eq('delivered', false)
  const soldAhead = (prev || []).reduce((s, x) => s + (Number(x.qty) || 0), 0)

  if (received < soldAhead) {
    throw new Error(`Đã bán trước ${soldAhead} cái — số thực nhận không được nhỏ hơn`)
  }

  const { error } = await supabase.from('jewelry').update({
    status:      'in_stock',
    stock_qty:   received,
    received_at: new Date().toISOString().slice(0, 10),
    updated_at:  new Date().toISOString(),
  }).eq('id', jewelryId)
  if (error) throw error

  return { received, soldAhead, available: received - soldAhead }
}

// Tick "đã giao" / "đã thanh toán"
export async function updateSaleStatus(saleId, field, value) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: sale, error: ge } = await supabase
    .from('jewelry_sales').select('*').eq('id', saleId).single()
  if (ge) throw ge

  const updates = {
    [field]: value,
    [`${field}_at`]: value ? today : null,
  }

  // Khi tick "đã giao" lần đầu cho hàng CÓ SẴN → trừ kho
  if (field === 'delivered' && value && sale.jewelry_id && !sale.delivered) {
    const { data: item, error: ie } = await supabase
      .from('jewelry').select('stock_qty, status').eq('id', sale.jewelry_id).single()
    if (ie) throw ie
    if (item.status === 'ordered')
      throw new Error('Hàng chưa về kho — xác nhận nhận hàng ở tab Nhập hàng trước')
    const currentQty = Number(item.stock_qty) || 0
    const sellQty    = Number(sale.qty) || 1
    if (sellQty > currentQty) throw new Error(`Không đủ hàng — tồn kho chỉ còn ${currentQty} cái`)
    await supabase.from('jewelry').update({
      stock_qty: currentQty - sellQty,
      updated_at: new Date().toISOString(),
    }).eq('id', sale.jewelry_id)
  }

  // Bỏ tick "đã giao" cho hàng CÓ SẴN → hoàn kho
  if (field === 'delivered' && !value && sale.jewelry_id && sale.delivered) {
    const { data: item } = await supabase
      .from('jewelry').select('stock_qty').eq('id', sale.jewelry_id).single()
    if (item) {
      await supabase.from('jewelry').update({
        stock_qty: (Number(item.stock_qty) || 0) + (Number(sale.qty) || 1),
        updated_at: new Date().toISOString(),
      }).eq('id', sale.jewelry_id)
    }
  }

  const { error } = await supabase
    .from('jewelry_sales').update(updates).eq('id', saleId)
  if (error) throw error
}

export async function updateSale(saleId, updates) {
  const { error } = await supabase.from('jewelry_sales').update({
    item_name:      updates.item_name?.trim() || null,
    qty:            Number(updates.qty) || 1,
    sell_price:     Number(updates.sell_price) || 0,
    customer_name:  updates.customer_name?.trim()  || null,
    customer_phone: updates.customer_phone?.trim() || null,
    deposit:        updates.deposit ? Number(updates.deposit) : null,
    due_date:       updates.due_date || null,
    note:           updates.note?.trim() || null,
    sold_at:        updates.sold_at,
  }).eq('id', saleId)
  if (error) throw error
}

export async function deleteSale(saleId) {
  // Hoàn kho nếu đơn đã giao và là hàng có sẵn
  const { data: sale } = await supabase
    .from('jewelry_sales').select('jewelry_id, qty, delivered').eq('id', saleId).single()
  if (sale?.jewelry_id && sale.delivered) {
    const { data: item } = await supabase
      .from('jewelry').select('stock_qty').eq('id', sale.jewelry_id).single()
    if (item) {
      await supabase.from('jewelry').update({
        stock_qty: (Number(item.stock_qty) || 0) + (Number(sale.qty) || 1),
        updated_at: new Date().toISOString(),
      }).eq('id', sale.jewelry_id)
    }
  }
  const { error } = await supabase.from('jewelry_sales').delete().eq('id', saleId)
  if (error) throw error
}

// ============================================
// TRIPS CRUD
// ============================================
export async function getJewelryTrips() {
  const { data, error } = await supabase
    .from('jewelry_trips')
    .select('*, jewelry(id, stock_qty, cost_price, status)')
    .order('trip_date', { ascending: false })
  if (error) throw error
  const val = list => list.reduce(
    (s, j) => s + (Number(j.stock_qty)||0) * (Number(j.cost_price)||0), 0)
  return (data || []).map(t => {
    const all = t.jewelry || []
    const arrived  = all.filter(j => j.status !== 'ordered')
    const incoming = all.filter(j => j.status === 'ordered')
    return {
      ...t,
      item_count:     arrived.length,
      incoming_count: incoming.length,
      stock_value:    val(arrived),
      incoming_value: val(incoming),
      jewelry: undefined,
    }
  })
}

export async function createJewelryTrip(trip) {
  const { data, error } = await supabase
    .from('jewelry_trips')
    .insert([{
      name:        trip.name.trim(),
      destination: trip.destination?.trim() || null,
      trip_date:   trip.trip_date || null,
      note:        trip.note?.trim() || null,
    }])
    .select().single()
  if (error) throw error
  return data
}

export async function updateJewelryTrip(id, updates) {
  const { error } = await supabase
    .from('jewelry_trips')
    .update({
      name:        updates.name.trim(),
      destination: updates.destination?.trim() || null,
      trip_date:   updates.trip_date || null,
      note:        updates.note?.trim() || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteJewelryTrip(id) {
  // ON DELETE SET NULL trên jewelry.trip_id
  const { error } = await supabase.from('jewelry_trips').delete().eq('id', id)
  if (error) throw error
}

// Active trip session (localStorage)
const TRIP_KEY = 'jewelry_active_trip'
export function getActiveTrip() {
  try { return JSON.parse(localStorage.getItem(TRIP_KEY)) } catch { return null }
}
export function setActiveTrip(trip) {
  if (trip) localStorage.setItem(TRIP_KEY, JSON.stringify(trip))
  else       localStorage.removeItem(TRIP_KEY)
}

// ============================================
// ANALYTICS
// ============================================
export function calcStats(jewelry, sales) {
  const today    = new Date()
  const thisMonth = new Date().toISOString().slice(0, 7)

  // Tách hàng đang về khỏi hàng trong kho
  const incoming  = jewelry.filter(j => j.status === 'ordered')
  const inStockJw = jewelry.filter(j => j.status !== 'ordered')

  const totalItems   = inStockJw.length
  const inStock      = inStockJw.filter(j => Number(j.stock_qty) > 0).length
  const totalSold    = sales.reduce((s, x) => s + Number(x.qty), 0)
  const totalRevenue = sales.reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthSales   = sales.filter(s => s.sold_at?.startsWith(thisMonth))
  const monthRevenue = monthSales.reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthActual  = monthSales.reduce((s, x) =>
    s + (x.paid ? Number(x.qty) * Number(x.sell_price) : (Number(x.deposit) || 0)), 0)
  const monthSalesCount = monthSales.length

  // Days in stock
  const withDays = inStockJw.map(j => {
    const days = Math.floor((today - new Date(j.created_at)) / 86400000)
    return {
      ...j,
      days_in_stock:   days,
      stock_remaining: Number(j.stock_qty) || 0,
      // Ngày vào kho: ngày nhận hàng nếu có, không thì ngày tạo
      entry_date:      j.received_at || (j.created_at || '').slice(0, 10),
      is_new:          days <= 3,
      needs_photo:     !j.image_url,
    }
  })

  const slowMoving = withDays
    .filter(j => j.stock_remaining > 0 && j.days_in_stock >= 30)
    .sort((a, b) => b.days_in_stock - a.days_in_stock)

  // Best sellers
  const salesByItem = {}
  sales.forEach(s => {
    if (!salesByItem[s.jewelry_id]) salesByItem[s.jewelry_id] = { qty: 0, revenue: 0 }
    salesByItem[s.jewelry_id].qty     += Number(s.qty)
    salesByItem[s.jewelry_id].revenue += Number(s.qty) * Number(s.sell_price)
  })
  const bestSellers = jewelry
    .map(j => ({ ...j, ...(salesByItem[j.id] || { qty: 0, revenue: 0 }) }))
    .filter(j => j.qty > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // Customer analytics
  const custMap = {}
  sales.forEach(s => {
    const name = s.customer_name || 'Không tên'
    if (!custMap[name]) custMap[name] = { name, count: 0, revenue: 0, lastDate: '', items: [] }
    custMap[name].count   += 1
    custMap[name].revenue += Number(s.qty) * Number(s.sell_price)
    if (s.sold_at > custMap[name].lastDate) custMap[name].lastDate = s.sold_at
    if (s.jewelry?.name && !custMap[name].items.includes(s.jewelry.name))
      custMap[name].items.push(s.jewelry.name)
  })
  const customers = Object.values(custMap).map(c => ({
    ...c,
    daysSinceLast: c.lastDate
      ? Math.floor((today - new Date(c.lastDate)) / 86400000) : 999,
  }))

  // Sale log
  const saleLog = sales.map(s => ({
    type: 'sale', date: s.sold_at,
    code: s.jewelry?.code, name: s.jewelry?.name,
    qty: s.qty, customer: s.customer_name,
    revenue: Number(s.qty) * Number(s.sell_price),
  })).sort((a, b) => (b.date||'').localeCompare(a.date||''))

  // Revenue by category
  const catRevenue = {}
  sales.forEach(s => {
    const cat = s.jewelry?.category || 'Khác'
    catRevenue[cat] = (catRevenue[cat] || 0) + Number(s.qty) * Number(s.sell_price)
  })

  // ===== Trạng thái đơn =====
  const today10 = new Date().toISOString().slice(0, 10)
  const pending = sales.filter(s => !s.delivered || !s.paid)
  const done    = sales.filter(s =>  s.delivered &&  s.paid)

  const orderTotal = s => Number(s.qty) * Number(s.sell_price)

  // Thực thu = đơn đã thanh toán + tiền cọc của đơn chưa thanh toán
  const actualRevenue = sales.reduce((sum, s) =>
    sum + (s.paid ? orderTotal(s) : (Number(s.deposit) || 0)), 0)

  // Công nợ = tổng đơn chưa thanh toán, trừ cọc đã nhận
  const totalDebt = sales
    .filter(s => !s.paid)
    .reduce((sum, s) => sum + orderTotal(s) - (Number(s.deposit) || 0), 0)

  const heldDeposit = sales
    .filter(s => !s.paid)
    .reduce((sum, s) => sum + (Number(s.deposit) || 0), 0)

  const overdue = sales.filter(s =>
    !s.delivered && s.due_date && s.due_date < today10)

  // Công nợ theo khách
  const debtByCustomer = {}
  sales.filter(s => !s.paid).forEach(s => {
    const name = s.customer_name || 'Khách lẻ'
    const owed = orderTotal(s) - (Number(s.deposit) || 0)
    if (owed <= 0) return
    if (!debtByCustomer[name]) debtByCustomer[name] = { name, amount: 0, count: 0, phone: s.customer_phone }
    debtByCustomer[name].amount += owed
    debtByCustomer[name].count  += 1
  })
  const debtors = Object.values(debtByCustomer).sort((a,b) => b.amount - a.amount)

  return {
    totalItems, inStock, totalSold, totalRevenue,
    monthRevenue, monthActual, monthSalesCount,
    slowMovingCount: slowMoving.length,
    slowMoving, bestSellers, customers, saleLog, withDays, catRevenue,
    stockValue: inStockJw.reduce(
      (s, j) => s + (Number(j.stock_qty)||0) * (Number(j.sell_price)||0), 0
    ),
    // Hàng đang về
    incoming,
    incomingCount: incoming.length,
    incomingValue: incoming.reduce(
      (s, j) => s + (Number(j.stock_qty)||0) * (Number(j.cost_price)||0), 0
    ),
    incomingLate: incoming.filter(j =>
      j.eta_date && j.eta_date < new Date().toISOString().slice(0,10)).length,
    // Đơn hàng
    pending, done, overdue, debtors,
    pendingCount: pending.length,
    overdueCount: overdue.length,
    actualRevenue, totalDebt, heldDeposit,
  }
}

export async function getSuppliers() {
  const { data, error } = await supabase
    .from('jewelry')
    .select('supplier_name, supplier_contact')
    .not('supplier_name', 'is', null)
    .order('supplier_name')
  if (error) throw error
  // Group by supplier_name, lấy contact mới nhất
  const map = {}
  ;(data || []).forEach(j => {
    if (!map[j.supplier_name]) map[j.supplier_name] = j.supplier_contact || ''
  })
  return Object.entries(map).map(([name, contact]) => ({ name, contact }))
}

export function getCustomerNames(sales) {
  return [...new Set(sales.map(s => s.customer_name).filter(Boolean))]
}

export function fmtMoney(n) {
  if (!n && n !== 0) return '0'
  const x = Number(n)
  if (x >= 1e6) {
    const v = x / 1e6
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'tr'
  }
  if (x >= 1e3) {
    const v = x / 1e3
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '')) + 'k'
  }
  return x.toLocaleString()
}

export const DEFAULT_CATEGORIES = ['Nhẫn', 'Dây chuyền', 'Bông tai', 'Lắc', 'Vòng', 'Khác']
const CAT_KEY = 'jewelry_categories'

export async function getJewelryCategories() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', CAT_KEY).maybeSingle()
  if (!data?.value) return DEFAULT_CATEGORIES
  try { return JSON.parse(data.value) } catch { return DEFAULT_CATEGORIES }
}

export async function saveJewelryCategories(cats) {
  const { error } = await supabase.from('settings')
    .upsert({ key: CAT_KEY, value: JSON.stringify(cats) }, { onConflict: 'key' })
  if (error) throw error
}

// ============================================
// CUSTOMER NOTES (lưu trong settings)
// ============================================
const CUST_NOTES_KEY = 'jewelry_customer_notes'

export async function getCustomerNotes() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', CUST_NOTES_KEY).maybeSingle()
  if (!data?.value) return {}
  try { return JSON.parse(data.value) } catch { return {} }
}

export async function saveCustomerNote(customerName, note) {
  const notes = await getCustomerNotes()
  if (note.trim()) notes[customerName] = note.trim()
  else delete notes[customerName]
  const { error } = await supabase.from('settings')
    .upsert({ key: CUST_NOTES_KEY, value: JSON.stringify(notes) }, { onConflict: 'key' })
  if (error) throw error
}

// ============================================
// FORMAT SỐ TIỀN TRONG INPUT (1.000.000)
// ============================================
// Hiển thị: thêm dấu chấm ngăn cách hàng nghìn
export function fmtInput(val) {
  if (val === '' || val === null || val === undefined) return ''
  const digits = String(val).replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('vi-VN')
}

// Đọc ngược: bỏ hết dấu chấm, trả về chuỗi số thuần
export function parseInput(val) {
  return String(val ?? '').replace(/\D/g, '')
}

// ============================================
// Ổ MẪU (mounts)
// ============================================
export const MOUNT_TYPES = ['Ổ nhẫn', 'Khuyên tai', 'Vòng', 'Lắc', 'Mặt dây', 'Khác']
export const GOLD_TYPES  = ['18k', '24k', '14k', '10k', 'Bạc 925', 'Khác']

export async function getMounts() {
  const { data, error } = await supabase
    .from('jewelry_mounts').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createMount(m) {
  const { data, error } = await supabase
    .from('jewelry_mounts').insert([cleanMount(m)]).select().single()
  if (error) throw error
  return data
}

export async function updateMount(id, m) {
  const { data, error } = await supabase
    .from('jewelry_mounts')
    .update({ ...cleanMount(m), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().single()
  if (error) throw error
  return data
}

export async function deleteMount(id) {
  const { data: m } = await supabase
    .from('jewelry_mounts').select('image_url').eq('id', id).single()
  if (m?.image_url) {
    const path = m.image_url.split('/').pop().split('?')[0]
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
  }
  const { error } = await supabase.from('jewelry_mounts').delete().eq('id', id)
  if (error) throw error
}

function cleanMount(m) {
  const num = v => (v === '' || v === null || v === undefined) ? null : Number(v)
  return {
    name:        m.name.trim(),
    type:        m.type || 'Ổ nhẫn',
    image_url:   m.image_url || null,
    size:        m.size?.trim()       || null,
    gold_chi:    num(m.gold_chi),
    gold_gram:   num(m.gold_gram),
    gold_type:   m.gold_type || '18k',
    labor_cost:  num(m.labor_cost),
    stone_count: num(m.stone_count),
    stone_size:  m.stone_size?.trim() || null,
    note:        m.note?.trim()       || null,
  }
}

// ============================================
// GIÁ VÀNG (settings key: gold_price)
// ============================================
const GOLD_KEY = 'gold_price'

export async function getGoldPrice() {
  const { data } = await supabase
    .from('settings').select('value').eq('key', GOLD_KEY).maybeSingle()
  return Number(data?.value) || 0
}

export async function saveGoldPrice(price) {
  const { error } = await supabase.from('settings')
    .upsert({ key: GOLD_KEY, value: String(Number(price) || 0) }, { onConflict: 'key' })
  if (error) throw error
}

// Ước tính giá ổ = vàng + công (chưa tính đá)
export function estimateMount(mount, goldPrice) {
  const chi   = Number(mount.gold_chi)   || 0
  const labor = Number(mount.labor_cost) || 0
  const gold  = chi * (Number(goldPrice) || 0)
  return { gold, labor, total: gold + labor }
}

// ============================================
// NHẬP HÀNG LOẠT TỪ FILE CSV
// ============================================
export const CSV_COLUMNS = [
  { key: 'code',             label: 'ma',          required: true,  example: 'NK-001' },
  { key: 'category',         label: 'loai',        required: true,  example: 'Nhẫn' },
  { key: 'name',             label: 'ten',         required: false, example: 'Nhẫn vàng 18k' },
  { key: 'size',             label: 'size',        required: false, example: '15' },
  { key: 'stock_qty',        label: 'so_luong',    required: false, example: '5' },
  { key: 'cost_price',       label: 'gia_von',     required: false, example: '1850000' },
  { key: 'sell_price',       label: 'gia_ban',     required: false, example: '3200000' },
  { key: 'supplier_name',    label: 'ncc',         required: false, example: 'Kim Thanh HN' },
  { key: 'supplier_contact', label: 'sdt_ncc',     required: false, example: '0912345678' },
  { key: 'tracking_number',  label: 'ma_van_don',  required: false, example: 'SF1234567890' },
  { key: 'order_date',       label: 'ngay_dat',    required: false, example: '2026-09-16' },
  { key: 'eta_date',         label: 'du_kien_ve',  required: false, example: '2026-09-25' },
  { key: 'note',             label: 'ghi_chu',     required: false, example: 'Chấu tròn' },
]

// Sinh nội dung file mẫu (kèm BOM để Excel đọc đúng tiếng Việt)
export function buildCsvTemplate() {
  const header = CSV_COLUMNS.map(c => c.label).join(',')
  const sample = CSV_COLUMNS.map(c => c.example).join(',')
  const blank  = CSV_COLUMNS.map(() => '').join(',')
  return '\uFEFF' + [header, sample, blank].join('\n')
}

export function downloadCsvTemplate(filename = 'mau-nhap-hang.csv') {
  const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Tách 1 dòng CSV, xử lý dấu ngoặc kép và dấu phẩy bên trong
function splitCsvLine(line) {
  const out = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// Đọc file CSV → danh sách dòng đã phân tích, kèm lỗi từng dòng
export function parseCsv(text, { existingCodes = [], categories = [] } = {}) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = clean.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 2) return { rows: [], error: 'File trống hoặc chỉ có dòng tiêu đề' }

  const header = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const idx = {}
  CSV_COLUMNS.forEach(c => { idx[c.key] = header.indexOf(c.label) })

  if (idx.code === -1) {
    return { rows: [], error: 'Thiếu cột "ma" — hãy tải lại file mẫu' }
  }

  const seen = new Set()
  const codeSet = new Set(existingCodes.map(c => String(c).toLowerCase()))

  const rows = lines.slice(1).map((line, i) => {
    const cells = splitCsvLine(line)
    const get = key => (idx[key] >= 0 ? (cells[idx[key]] ?? '') : '')
    // Hiểu cả "3200000", "3.200.000", "3,200,000", "3 200 000"
    const num = v => {
      let s = String(v).trim()
      if (s === '') return null
      s = s.replace(/[^\d.,-]/g, '')
      if (!/\d/.test(s)) return null        // không có chữ số nào → bỏ
      const dots = (s.match(/\./g) || []).length
      const commas = (s.match(/,/g) || []).length
      if (dots > 1 || (dots === 1 && commas === 0 && /\.\d{3}$/.test(s))) {
        s = s.replace(/\./g, '')          // 3.200.000 → 3200000
      }
      if (commas > 1 || (commas === 1 && /,\d{3}$/.test(s))) {
        s = s.replace(/,/g, '')            // 3,200,000 → 3200000
      } else {
        s = s.replace(/,/g, '.')           // 1,5 → 1.5 (số lẻ kiểu VN)
      }
      const n = Number(s)
      return Number.isFinite(n) ? n : null
    }

    const code = get('code')
    const data = {
      code,
      category:         get('category') || 'Khác',
      name:             get('name')             || null,
      size:             get('size')             || null,
      stock_qty:        num(get('stock_qty')) ?? 1,
      cost_price:       num(get('cost_price')),
      sell_price:       num(get('sell_price')),
      supplier_name:    get('supplier_name')    || null,
      supplier_contact: get('supplier_contact') || null,
      tracking_number:  get('tracking_number')  || null,
      order_date:       get('order_date')       || null,
      eta_date:         get('eta_date')         || null,
      note:             get('note')             || null,
    }

    const errors = []
    if (!code) errors.push('thiếu mã')
    else if (codeSet.has(code.toLowerCase()))  errors.push('mã đã có trong kho')
    else if (seen.has(code.toLowerCase()))     errors.push('mã trùng trong file')
    if (code) seen.add(code.toLowerCase())

    if (categories.length && data.category && !categories.includes(data.category))
      errors.push(`loại "${data.category}" chưa có`)
    if (data.stock_qty != null && data.stock_qty < 0) errors.push('số lượng âm')

    return { line: i + 2, data, errors, ok: errors.length === 0 }
  })

  return { rows, error: null }
}

// Lưu hàng loạt — chia lô để tránh quá tải
export async function bulkCreateJewelry(rows, { status = 'in_stock', trip_id = null } = {}) {
  const payload = rows.map(r => ({
    ...r.data,
    status,
    trip_id,
    image_url: null,
  }))

  let inserted = 0
  const failed = []
  const SIZE = 50

  for (let i = 0; i < payload.length; i += SIZE) {
    const chunk = payload.slice(i, i + SIZE)
    const { data, error } = await supabase.from('jewelry').insert(chunk).select('id')
    if (error) {
      // Lô lỗi → thử từng dòng để biết dòng nào hỏng
      for (const one of chunk) {
        const { error: e1 } = await supabase.from('jewelry').insert([one])
        if (e1) failed.push({ code: one.code, message: e1.message })
        else inserted++
      }
    } else {
      inserted += data?.length || chunk.length
    }
  }

  return { inserted, failed }
}
