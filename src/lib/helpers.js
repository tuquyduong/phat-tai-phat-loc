import { format, formatDistanceToNow, isToday, isYesterday, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { vi } from 'date-fns/locale'

// ============================================
// TIỀN TỆ
// ============================================

// Format tiền VND - Rút gọn (cho hiển thị compact)
export function formatMoney(amount) {
  if (!amount && amount !== 0) return '0đ'

  const num = Number(amount)
  if (num >= 1000000) {
    const formatted = (num / 1000000)
    if (formatted === Math.floor(formatted)) {
      return formatted + 'tr'
    }
    return formatted.toFixed(1) + 'tr'
  }
  if (num >= 1000) {
    const formatted = (num / 1000)
    if (formatted === Math.floor(formatted)) {
      return formatted + 'k'
    }
    return formatted.toFixed(1) + 'k'
  }
  return num.toLocaleString('vi-VN') + 'đ'
}

// Format tiền đầy đủ - Chính xác (cho form, báo cáo)
export function formatMoneyFull(amount) {
  if (!amount && amount !== 0) return '0 đ'
  const num = Number(amount)
  // Hỗ trợ số thập phân - hiển thị đúng 31,666.67đ
  return num.toLocaleString('vi-VN', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  }) + ' đ'
}

// Tính đơn giá từ tổng tiền
export function calcUnitPrice(totalAmount, quantity) {
  if (!quantity || quantity === 0) return 0
  return totalAmount / quantity
}

// Tính tổng tiền từ đơn giá
export function calcTotalAmount(unitPrice, quantity) {
  return (unitPrice || 0) * (quantity || 0)
}

// ============================================
// NGÀY THÁNG
// ============================================

// Format ngày thân thiện
export function formatDate(dateString) {
  if (!dateString) return ''

  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString

  if (isToday(date)) {
    return 'Hôm nay'
  }
  if (isYesterday(date)) {
    return 'Hôm qua'
  }

  return format(date, 'dd/MM/yyyy', { locale: vi })
}

// Format ngày ngắn
export function formatDateShort(dateString) {
  if (!dateString) return ''
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
  return format(date, 'dd/MM', { locale: vi })
}

// Format ngày đầy đủ
export function formatDateFull(dateString) {
  if (!dateString) return ''
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
  return format(date, 'EEEE, dd/MM/yyyy', { locale: vi })
}

// Format tháng/năm
export function formatMonthYear(dateString) {
  if (!dateString) return ''
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
  return format(date, 'MM/yyyy', { locale: vi })
}

// Thời gian tương đối
export function formatTimeAgo(dateString) {
  if (!dateString) return ''
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
  return formatDistanceToNow(date, { addSuffix: true, locale: vi })
}

// Format cho input date
export function toInputDate(dateString) {
  if (!dateString) {
    return format(new Date(), 'yyyy-MM-dd')
  }
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString
  return format(date, 'yyyy-MM-dd')
}

// Lấy ngày đầu tháng
export function getStartOfMonth(date = new Date()) {
  return startOfMonth(date)
}

// Lấy ngày cuối tháng
export function getEndOfMonth(date = new Date()) {
  return endOfMonth(date)
}

// Lấy tháng trước
export function getPreviousMonth(date = new Date(), months = 1) {
  return subMonths(date, months)
}

// ============================================
// TÍNH TOÁN
// ============================================

// Tính tổng từ array
export function sumBy(array, key) {
  return array?.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) || 0
}

// Tính % progress
export function calcProgress(current, total) {
  if (!total || total === 0) return 0
  const progress = (current / total) * 100
  return Math.min(100, Math.max(0, progress))
}

// Lấy màu theo % progress
export function getProgressColor(percent) {
  if (percent >= 100) return 'bg-green-500'
  if (percent >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

// Lấy màu text theo % công nợ
export function getDebtColor(paid, total) {
  const percent = calcProgress(paid, total)
  if (percent >= 100) return 'text-green-600'
  if (percent >= 50) return 'text-amber-600'
  return 'text-red-600'
}

// Group array theo key
export function groupBy(array, key) {
  return array?.reduce((groups, item) => {
    const value = typeof key === 'function' ? key(item) : item[key]
    if (!groups[value]) {
      groups[value] = []
    }
    groups[value].push(item)
    return groups
  }, {}) || {}
}

// Sắp xếp array theo key
export function sortBy(array, key, desc = false) {
  return [...(array || [])].sort((a, b) => {
    const aVal = typeof key === 'function' ? key(a) : a[key]
    const bVal = typeof key === 'function' ? key(b) : b[key]
    if (desc) return bVal - aVal
    return aVal - bVal
  })
}
