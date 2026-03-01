// ============================================
// INVEST PAGE - FILE MỚI (Placeholder)
// Sẽ được xây dựng ở Phase 3
// ============================================

export default function Invest() {
  return (
    <div className="pb-4">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h2 className="text-lg font-bold text-gray-800">📈 Đầu tư</h2>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        <div className="text-center py-8">
          <div className="text-5xl mb-3">📈</div>
          <h3 className="font-bold text-gray-700 text-lg">Sắp ra mắt!</h3>
          <p className="text-gray-500 text-sm mt-1">
            Module Đầu tư đang được phát triển
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-xs font-bold text-amber-700 mb-2">Tính năng sắp có:</p>
          <div className="space-y-1.5 text-xs text-amber-600">
            <p>✅ Danh mục cổ phiếu + giá trung bình</p>
            <p>✅ Giao dịch Mua/Bán theo lô</p>
            <p>✅ Lãi/lỗ tổng + từng lô</p>
            <p>✅ Bán theo FIFO hoặc chọn lô</p>
            <p>✅ Cổ tức + ROI báo cáo</p>
            <p>✅ Cập nhật giá nhanh</p>
          </div>
        </div>
      </div>
    </div>
  )
}
