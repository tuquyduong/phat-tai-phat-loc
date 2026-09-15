// ============================================
// JEWELRY LIB - Trang sức
// ============================================
import { supabase } from './supabase'

const BUCKET = 'jewelry-images'

// ============================================
// IMAGE RESIZE (client-side, no server needed)
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
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('resize failed')),
        'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = url
  })
}

// Nhận File/Blob đã resize sẵn — path sanitized
export async function uploadImage(blob, jewelryCode) {
  const safeName = jewelryCode.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path     = `${safeName}_${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob,
    { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Thumbnail URL — Supabase transform (không tốn storage thêm)
export function thumbUrl(url, width = 200) {
  if (!url) return null
  try {
    // Supabase Storage transform API
    return url.replace('/object/public/', '/render/image/public/') + `?width=${width}&quality=60`
  } catch {
    return url // fallback: original URL
  }
}

// ============================================
// JEWELRY CRUD
// ============================================
export async function getJewelry() {
  const { data, error } = await supabase
    .from('jewelry').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createJewelry(item) {
  const { data, error } = await supabase
    .from('jewelry').insert([item]).select().single()
  if (error) throw error
  return data
}

export async function updateJewelry(id, updates) {
  const { error } = await supabase
    .from('jewelry').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function deleteJewelry(id) {
  // Xóa ảnh trên storage nếu có
  const { data: item } = await supabase.from('jewelry').select('image_url').eq('id', id).single()
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
export async function getJewelrySales(filters = {}) {
  let q = supabase.from('jewelry_sales')
    .select('*, jewelry(code, name, category)')
    .order('sold_at', { ascending: false })
    .order('created_at', { ascending: false })
  if (filters.jewelry_id) q = q.eq('jewelry_id', filters.jewelry_id)
  if (filters.from) q = q.gte('sold_at', filters.from)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createSale(sale) {
  // Deduct stock
  const { data: item, error: ge } = await supabase
    .from('jewelry').select('stock_qty').eq('id', sale.jewelry_id).single()
  if (ge) throw ge
  const newQty = (Number(item.stock_qty) || 0) - (Number(sale.qty) || 1)

  const [r1, r2] = await Promise.all([
    supabase.from('jewelry_sales').insert([{
      jewelry_id:    sale.jewelry_id,
      qty:           sale.qty,
      sell_price:    sale.sell_price,
      customer_name: sale.customer_name?.trim() || null,
      note:          sale.note?.trim() || null,
      sold_at:       sale.sold_at,
    }]).select().single(),
    supabase.from('jewelry').update({ stock_qty: newQty, updated_at: new Date().toISOString() })
      .eq('id', sale.jewelry_id)
  ])
  if (r1.error) throw r1.error
  if (r2.error) throw r2.error
  return r1.data
}

export async function deleteSale(saleId) {
  const { error } = await supabase.from('jewelry_sales').delete().eq('id', saleId)
  if (error) throw error
}

// ============================================
// ANALYTICS (tính client-side từ data đã load)
// ============================================
export function calcStats(jewelry, sales) {
  const today = new Date()

  // Stock stats
  const totalItems  = jewelry.length
  const inStock     = jewelry.filter(j => Number(j.stock_qty) > 0).length
  const totalSold   = sales.reduce((s, x) => s + Number(x.qty), 0)
  const totalRevenue= sales.reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)

  // Days in stock (tính từ created_at đến hôm nay)
  const withDays = jewelry.map(j => ({
    ...j,
    days_in_stock: Math.floor((today - new Date(j.created_at)) / 86400000),
    stock_remaining: Number(j.stock_qty) || 0,
  }))

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
    custMap[name].count   += 1  // số lần mua (transaction), không phải số cái
    custMap[name].revenue += Number(s.qty) * Number(s.sell_price)
    if (s.sold_at > custMap[name].lastDate) custMap[name].lastDate = s.sold_at
    if (s.jewelry?.name && !custMap[name].items.includes(s.jewelry.name))
      custMap[name].items.push(s.jewelry.name)
  })
  const customers = Object.values(custMap)
    .map(c => ({
      ...c,
      daysSinceLast: c.lastDate
        ? Math.floor((today - new Date(c.lastDate)) / 86400000) : 999
    }))

  // Log bán hàng (imports xem trong DetailPanel riêng theo từng SP)
  const saleLog = sales.map(s => ({
    type: 'sale', date: s.sold_at,
    code: s.jewelry?.code, name: s.jewelry?.name,
    qty: s.qty, customer: s.customer_name,
    revenue: Number(s.qty) * Number(s.sell_price),
  }))
  const xnLog = [...saleLog].sort((a,b) => (b.date||'').localeCompare(a.date||''))

  // Doanh thu tháng hiện tại
  const thisMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const monthRevenue = sales
    .filter(s => s.sold_at?.startsWith(thisMonth))
    .reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthSalesCount = sales.filter(s => s.sold_at?.startsWith(thisMonth)).length

  return {
    totalItems, inStock, totalSold, totalRevenue,
    monthRevenue, monthSalesCount,
    slowMovingCount: slowMoving.length,
    slowMoving, bestSellers, customers, xnLog, withDays,
    stockValue: jewelry.reduce((s,j) => s + (Number(j.stock_qty)||0)*(Number(j.sell_price)||0), 0),
  }
}

// Distinct customer names từ lịch sử (cho autocomplete)
export function getCustomerNames(sales) {
  return [...new Set(sales.map(s => s.customer_name).filter(Boolean))]
}

// Format tiền gọn
export function fmtMoney(n) {
  if (!n && n !== 0) return '0'
  const x = Number(n)
  if (x >= 1e6) {
    const v = x / 1e6
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/,'')) + 'tr'
  }
  if (x >= 1e3) {
    const v = x / 1e3
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/,'')) + 'k'
  }
  return x.toLocaleString()
}

export const CATEGORIES = ['Nhẫn','Dây chuyền','Bông tai','Lắc','Vòng','Khác']

// ============================================
// IMPORTS (lô nhập trang sức)
// ============================================
export async function getJewelryImports(jewelryId) {
  const { data, error } = await supabase
    .from('jewelry_imports')
    .select('*, jewelry_trips(name)')
    .eq('jewelry_id', jewelryId)
    .order('import_date', { ascending: false })
  if (error) throw error
  return (data || []).map(i => ({
    ...i,
    trip_name: i.jewelry_trips?.name || null,
    jewelry_trips: undefined,
  }))
}

export async function createJewelryImport(imp) {
  // Đọc stock hiện tại → cộng thêm
  const { data: item, error: ge } = await supabase
    .from('jewelry').select('stock_qty').eq('id', imp.jewelry_id).single()
  if (ge) throw ge
  const newQty = (Number(item.stock_qty) || 0) + (Number(imp.qty) || 0)

  const [r1, r2] = await Promise.all([
    supabase.from('jewelry_imports').insert([{
      jewelry_id:    imp.jewelry_id,
      qty:           Number(imp.qty),
      cost_per_unit: imp.cost_per_unit ? Number(imp.cost_per_unit) : null,
      supplier_name: imp.supplier_name?.trim() || null,
      import_date:   imp.import_date,
      note:          imp.note?.trim() || null,
    }]).select().single(),
    supabase.from('jewelry').update({
      stock_qty: newQty,
      updated_at: new Date().toISOString(),
    }).eq('id', imp.jewelry_id),
  ])
  if (r1.error) throw r1.error
  if (r2.error) throw r2.error
  return r1.data
}

export async function updateJewelryImport(id, updates) {
  // Đọc lô cũ để tính diff qty → cập nhật stock
  const { data: oldImp, error: ge } = await supabase
    .from('jewelry_imports').select('qty, jewelry_id').eq('id', id).single()
  if (ge) throw ge

  const qtyDiff = Number(updates.qty) - Number(oldImp.qty)

  const ops = [
    supabase.from('jewelry_imports').update({
      qty:           Number(updates.qty),
      cost_per_unit: updates.cost_per_unit ? Number(updates.cost_per_unit) : null,
      supplier_name: updates.supplier_name?.trim() || null,
      import_date:   updates.import_date,
      note:          updates.note?.trim() || null,
      trip_id:       updates.trip_id || null,
    }).eq('id', id),
  ]

  // Chỉ cập nhật stock khi qty thay đổi
  if (qtyDiff !== 0) {
    const { data: item, error: se } = await supabase
      .from('jewelry').select('stock_qty').eq('id', oldImp.jewelry_id).single()
    if (se) throw se
    ops.push(
      supabase.from('jewelry').update({
        stock_qty: (Number(item.stock_qty) || 0) + qtyDiff,
        updated_at: new Date().toISOString(),
      }).eq('id', oldImp.jewelry_id)
    )
  }

  const results = await Promise.all(ops)
  for (const r of results) { if (r.error) throw r.error }
}

// Xoá lô nhập — KHÔNG hoàn tồn kho tự động (tránh nhầm lẫn)
export async function deleteJewelryImport(importId) {
  const { error } = await supabase
    .from('jewelry_imports').delete().eq('id', importId)
  if (error) throw error
}

// ============================================
// TRIPS (chuyến nhập)
// ============================================
export async function getJewelryTrips() {
  const { data, error } = await supabase
    .from('jewelry_trips')
    .select('*, jewelry_imports(id, qty, cost_per_unit)')
    .order('trip_date', { ascending: false })
  if (error) throw error
  // Đếm lô và tổng tiền cho mỗi chuyến
  return (data || []).map(t => ({
    ...t,
    lot_count:  t.jewelry_imports?.length || 0,
    total_cost: (t.jewelry_imports || []).reduce(
      (s, i) => s + (Number(i.qty)||0) * (Number(i.cost_per_unit)||0), 0
    ),
    jewelry_imports: undefined,
  }))
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
  // ON DELETE SET NULL → lô nhập giữ nguyên, chỉ mất liên kết
  const { error } = await supabase
    .from('jewelry_trips').delete().eq('id', id)
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
