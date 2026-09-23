// ============================================
// HOME PAGE - UPDATED
// Thêm: Đổi mật khẩu + Backup/Restore
// ============================================
import { useState, useEffect } from 'react'
import { Lock, Download, Upload, Database, Eye, EyeOff } from 'lucide-react'
import {
  setPassword, checkPassword, supabase,
  loadUsage, readUsageCache, fmtBytes, USAGE_LIMITS,
} from '../lib/supabase'
import { useToast } from '../components/Toast'

// Backup tables list
const BACKUP_TABLES = [
  'customers', 'orders', 'deliveries', 'payments', 'products', 'settings',
  'app_config', 'transactions', 'ingredients', 'formulas', 'formula_ingredients',
  'lab_batches', 'lab_notes', 'ingredient_imports', 'ingredient_exports',
  'jewelry_trips', 'jewelry', 'jewelry_sales', 'jewelry_mounts', 'jewelry_intakes',
  'stocks', 'stock_transactions', 'dividends'
]

// Thanh dung lượng: xanh dưới 70%, vàng 70-90%, đỏ trên 90%
function UsageBar({ label, used, limit, extra, err }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'
  const text  = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-green-600'
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className={`text-xs font-semibold ${text}`}>
          {fmtBytes(used)} / {fmtBytes(limit)}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-gray-400">{extra || ''}</span>
        <span className="text-[10px] text-gray-400">{pct < 0.1 ? 'dưới 0,1%' : pct.toFixed(1) + '%'}</span>
      </div>
      {err && <p className="text-[10px] text-amber-600 mt-1">{err}</p>}
    </div>
  )
}

