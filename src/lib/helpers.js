import { format, formatDistanceToNow, isToday, isYesterday, parseISO, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subQuarters, subYears } from 'date-fns'
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

// Tính chiết khấu
export function calcDiscount(amount, discountPercent) {
  if (!discountPercent || discountPercent === 0) return 0
  return (amount * discountPercent) / 100
}

// Tính thành tiền sau chiết khấu
export function calcFinalAmount(amount, discountPercent) {
  const discount = calcDiscount(amount, discountPercent)
  return amount - discount
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

// ============================================
// LỌC THỜI GIAN NÂNG CAO
// ============================================

// Lấy ngày đầu tháng
export function getStartOfMonth(date = new Date()) {
  return startOfMonth(date)
}

// Lấy ngày cuối tháng
export function getEndOfMonth(date = new Date()) {
  return endOfMonth(date)
}

// Lấy ngày đầu quý
export function getStartOfQuarter(date = new Date()) {
  return startOfQuarter(date)
}

// Lấy ngày cuối quý
export function getEndOfQuarter(date = new Date()) {
  return endOfQuarter(date)
}

// Lấy ngày đầu năm
export function getStartOfYear(date = new Date()) {
  return startOfYear(date)
}

// Lấy ngày cuối năm
export function getEndOfYear(date = new Date()) {
  return endOfYear(date)
}

// Lấy tháng trước
export function getPreviousMonth(date = new Date(), months = 1) {
  return subMonths(date, months)
}

// Lấy quý trước
export function getPreviousQuarter(date = new Date(), quarters = 1) {
  return subQuarters(date, quarters)
}

// Lấy năm trước
export function getPreviousYear(date = new Date(), years = 1) {
  return subYears(date, years)
}

// Lấy số quý hiện tại (1-4)
export function getCurrentQuarter(date = new Date()) {
  return Math.ceil((date.getMonth() + 1) / 3)
}

// Format quý/năm
export function formatQuarterYear(date = new Date()) {
  const quarter = getCurrentQuarter(date)
  const year = date.getFullYear()
  return `Q${quarter}/${year}`
}

// Tạo date range theo preset
export function getDateRangePreset(preset) {
  const now = new Date()

  switch (preset) {
    case 'this_month':
      return {
        startDate: toInputDate(getStartOfMonth(now)),
        endDate: toInputDate(getEndOfMonth(now)),
        label: `Tháng ${format(now, 'MM/yyyy')}`
      }
    case 'last_month':
      const lastMonth = getPreviousMonth(now)
      return {
        startDate: toInputDate(getStartOfMonth(lastMonth)),
        endDate: toInputDate(getEndOfMonth(lastMonth)),
        label: `Tháng ${format(lastMonth, 'MM/yyyy')}`
      }
    case 'this_quarter':
      return {
        startDate: toInputDate(getStartOfQuarter(now)),
        endDate: toInputDate(getEndOfQuarter(now)),
        label: formatQuarterYear(now)
      }
    case 'last_quarter':
      const lastQuarter = getPreviousQuarter(now)
      return {
        startDate: toInputDate(getStartOfQuarter(lastQuarter)),
        endDate: toInputDate(getEndOfQuarter(lastQuarter)),
        label: formatQuarterYear(lastQuarter)
      }
    case 'this_year':
      return {
        startDate: toInputDate(getStartOfYear(now)),
        endDate: toInputDate(getEndOfYear(now)),
        label: `Năm ${now.getFullYear()}`
      }
    case 'last_year':
      const lastYear = getPreviousYear(now)
      return {
        startDate: toInputDate(getStartOfYear(lastYear)),
        endDate: toInputDate(getEndOfYear(lastYear)),
        label: `Năm ${lastYear.getFullYear()}`
      }
    case 'all':
      return {
        startDate: '2020-01-01',
        endDate: toInputDate(now),
        label: 'Tất cả'
      }
    default:
      return {
        startDate: toInputDate(getStartOfMonth(now)),
        endDate: toInputDate(getEndOfMonth(now)),
        label: `Tháng ${format(now, 'MM/yyyy')}`
      }
  }
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

// ============================================
// XUẤT EXCEL
// ============================================

// Chuyển data thành CSV string
export function arrayToCSV(data, columns) {
  if (!data || data.length === 0) return ''

  // Header
  const header = columns.map(col => col.label).join(',')

  // Rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value = typeof col.key === 'function' ? col.key(item) : item[col.key]
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        value = `"${value.replace(/"/g, '""')}"`
      }
      return value ?? ''
    }).join(',')
  })

  return [header, ...rows].join('\n')
}

// Download CSV file
export function downloadCSV(csvString, filename) {
  // Add BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Format số điện thoại
export function formatPhone(phone) {
  if (!phone) return ''
  // Remove non-digits
  const digits = phone.replace(/\D/g, '')
  // Format: 0912 345 678
  if (digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

// Tạo link gọi điện
export function getPhoneLink(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return `tel:${digits}`
}

// Tạo link Zalo
export function getZaloLink(phone) {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  return `https://zalo.me/${digits}`
}
