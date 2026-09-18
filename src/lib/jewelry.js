// ============================================
// JEWELRY LIB - Trang sức
// ============================================
import { supabase } from './supabase'

const BUCKET = 'jewelry-images'

// ============================================
// NGÀY GIỜ THEO MÚI GIỜ VIỆT NAM (UTC+7)
// Ép cố định, không phụ thuộc máy — để khi đi nước ngoài
// nhập hàng, mốc thời gian vẫn là giờ Việt Nam.
// ============================================
export const VN_TZ = 'Asia/Ho_Chi_Minh'

// Lấy từng phần ngày giờ theo giờ VN
function vnParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return null
  try {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const o = {}
    for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = p.value
    // hour có thể là '24' ở một số môi trường → đưa về '00'
    if (o.hour === '24') o.hour = '00'
    return o
  } catch {
    // Môi trường không hỗ trợ Intl → tự cộng 7 tiếng
    const t = new Date(d.getTime() + 7 * 3600 * 1000)
    return {
      year:  String(t.getUTCFullYear()),
      month: String(t.getUTCMonth() + 1).padStart(2, '0'),
      day:   String(t.getUTCDate()).padStart(2, '0'),
      hour:  String(t.getUTCHours()).padStart(2, '0'),
      minute:String(t.getUTCMinutes()).padStart(2, '0'),
    }
  }
}

// '2026-09-17' theo giờ VN
export function todayLocal(date = new Date()) {
  const p = vnParts(date)
  return p ? `${p.year}-${p.month}-${p.day}` : ''
}

// '2026-09' theo giờ VN
export function monthLocal(date = new Date()) {
  return todayLocal(date).slice(0, 7)
}

// '14:35' theo giờ VN
export function timeLocal(date = new Date()) {
  const p = vnParts(date)
  return p ? `${p.hour}:${p.minute}` : ''
}

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

function cleanJewelry(item) {
  const out = { ...item }
  if ('stock_qty'    in out) out.stock_qty    = nonNeg(out.stock_qty)
  if ('incoming_qty' in out) out.incoming_qty = nonNeg(out.incoming_qty)
  if ('cost_price' in out && out.cost_price != null) out.cost_price = nonNeg(out.cost_price)
  if ('sell_price' in out && out.sell_price != null) out.sell_price = nonNeg(out.sell_price)
  return out
}

export async function createJewelry(item) {
  const payload = cleanJewelry(item)
  // Hàng đặt chưa về → số lượng nằm ở cột "đang về", tồn kho bằng 0
  if (payload.status === 'ordered') {
    payload.incoming_qty = nonNeg(payload.stock_qty)
    payload.stock_qty    = 0
  }
  const { data, error } = await supabase
    .from('jewelry').insert([payload]).select().single()
  if (error) throw error
  // Chỉ ghi sổ khi hàng THỰC SỰ vào kho.
  // Hàng đang về sẽ được ghi lúc bấm "Hàng đã về" (receiveOrder),
  // ghi cả hai chỗ sẽ đếm hàng hai lần.
  if (data.status !== 'ordered') {
    await logIntake({
      jewelry_id: data.id, qty: data.stock_qty, cost_price: data.cost_price,
      supplier_name: data.supplier_name, trip_id: data.trip_id, source: 'new',
    }).catch(() => {})
  }
  return data
}

// Tìm sản phẩm theo mã (không phân biệt hoa thường)
export async function findJewelryByCode(code) {
  const c = String(code || '').trim()
  if (!c) return null
  const { data } = await supabase
    .from('jewelry').select('*').ilike('code', c).maybeSingle()
  return data || null
}

