import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

// Format tiền VND
export function formatMoney(amount) {
  if (!amount && amount !== 0) return '0đ'
  
  const num = Number(amount)
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace('.0', '') + 'tr'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'k'
  }
  return num.toLocaleString('vi-VN') + 'đ'
}

// Format tiền đầy đủ
export function formatMoneyFull(amount) {
  if (!amount && amount !== 0) return '0 đ'
  return Number(amount).toLocaleString('vi-VN') + ' đ'
}

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
