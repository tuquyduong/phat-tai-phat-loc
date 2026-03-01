// ============================================
// HOME PAGE - UPDATED
// Thêm: Đổi mật khẩu + Backup/Restore
// ============================================
import { useState, useMemo } from 'react'
import { RefreshCw, Lock, Download, Upload, Database, Eye, EyeOff } from 'lucide-react'
import { formatMoney, sumBy } from '../lib/helpers'
import { setPassword, checkPassword, supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

// Backup tables list
const BACKUP_TABLES = [
  'customers', 'orders', 'deliveries', 'payments', 'products', 'settings',
  'app_config', 'transactions', 'ingredients', 'formulas', 'formula_ingredients',
  'lab_notes', 'stocks', 'stock_transactions', 'dividends'
]

export default function Home({ orders = [], customers = [], onNavigate, onRefresh, activeModules }) {
  const toast = useToast()

  // Password states
  const [showSecurity, setShowSecurity] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  // Backup states
  const [backupLoading, setBackupLoading] = useState(false)

  // Stats (giữ nguyên)
  const stats = useMemo(() => {
    const pending = orders.filter(o => o.status !== 'completed')
    let totalDebt = 0
    const debtorSet = new Set()
    let needDelivery = 0

    pending.forEach(o => {
      const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)
      const paid = o.payments
        ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
        ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const debt = totalAmount - paid
      if (debt > 0) { totalDebt += debt; debtorSet.add(o.customer_id) }
      const delivered = sumBy(o.deliveries, 'quantity')
      if (delivered < o.quantity) needDelivery++
    })

    return { pendingCount: pending.length, totalDebt, debtorCount: debtorSet.size, needDelivery, totalOrders: orders.length, customerCount: customers.length }
  }, [orders, customers])

  const alertCount = useMemo(() => {
    let count = 0
    const now = new Date()
    orders.forEach(o => {
      if (o.status === 'completed') return
      const days = Math.floor((now - new Date(o.order_date)) / 86400000)
      const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)
      const paid = o.payments
        ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
        ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const delivered = sumBy(o.deliveries, 'quantity')
      if (delivered < o.quantity && days > 3) count++
      if (totalAmount - paid > 0 && days > 7) count++
    })
    return count
  }, [orders])

  // Module cards (giữ nguyên)
  const modules = [
    { id: 'orders', icon: '📦', label: 'Đơn hàng', value: `${stats.pendingCount} đơn`, sub: `Công nợ: ${formatMoney(stats.totalDebt)}`, color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'expenses', icon: '💰', label: 'Thu Chi', value: 'Mở →', sub: 'Quản lý thu chi', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'lab', icon: '🧪', label: 'Lab Hub', value: 'Mở →', sub: 'Công thức & Nguyên liệu', color: '#8B5CF6', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'invest', icon: '📈', label: 'Đầu tư', value: 'Mở →', sub: 'Danh mục chứng khoán', color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200' },
  ]
  const visibleModules = modules.filter(m => m.id === 'orders' || activeModules.includes(m.id))

  // ============================================
  // ĐỔI MẬT KHẨU
  // ============================================
  const handleChangePassword = async () => {
    if (!currentPw) { toast.error('Nhập mật khẩu hiện tại'); return }
    if (!newPw) { toast.error('Nhập mật khẩu mới'); return }
    if (newPw.length < 4) { toast.error('Mật khẩu mới tối thiểu 4 ký tự'); return }
    if (newPw !== confirmPw) { toast.error('Xác nhận mật khẩu không khớp'); return }

    setPwLoading(true)
    try {
      const valid = await checkPassword(currentPw)
      if (!valid) { toast.error('Mật khẩu hiện tại không đúng'); return }
      await setPassword(newPw)
      toast.success('Đã đổi mật khẩu thành công!')
      setCurrentPw(''); setNewPw(''); setConfirmPw(''); setShowSecurity(false)
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally { setPwLoading(false) }
  }

  // ============================================
  // BACKUP
  // ============================================
  const handleBackup = async () => {
    setBackupLoading(true)
    try {
      const backup = { version: '2.4', created_at: new Date().toISOString(), tables: {} }
      for (const table of BACKUP_TABLES) {
        try {
          const { data, error } = await supabase.from(table).select('*')
          if (!error && data) backup.tables[table] = data
        } catch {}
      }
      backup.localStorage = { order_tracker_settings: localStorage.getItem('order_tracker_settings') }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chimai_backup_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const totalRows = Object.values(backup.tables).reduce((s, t) => s + t.length, 0)
      toast.success(`Đã tải backup: ${Object.keys(backup.tables).length} bảng, ${totalRows} dòng`)
    } catch (err) { toast.error('Lỗi backup: ' + err.message) }
    finally { setBackupLoading(false) }
  }

  // ============================================
  // RESTORE
  // ============================================
  const handleRestore = async () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!confirm('⚠️ CẢNH BÁO: Restore sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại!\n\nBạn chắc chắn muốn tiếp tục?')) return

      setBackupLoading(true)
      try {
        const text = await file.text()
        const backup = JSON.parse(text)
        if (!backup.tables || !backup.version) { toast.error('File backup không hợp lệ'); return }

        const restoreOrder = [
          'settings', 'app_config', 'customers', 'products',
          'orders', 'deliveries', 'payments',
          'ingredients', 'formulas', 'formula_ingredients', 'lab_notes',
          'stocks', 'stock_transactions', 'dividends', 'transactions'
        ]

        let restored = 0
        for (const table of restoreOrder) {
          const rows = backup.tables[table]
          if (!rows || rows.length === 0) continue
          try {
            if (table === 'settings') {
              await supabase.from(table).delete().neq('key', '')
            } else {
              await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
            }
            const { error } = await supabase.from(table).insert(rows)
            if (!error) restored += rows.length
          } catch {}
        }
        if (backup.localStorage?.order_tracker_settings) {
          localStorage.setItem('order_tracker_settings', backup.localStorage.order_tracker_settings)
        }
        toast.success(`Đã restore ${restored} dòng dữ liệu. Đang reload...`)
        setTimeout(() => window.location.reload(), 1500)
      } catch (err) { toast.error('Lỗi restore: ' + err.message) }
      finally { setBackupLoading(false) }
    }
    input.click()
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="pb-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 pt-4 pb-6"
        style={{ borderRadius: '0 0 1.5rem 1.5rem' }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold">Chi Mai</h1>
              <p className="text-green-200 text-xs">Phát Tài Phát Lộc</p>
            </div>
            <button onClick={onRefresh} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between text-center">
              <div className="flex-1">
                <p className="text-green-100 text-xs">Đang xử lý</p>
                <p className="text-xl font-bold">{stats.pendingCount}</p>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="flex-1">
                <p className="text-green-100 text-xs">Công nợ</p>
                <p className="text-xl font-bold">{formatMoney(stats.totalDebt)}</p>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div className="flex-1">
                <p className="text-green-100 text-xs">Cần xử lý</p>
                <p className="text-xl font-bold">{alertCount > 0 ? `🔔 ${alertCount}` : '✅ 0'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="grid grid-cols-2 gap-3">
          {visibleModules.map(m => (
            <button key={m.id} onClick={() => onNavigate(m.id)}
              className={`${m.bg} ${m.border} border rounded-xl p-4 text-left transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98]`}>
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-xs font-bold" style={{ color: m.color }}>{m.label}</div>
              <div className="text-base font-bold text-gray-800 mt-0.5">{m.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alertCount > 0 && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-red-700 text-sm">🔔 Cần xử lý ({alertCount})</span>
              <button onClick={() => onNavigate('orders')} className="text-xs text-red-500 font-bold">Xem đơn hàng →</button>
            </div>
            <div className="space-y-1.5">
              {orders.filter(o => o.status !== 'completed').slice(0, 3).map(o => {
                const days = Math.floor((new Date() - new Date(o.order_date)) / 86400000)
                const totalAmount = Number(o.final_amount) || (o.quantity * o.unit_price)
                const paid = o.payments
                  ?.filter(p => p.type === 'payment' || p.type === 'balance_used' || !p.type)
                  ?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
                const delivered = sumBy(o.deliveries, 'quantity')
                const hasDeliveryAlert = delivered < o.quantity && days > 3
                const hasPaymentAlert = totalAmount - paid > 0 && days > 7
                if (!hasDeliveryAlert && !hasPaymentAlert) return null
                return (
                  <div key={o.id} className="text-xs text-red-600">
                    {hasDeliveryAlert && <p>📦 {o.customer?.name}: chưa giao đủ ({days} ngày)</p>}
                    {hasPaymentAlert && <p>💰 {o.customer?.name}: nợ {formatMoney(totalAmount - paid)}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* HỆ THỐNG: Bảo mật + Backup */}
      {/* ============================================ */}
      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hệ thống</p>

        {/* Đổi mật khẩu - Collapsible */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setShowSecurity(!showSecurity)}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50">
            <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Lock size={16} className="text-purple-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-gray-800">Đổi mật khẩu</p>
              <p className="text-xs text-gray-400">Thay đổi mật khẩu đăng nhập</p>
            </div>
            <ChevronIcon open={showSecurity} />
          </button>

          {showSecurity && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {/* Mật khẩu hiện tại */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mật khẩu hiện tại</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)} placeholder="Nhập mật khẩu hiện tại"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm pr-10" />
                  <button onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mật khẩu mới</label>
                <input type={showPw ? 'text' : 'password'} value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="Tối thiểu 4 ký tự"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
              </div>

              {/* Xác nhận */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Xác nhận mật khẩu mới</label>
                <input type={showPw ? 'text' : 'password'} value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)} placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
              </div>

              <button onClick={handleChangePassword} disabled={pwLoading || !currentPw || !newPw}
                className="w-full py-3 bg-purple-500 text-white font-bold rounded-xl text-sm shadow-md disabled:opacity-50 active:scale-98 transition-transform">
                {pwLoading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              </button>
            </div>
          )}
        </div>

        {/* Backup */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Database size={16} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Sao lưu dữ liệu</p>
              <p className="text-xs text-gray-400">Tải toàn bộ dữ liệu về máy</p>
            </div>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <button onClick={handleBackup} disabled={backupLoading}
              className="w-full py-3 bg-blue-500 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 transition-transform">
              <Download size={16} />
              {backupLoading ? 'Đang tải...' : 'Tải backup (.json)'}
            </button>
            <button onClick={handleRestore} disabled={backupLoading}
              className="w-full py-3 border-2 border-orange-300 text-orange-600 font-medium rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98 transition-transform">
              <Upload size={16} />
              Phục hồi từ file backup
            </button>
            <p className="text-[10px] text-gray-400 text-center">⚠️ Phục hồi sẽ ghi đè toàn bộ dữ liệu hiện tại</p>
          </div>
        </div>
      </div>

      {/* Version */}
      <div className="max-w-2xl mx-auto px-4 mt-4 text-center">
        <p className="text-[10px] text-gray-300">Chi Mai v2.4 • Phát Tài Phát Lộc</p>
      </div>
    </div>
  )
}

// Chevron helper
function ChevronIcon({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