export default function Home({ onNavigate, activeModules }) {
  const toast = useToast()

  // Password states
  const [showSecurity, setShowSecurity] = useState(false)
  const [showUsage,  setShowUsage]  = useState(false)
  const [usage,      setUsage]      = useState(null)
  const [usageLoad,  setUsageLoad]  = useState(false)

  const fetchUsage = async (force = false) => {
    setUsageLoad(true)
    try { setUsage(await loadUsage({ force })) }
    catch (e) {
      setUsage({ db: { ok:false, message: e.message, tables: [], total: 0 },
                 storage: { ok:false, bytes:0, files:0 } })
    } finally { setUsageLoad(false) }
  }

  // Hiện ngay khi vào Home: lấy bản đã nhớ trong máy trước cho nhanh,
  // hết hạn 12 tiếng thì tự tính lại nền.
  useEffect(() => {
    const cached = readUsageCache()
    if (cached) setUsage(cached)
    if (!cached || cached.stale) fetchUsage()
  }, [])
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  // Backup states
  const [backupLoading, setBackupLoading] = useState(false)

  // Module cards (giữ nguyên)
  const modules = [
    { id: 'jewelry',  icon: '💎', label: 'Trang sức', value: 'Mở →', sub: 'Kho, bán hàng, nhập hàng', color: '#8B5CF6', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'expenses', icon: '💰', label: 'Thu Chi',   value: 'Mở →', sub: 'Quản lý thu chi', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'lab',      icon: '🧪', label: 'Lab Hub',   value: 'Mở →', sub: 'Công thức & Nguyên liệu', color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200' },
  ]
  const visibleModules = modules.filter(m => activeModules.includes(m.id))

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
      const backup = { version: '2.5', created_at: new Date().toISOString(), tables: {} }
      const failedTables = []

      // Supabase trả tối đa 1000 dòng mỗi lần gọi — phải lấy theo từng trang,
      // nếu không bảng nhiều dòng sẽ bị cắt mà không báo gì.
      const PAGE = 1000
      for (const table of BACKUP_TABLES) {
        try {
          const rows = []
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase
              .from(table).select('*').range(from, from + PAGE - 1)
            if (error) throw error
            if (!data || data.length === 0) break
            rows.push(...data)
            if (data.length < PAGE) break     // đã hết
          }
          backup.tables[table] = rows
        } catch (e) {
          failedTables.push(table)
        }
      }

      backup.localStorage = { order_tracker_settings: localStorage.getItem('order_tracker_settings') }
      backup.failed_tables = failedTables

      // Có bảng không lấy được → hỏi trước khi tải file thiếu
      if (failedTables.length > 0) {
        const ok = confirm(
          `Không đọc được ${failedTables.length} bảng:\n${failedTables.join(', ')}\n\n` +
          `File backup sẽ THIẾU các bảng này. Vẫn tải về?`
        )
        if (!ok) { toast.error('Đã huỷ backup'); return }
      }

      const d = new Date()
      const stamp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chimai_backup_${stamp}.json`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const totalRows = Object.values(backup.tables).reduce((s, t) => s + t.length, 0)
      const okCount   = Object.keys(backup.tables).length
      if (failedTables.length > 0)
        toast.error(`Backup thiếu ${failedTables.length} bảng — ${okCount} bảng, ${totalRows} dòng`)
      else
        toast.success(`✓ Đã tải backup: ${okCount} bảng, ${totalRows} dòng`)
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
          'ingredients', 'formulas', 'formula_ingredients',
          'lab_batches', 'lab_notes', 'ingredient_imports', 'ingredient_exports',
          'jewelry_trips', 'jewelry', 'jewelry_sales', 'jewelry_mounts', 'jewelry_intakes',
          'stocks', 'stock_transactions', 'dividends', 'transactions'
        ]

        // Cảnh báo nếu file backup vốn đã thiếu bảng
        if (backup.failed_tables?.length > 0) {
          const ok = confirm(
            `File backup này THIẾU ${backup.failed_tables.length} bảng:\n` +
            `${backup.failed_tables.join(', ')}\n\n` +
            `Khôi phục sẽ không có dữ liệu các bảng đó. Tiếp tục?`
          )
          if (!ok) { toast.error('Đã huỷ khôi phục'); return }
        }

        // ── Lớp 1: tự sao lưu hiện trạng trước khi động vào gì ──
        // Nếu khôi phục hỏng giữa chừng, bạn vẫn còn file này để quay lại.
        try {
          const safety = { version: '2.5', created_at: new Date().toISOString(),
                           note: 'Tự sao lưu trước khi khôi phục', tables: {} }
          for (const tbl of BACKUP_TABLES) {
            const rows = []
            for (let from = 0; ; from += 1000) {
              const { data, error } = await supabase.from(tbl).select('*').range(from, from + 999)
              if (error) break
              if (!data || data.length === 0) break
              rows.push(...data)
              if (data.length < 1000) break
            }
            if (rows.length) safety.tables[tbl] = rows
          }
          const d0 = new Date()
          const st = `${d0.getFullYear()}${String(d0.getMonth()+1).padStart(2,'0')}${String(d0.getDate()).padStart(2,'0')}_${String(d0.getHours()).padStart(2,'0')}${String(d0.getMinutes()).padStart(2,'0')}`
          const b0 = new Blob([JSON.stringify(safety)], { type: 'application/json' })
          const u0 = URL.createObjectURL(b0)
          const a0 = document.createElement('a')
          a0.href = u0; a0.download = `chimai_TRUOC-KHI-KHOIPHUC_${st}.json`
          document.body.appendChild(a0); a0.click(); document.body.removeChild(a0)
          URL.revokeObjectURL(u0)
        } catch {
          if (!confirm('Không tự sao lưu được hiện trạng.\n\nVẫn tiếp tục khôi phục?')) {
            toast.error('Đã huỷ khôi phục'); return
          }
        }

        // ── Lớp 2: khôi phục từng bảng trong một giao dịch ──
        let restored = 0
        const failed = []
        let useRpc = true

        for (const table of restoreOrder) {
          const rows = backup.tables[table]
          if (!rows || rows.length === 0) continue

          if (useRpc) {
            // Hàm restore_table xoá và chèn cùng lúc.
            // Lỗi ở bất kỳ đâu → database tự quay lui, dữ liệu cũ còn nguyên.
            const { data, error } = await supabase.rpc('restore_table', {
              p_table: table, p_rows: rows,
            })
            if (!error) { restored += data?.rows ?? rows.length; continue }

            // Chưa cài hàm trong database → chuyển sang cách cũ cho mọi bảng
            if (/function .*restore_table.* does not exist|PGRST202/i.test(error.message || '')) {
              useRpc = false
            } else {
              failed.push(`${table} (${(error.message || '').slice(0, 60)})`)
              continue
            }
          }

          // ── Đường lui: chèn thử 1 dòng trước khi xoá ──
          const { error: probeErr } = await supabase.from(table).insert(rows.slice(0, 1))
          if (probeErr) { failed.push(`${table} (${probeErr.message.slice(0, 60)})`); continue }
          try {
            if (table === 'settings') await supabase.from(table).delete().neq('key', '')
            else await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
            let okRows = 0
            for (let i = 0; i < rows.length; i += 500) {
              const { error } = await supabase.from(table).insert(rows.slice(i, i + 500))
              if (error) { failed.push(`${table} dòng ${i + 1}+ (${error.message.slice(0, 50)})`); break }
              okRows += Math.min(500, rows.length - i)
            }
            restored += okRows
          } catch (e) {
            failed.push(`${table} (${e.message?.slice(0, 60) || 'lỗi không rõ'})`)
          }
        }

        if (backup.localStorage?.order_tracker_settings) {
          localStorage.setItem('order_tracker_settings', backup.localStorage.order_tracker_settings)
        }

        if (failed.length > 0) {
          alert(
            `Khôi phục xong nhưng có ${failed.length} lỗi:\n\n${failed.join('\n')}\n\n` +
            `Đã khôi phục ${restored} dòng.\n` +
            `File "chimai_TRUOC-KHI-KHOIPHUC_..." vừa tải về giữ nguyên hiện trạng cũ — ` +
            `dùng nó nếu cần quay lại.`
          )
          toast.error(`Khôi phục ${restored} dòng, ${failed.length} lỗi`)
        } else {
          toast.success(`✓ Đã khôi phục ${restored} dòng. Đang tải lại...`)
        }
        setTimeout(() => window.location.reload(), failed.length > 0 ? 3000 : 1500)
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
          <div>
            <h1 className="text-lg font-bold">Chi Mai</h1>
            <p className="text-green-200 text-xs">Phát Tài Phát Lộc</p>
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

      {/* ============================================ */}
      {/* HỆ THỐNG: Bảo mật + Backup */}
      {/* ============================================ */}
      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hệ thống</p>

        {/* Dung lượng đã dùng */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 pt-3.5 pb-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Database size={16} className="text-sky-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Dung lượng đã dùng</p>
                <p className="text-xs text-gray-500">
                  {usageLoad && !usage ? 'Đang tính...' : 'Gói miễn phí Supabase'}
                </p>
              </div>
              {usage && (
                <button onClick={() => fetchUsage(true)} disabled={usageLoad}
                  className="text-[11px] text-sky-600 font-medium px-2 py-1 active:scale-95">
                  {usageLoad ? '...' : 'Tính lại'}
                </button>
              )}
            </div>

            {usage && (
              <>
                <UsageBar label="Dữ liệu (database)" used={usage.db.total} limit={USAGE_LIMITS.db}
                  err={!usage.db.ok ? 'Cần chạy migration_usage.sql để xem số thật' : null}/>
                <UsageBar label="Ảnh (storage)" used={usage.storage.bytes} limit={USAGE_LIMITS.storage}
                  extra={usage.storage.ok ? `${usage.storage.files} ảnh` : null}
                  err={!usage.storage.ok ? usage.storage.message : null}/>

                {(() => {
                  const dp = usage.db.total / USAGE_LIMITS.db * 100
                  const sp = usage.storage.bytes / USAGE_LIMITS.storage * 100
                  const p  = Math.max(dp, sp)
                  if (p < 70) return null
                  return (
                    <div className={`px-3 py-2 rounded-xl text-[11px] leading-relaxed
                      ${p >= 90 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                      {p >= 90 ? '🔴' : '🟡'} {sp >= dp ? 'Kho ảnh' : 'Dữ liệu'} đã dùng {p.toFixed(0)}%.
                      {sp >= dp
                        ? ' Xoá ảnh của sản phẩm đã bán hết, hoặc nâng gói Supabase.'
                        : ' Cân nhắc xoá dữ liệu cũ hoặc nâng gói Supabase.'}
                    </div>
                  )
                })()}
              </>
            )}
          </div>

          <button onClick={() => setShowUsage(!showUsage)}
            className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-100
              text-[11px] text-gray-500 active:bg-gray-50">
            {showUsage ? 'Ẩn chi tiết' : 'Xem chi tiết từng bảng'}
            <ChevronIcon open={showUsage} />
          </button>

          {showUsage && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {usage && (
                <>
                  {usage.db.ok && usage.db.tables.length > 0 && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <div className="space-y-0.5 max-h-60 overflow-y-auto">
                        {usage.db.tables.filter(t => t.bytes > 0).map(t => (
                          <div key={t.name} className="flex justify-between text-[10px] py-0.5 border-b border-gray-200 last:border-0">
                            <span className="font-mono text-gray-700 truncate">{t.name}</span>
                            <span className="text-gray-400 flex-shrink-0 ml-2">
                              {t.rows > 0 ? `~${t.rows} dòng · ` : ''}{fmtBytes(t.bytes)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

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
