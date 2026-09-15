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

export function thumbUrl(url, width = 200) {
  if (!url) return null
  try {
    return url.replace('/object/public/', '/render/image/public/') + `?width=${width}&quality=60`
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

export async function createSale(sale) {
  const { data: item, error: ge } = await supabase
    .from('jewelry').select('stock_qty').eq('id', sale.jewelry_id).single()
  if (ge) throw ge
  const currentQty = Number(item.stock_qty) || 0
  const sellQty    = Number(sale.qty) || 1
  if (sellQty > currentQty) throw new Error(`Không đủ hàng — tồn kho chỉ còn ${currentQty} cái`)
  const newQty = currentQty - sellQty
  const [r1, r2] = await Promise.all([
    supabase.from('jewelry_sales').insert([{
      jewelry_id:    sale.jewelry_id,
      qty:           sale.qty,
      sell_price:    sale.sell_price,
      customer_name: sale.customer_name?.trim() || null,
      note:          sale.note?.trim() || null,
      sold_at:       sale.sold_at,
    }]).select().single(),
    supabase.from('jewelry').update({
      stock_qty: newQty,
      updated_at: new Date().toISOString(),
    }).eq('id', sale.jewelry_id),
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
// TRIPS CRUD
// ============================================
export async function getJewelryTrips() {
  const { data, error } = await supabase
    .from('jewelry_trips')
    .select('*, jewelry(id, stock_qty, cost_price)')
    .order('trip_date', { ascending: false })
  if (error) throw error
  return (data || []).map(t => ({
    ...t,
    item_count:  t.jewelry?.length || 0,
    // Giá trị tồn kho hiện tại của chuyến (stock còn × giá vốn)
    stock_value: (t.jewelry || []).reduce(
      (s, j) => s + (Number(j.stock_qty)||0) * (Number(j.cost_price)||0), 0
    ),
    jewelry: undefined,
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

  const totalItems   = jewelry.length
  const inStock      = jewelry.filter(j => Number(j.stock_qty) > 0).length
  const totalSold    = sales.reduce((s, x) => s + Number(x.qty), 0)
  const totalRevenue = sales.reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthRevenue = sales
    .filter(s => s.sold_at?.startsWith(thisMonth))
    .reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthSalesCount = sales.filter(s => s.sold_at?.startsWith(thisMonth)).length

  // Days in stock
  const withDays = jewelry.map(j => ({
    ...j,
    days_in_stock:   Math.floor((today - new Date(j.created_at)) / 86400000),
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

  return {
    totalItems, inStock, totalSold, totalRevenue,
    monthRevenue, monthSalesCount,
    slowMovingCount: slowMoving.length,
    slowMoving, bestSellers, customers, saleLog, withDays, catRevenue,
    stockValue: jewelry.reduce(
      (s, j) => s + (Number(j.stock_qty)||0) * (Number(j.sell_price)||0), 0
    ),
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