// Nhập thêm cho mã đã có — cộng dồn tồn, tính lại giá vốn trung bình
// Nhập thêm cho mã đã có.
// mode 'in_stock'  → hàng đã cầm trong tay, cộng vào tồn kho
// mode 'ordered'   → hàng mới đặt, cộng vào cột "đang về", tồn kho không đổi
export async function addStockToExisting(id, addQty, newItem = {}) {
  const { data: cur, error: ge } = await supabase
    .from('jewelry').select('*').eq('id', id).single()
  if (ge) throw ge

  const add = nonNeg(addQty)
  // Nhập vào đâu: theo status truyền lên. Nếu không nói rõ thì giữ nguyên
  // trạng thái hiện tại của món — hàng đang về không tự nhảy vào kho.
  const toIncoming = newItem.status
    ? newItem.status === 'ordered'
    : cur.status === 'ordered'

  const oldStock    = nonNeg(cur.stock_qty)
  const oldIncoming = nonNeg(cur.incoming_qty)

  // Giá vốn bình quân tính trên tổng số cái sẽ có (tồn + đang về)
  const oldTotal = oldStock + oldIncoming
  const newTotal = oldTotal + add
  let costPrice = cur.cost_price
  const newCost = newItem.cost_price != null && newItem.cost_price !== ''
    ? nonNeg(newItem.cost_price) : null
  if (newCost != null && newTotal > 0) {
    const oldCost = nonNeg(cur.cost_price)
    costPrice = oldTotal > 0
      ? Math.round((oldCost * oldTotal + newCost * add) / newTotal)
      : newCost
  }

  const patch = { cost_price: costPrice, updated_at: new Date().toISOString() }
  if (toIncoming) {
    patch.incoming_qty = oldIncoming + add   // tồn kho giữ nguyên
  } else {
    patch.stock_qty = oldStock + add
    // Hàng đang về mà nhập thẳng vào kho → coi như đã về
    if (cur.status === 'ordered') patch.status = 'in_stock'
  }

  for (const f of ['sell_price','supplier_name','supplier_contact','note','size','trip_id',
                   'tracking_number','order_date','eta_date']) {
    const v = newItem[f]
    if (v !== undefined && v !== null && v !== '') patch[f] = v
  }

  const { data, error } = await supabase
    .from('jewelry').update(patch).eq('id', id).select().single()
  if (error) throw error

  // Chỉ ghi sổ khi hàng thực sự vào kho
  if (!toIncoming) {
    await logIntake({
      jewelry_id: id, qty: add, cost_price: newCost ?? cur.cost_price,
      supplier_name: newItem.supplier_name || cur.supplier_name,
      trip_id: newItem.trip_id || cur.trip_id,
      source: newItem.source || 'merge',
      note: newItem.intake_note,
    }).catch(() => {})
  }

  return {
    item: data, added: add, toIncoming,
    oldStock, newStock: toIncoming ? oldStock : oldStock + add,
    oldIncoming, newIncoming: toIncoming ? oldIncoming + add : oldIncoming,
    oldCost: cur.cost_price, newCost: costPrice,
    // giữ tên cũ cho chỗ nào còn dùng
    oldQty: oldStock, total: toIncoming ? oldStock : oldStock + add,
  }
}

export async function updateJewelry(id, updates) {
  // Món đang về: ô "Số lượng đặt" phải ghi vào cột hàng đang về,
  // không phải tồn kho — nếu không hàng chưa về sẽ thành bán được.
  if ('stock_qty' in updates) {
    const { data: cur } = await supabase
      .from('jewelry').select('status').eq('id', id).maybeSingle()
    const goingToOrdered = updates.status
      ? updates.status === 'ordered'
      : cur?.status === 'ordered'
    if (goingToOrdered) {
      updates = { ...updates, incoming_qty: nonNeg(updates.stock_qty), stock_qty: 0 }
    }
  }

  // Đổi ảnh → xoá ảnh cũ khỏi Storage để không tích tụ file mồ côi
  if ('image_url' in updates) {
    const { data: prev } = await supabase
      .from('jewelry').select('image_url').eq('id', id).maybeSingle()
    if (prev?.image_url && prev.image_url !== updates.image_url) {
      const path = prev.image_url.split('/').pop().split('?')[0]
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    }
  }
  const { error } = await supabase
    .from('jewelry')
    .update({ ...cleanJewelry(updates), updated_at: new Date().toISOString() })
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
  const sellQty  = Math.max(1, nonNeg(sale.qty, 1))
  const isInStock = !!sale.jewelry_id

  const row = {
    jewelry_id:     sale.jewelry_id || null,
    item_name:      sale.item_name?.trim() || null,
    item_image:     sale.item_image || null,
    qty:            sellQty,
    sell_price:     nonNeg(sale.sell_price),
    customer_name:  sale.customer_name?.trim()  || null,
    customer_phone: sale.customer_phone?.trim() || null,
    deposit:        sale.deposit ? nonNeg(sale.deposit) : null,
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
      .from('jewelry').select('stock_qty, incoming_qty, status').eq('id', sale.jewelry_id).single()
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
    const soldAhead = await getReserved(sale.jewelry_id)
    const limit = stockItem.status === 'ordered'
      ? nonNeg(stockItem.incoming_qty)
      : nonNeg(stockItem.stock_qty)
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
// Nhận hàng về: chuyển số thực nhận từ cột "đang về" sang tồn kho
export async function receiveOrder(jewelryId, actualQty) {
  const { data: item, error: ge } = await supabase
    .from('jewelry')
    .select('stock_qty, incoming_qty, code, cost_price, supplier_name, trip_id')
    .eq('id', jewelryId).single()
  if (ge) throw ge

  const received  = Number(actualQty)
  const ordered   = nonNeg(item.incoming_qty)   // số đã đặt, đang trên đường
  const oldStock  = nonNeg(item.stock_qty)      // số đã có sẵn trong tủ
  if (!(received >= 0)) throw new Error('Số lượng thực nhận không hợp lệ')

  // Đã bán trước bao nhiêu — phải đủ hàng để giao
  const soldAhead = await getReserved(jewelryId)
  if (oldStock + received < soldAhead) {
    throw new Error(`Đã bán trước ${soldAhead} cái — tổng sau khi nhận không được ít hơn`)
  }

  const newStock = oldStock + received

  const { error } = await supabase.from('jewelry').update({
    status:       'in_stock',
    stock_qty:    newStock,
    incoming_qty: 0,              // hết hàng đang về
    received_at:  todayLocal(),
    updated_at:   new Date().toISOString(),
  }).eq('id', jewelryId)
  if (error) throw error

  await logIntake({
    jewelry_id: jewelryId, qty: received,
    cost_price: item.cost_price, supplier_name: item.supplier_name,
    trip_id: item.trip_id, source: 'receive',
    note: received !== ordered ? `Đặt ${ordered}, nhận ${received}` : null,
  }).catch(() => {})

  return {
    received, ordered, soldAhead,
    oldStock, newStock,
    available: newStock - soldAhead,
  }
}

// Tick "đã giao" / "đã thanh toán"
export async function updateSaleStatus(saleId, field, value) {
  const today = todayLocal()
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

// Ép về số không âm — chặn dữ liệu rác lọt vào DB
function nonNeg(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// Số đã bán nhưng chưa giao của 1 sản phẩm, có thể bỏ qua 1 đơn (khi đang sửa đơn đó)
async function getReserved(jewelryId, exceptSaleId = null) {
  const { data } = await supabase
    .from('jewelry_sales').select('id, qty')
    .eq('jewelry_id', jewelryId).eq('delivered', false)
  return (data || [])
    .filter(s => s.id !== exceptSaleId)
    .reduce((sum, s) => sum + (Number(s.qty) || 0), 0)
}

export async function updateSale(saleId, updates) {
  const { data: old, error: ge } = await supabase
    .from('jewelry_sales').select('*').eq('id', saleId).single()
  if (ge) throw ge

  const newQty = Math.max(1, nonNeg(updates.qty, 1))
  const oldQty = nonNeg(old.qty)

  // Hàng có sẵn trong kho → phải kiểm tra tồn và điều chỉnh kho
  if (old.jewelry_id) {
    const { data: item, error: ie } = await supabase
      .from('jewelry').select('stock_qty, status, code').eq('id', old.jewelry_id).single()
    if (ie) throw ie

    const stock = Number(item.stock_qty) || 0

    if (old.delivered) {
      // Đơn ĐÃ giao: kho đã trừ oldQty rồi. Đổi số lượng → trừ/hoàn phần chênh lệch
      const diff = newQty - oldQty
      if (diff > 0 && diff > stock) {
        throw new Error(`Không đủ hàng — chỉ còn ${stock} cái để tăng thêm`)
      }
      if (diff !== 0) {
        const { error: ue } = await supabase.from('jewelry').update({
          stock_qty: stock - diff,
          updated_at: new Date().toISOString(),
        }).eq('id', old.jewelry_id)
        if (ue) throw ue
      }
    } else {
      // Đơn CHƯA giao: kho chưa trừ. Tổng đặt (không tính đơn này) + số mới ≤ tồn
      const reserved = await getReserved(old.jewelry_id, saleId)
      if (reserved + newQty > stock) {
        const left = Math.max(0, stock - reserved)
        throw new Error(item.status === 'ordered'
          ? `Chỉ còn ${left} cái đang về chưa bán`
          : `Chỉ còn ${left} cái — không bán quá tồn kho`)
      }
    }
  }

  const { error } = await supabase.from('jewelry_sales').update({
    item_name:      updates.item_name?.trim() || null,
    qty:            newQty,
    sell_price:     nonNeg(updates.sell_price),
    customer_name:  updates.customer_name?.trim()  || null,
    customer_phone: updates.customer_phone?.trim() || null,
    deposit:        updates.deposit ? nonNeg(updates.deposit) : null,
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
    .select('*, jewelry(id, stock_qty, incoming_qty, cost_price, status)')
    .order('trip_date', { ascending: false })
  if (error) throw error
  const valStock = list => list.reduce(
    (s, j) => s + (Number(j.stock_qty)||0) * (Number(j.cost_price)||0), 0)
  const valInc = list => list.reduce(
    (s, j) => s + (Number(j.incoming_qty)||0) * (Number(j.cost_price)||0), 0)
  return (data || []).map(t => {
    const all = t.jewelry || []
    const arrived  = all.filter(j => j.status !== 'ordered')
    const incoming = all.filter(j => (Number(j.incoming_qty)||0) > 0)
    return {
      ...t,
      item_count:     arrived.length,
      incoming_count: incoming.length,
      stock_value:    valStock(arrived),
      incoming_value: valInc(incoming),
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
  const thisMonth = monthLocal()

  // Một mã có thể vừa có hàng trong tủ, vừa có hàng đang về.
  // Tab Kho:     món đã từng về kho (status khác 'ordered')
  // Tab Đang về: món còn số lượng đang trên đường
  const incoming  = jewelry.filter(j => (Number(j.incoming_qty) || 0) > 0)
  const inStockJw = jewelry.filter(j => j.status !== 'ordered')

  const totalItems   = inStockJw.length
  const totalSold    = sales.reduce((s, x) => s + Number(x.qty), 0)
  const totalRevenue = sales.reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthSales   = sales.filter(s => s.sold_at?.startsWith(thisMonth))
  const monthRevenue = monthSales.reduce((s, x) => s + Number(x.qty) * Number(x.sell_price), 0)
  const monthActual  = monthSales.reduce((s, x) =>
    s + (x.paid ? Number(x.qty) * Number(x.sell_price) : (Number(x.deposit) || 0)), 0)
  const monthSalesCount = monthSales.length

  // Days in stock
  // Số đã bán nhưng chưa giao, theo từng sản phẩm
  const reservedMap = {}
  sales.filter(s => !s.delivered && s.jewelry_id).forEach(s => {
    reservedMap[s.jewelry_id] = (reservedMap[s.jewelry_id] || 0) + (Number(s.qty) || 0)
  })

  const withDays = inStockJw.map(j => {
    const days     = Math.floor((today - new Date(j.created_at)) / 86400000)
    const inStockQ = Number(j.stock_qty) || 0
    const reserved = reservedMap[j.id] || 0
    const available = Math.max(0, inStockQ - reserved)
    return {
      ...j,
      days_in_stock:   days,
      stock_remaining: inStockQ,      // tồn vật lý, chưa trừ đơn chờ giao
      reserved,                       // đã bán, chờ giao
      available,                      // còn bán được
      // 'ok' còn hàng · 'reserved' hết hàng bán nhưng đang chờ giao · 'out' hết sạch
      stock_state: available > 0 ? 'ok' : (reserved > 0 ? 'reserved' : 'out'),
      incoming:        nonNeg(j.incoming_qty),   // đang trên đường về
      entry_date:      j.received_at || (j.created_at || '').slice(0, 10),
      is_new:          days <= 3,
      needs_photo:     !j.image_url,
    }
  })

  const inStock = withDays.filter(j => j.available > 0).length

  const slowMoving = withDays
    .filter(j => j.available > 0 && j.days_in_stock >= 30)
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
  const today10 = todayLocal()
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
      (s, j) => s + (Number(j.incoming_qty)||0) * (Number(j.cost_price)||0), 0
    ),
    incomingLate: incoming.filter(j =>
      j.eta_date && j.eta_date < todayLocal()).length,
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
  if ('image_url' in m) {
    const { data: prev } = await supabase
      .from('jewelry_mounts').select('image_url').eq('id', id).maybeSingle()
    if (prev?.image_url && prev.image_url !== m.image_url) {
      const path = prev.image_url.split('/').pop().split('?')[0]
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    }
  }
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
  const num = v => (v === '' || v === null || v === undefined) ? null : nonNeg(v)
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
    let merge = false
    if (!code) errors.push('thiếu mã')
    else if (seen.has(code.toLowerCase()))    errors.push('mã trùng trong file')
    else if (codeSet.has(code.toLowerCase())) merge = true   // sẽ cộng dồn vào SP có sẵn
    if (code) seen.add(code.toLowerCase())

    if (categories.length && data.category && !categories.includes(data.category))
      errors.push(`loại "${data.category}" chưa có`)
    if (data.stock_qty != null && data.stock_qty < 0) errors.push('số lượng âm')

    return { line: i + 2, data, errors, merge, ok: errors.length === 0 }
  })

  return { rows, error: null }
}

// Lưu hàng loạt — chia lô để tránh quá tải
export async function bulkCreateJewelry(rows, { status = 'in_stock', trip_id = null } = {}) {
  const newRows   = rows.filter(r => !r.merge)
  const mergeRows = rows.filter(r =>  r.merge)

  let inserted = 0, merged = 0
  const failed = []

  // --- Nhóm 1: thêm mới ---
  const payload = newRows.map(r => {
    const row = cleanJewelry({ ...r.data, status, trip_id, image_url: null })
    // Nhập vào tab Đang về → số lượng là hàng đang trên đường, tồn kho = 0
    if (status === 'ordered') {
      row.incoming_qty = nonNeg(row.stock_qty)
      row.stock_qty    = 0
    }
    return row
  })
  const SIZE = 50
  for (let i = 0; i < payload.length; i += SIZE) {
    const chunk = payload.slice(i, i + SIZE)
    const { data, error } = await supabase.from('jewelry').insert(chunk).select('id, stock_qty, cost_price, supplier_name, trip_id')
    if (error) {
      for (const one of chunk) {
        const { data: d1, error: e1 } = await supabase.from('jewelry').insert([one])
          .select('id, stock_qty, cost_price, supplier_name, trip_id').single()
        if (e1) failed.push({ code: one.code, message: e1.message })
        else { inserted++; if (status !== 'ordered') await logIntake({ ...d1, jewelry_id: d1.id, qty: d1.stock_qty, source: 'csv' }).catch(()=>{}) }
      }
    } else {
      inserted += data?.length || chunk.length
      if (status !== 'ordered') {
        for (const d of (data || [])) {
          await logIntake({ ...d, jewelry_id: d.id, qty: d.stock_qty, source: 'csv' }).catch(()=>{})
        }
      }
    }
  }

  // --- Nhóm 2: cộng dồn vào mã đã có ---
  for (const r of mergeRows) {
    try {
      const exist = await findJewelryByCode(r.data.code)
      if (!exist) {
        // Mã biến mất giữa chừng → thêm mới
        const one = cleanJewelry({ ...r.data, status, trip_id, image_url: null })
        if (status === 'ordered') { one.incoming_qty = nonNeg(one.stock_qty); one.stock_qty = 0 }
        const { data: dn, error } = await supabase.from('jewelry')
          .insert([one])
          .select('id, stock_qty, cost_price, supplier_name, trip_id').single()
        if (error) failed.push({ code: r.data.code, message: error.message })
        else { inserted++; if (status !== 'ordered') await logIntake({ ...dn, jewelry_id: dn.id, qty: dn.stock_qty, source: 'csv' }).catch(()=>{}) }
        continue
      }
      await addStockToExisting(exist.id, r.data.stock_qty, { ...r.data, status, trip_id, source: 'csv' })
      merged++
    } catch (e) {
      failed.push({ code: r.data.code, message: e.message })
    }
  }

  return { inserted, merged, failed }
}

// ============================================
// SỔ NHẬP HÀNG — ghi nhận mỗi lần nhập
// Chỉ để tra cứu, KHÔNG tham gia tính tồn kho
// ============================================
export async function logIntake({ jewelry_id, qty, cost_price, supplier_name,
                                  trip_id, source = 'new', note }) {
  const n = nonNeg(qty)
  if (!jewelry_id || n <= 0) return null
  const { data, error } = await supabase.from('jewelry_intakes').insert([{
    jewelry_id,
    qty:           n,
    cost_price:    cost_price != null && cost_price !== '' ? nonNeg(cost_price) : null,
    supplier_name: supplier_name?.trim() || null,
    trip_id:       trip_id || null,
    source,
    note:          note?.trim() || null,
    intake_at:     new Date().toISOString(),
  }]).select().single()
  if (error) {
    // Ghi sổ hỏng không được chặn việc nhập hàng
    console.warn('Không ghi được sổ nhập:', error.message)
    return null
  }
  return data
}

// Lịch sử nhập của 1 sản phẩm
export async function getIntakes(jewelryId) {
  const { data, error } = await supabase
    .from('jewelry_intakes')
    .select('*, jewelry_trips(name)')
    .eq('jewelry_id', jewelryId)
    .order('intake_at', { ascending: false })
  if (error) throw error
  return (data || []).map(r => ({
    ...r,
    trip_name: r.jewelry_trips?.name || null,
    jewelry_trips: undefined,
  }))
}

// Toàn bộ sổ nhập, lọc theo khoảng thời gian hoặc chuyến
export async function getAllIntakes({ from, to, tripId, limit = 300 } = {}) {
  let q = supabase
    .from('jewelry_intakes')
    .select('*, jewelry(code, name, image_url), jewelry_trips(name)')
    .order('intake_at', { ascending: false })
    .limit(limit)
  if (from)   q = q.gte('intake_at', from)
  if (to)     q = q.lte('intake_at', to)
  if (tripId) q = q.eq('trip_id', tripId)
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(r => ({
    ...r,
    code:      r.jewelry?.code || null,
    name:      r.jewelry?.name || null,
    image_url: r.jewelry?.image_url || null,
    trip_name: r.jewelry_trips?.name || null,
    jewelry: undefined, jewelry_trips: undefined,
  }))
}

export async function deleteIntake(id) {
  const { error } = await supabase.from('jewelry_intakes').delete().eq('id', id)
  if (error) throw error
}

// Gộp theo ngày để hiển thị
export function groupIntakesByDay(list) {
  const map = {}
  list.forEach(r => {
    // Lấy ngày theo giờ máy, không cắt chuỗi UTC
    const d = r.intake_at ? todayLocal(new Date(r.intake_at)) : ''
    if (!map[d]) map[d] = { date: d, rows: [], totalQty: 0, totalCost: 0 }
    map[d].rows.push(r)
    map[d].totalQty  += Number(r.qty) || 0
    map[d].totalCost += (Number(r.qty) || 0) * (Number(r.cost_price) || 0)
  })
  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date))
}

// Giờ:phút theo máy người dùng
// Ngày của một lần nhập, theo giờ máy
export function intakeDate(iso) {
  return iso ? todayLocal(new Date(iso)) : ''
}

export function fmtIntakeTime(iso) {
  return iso ? timeLocal(new Date(iso)) : ''
}
