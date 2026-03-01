// ============================================
// EXPENSES PAGE - FILE MỚI (Placeholder)
// Sẽ được xây dựng ở Phase 1
// ============================================

export default function Expenses() {
  return (
    <div className="pb-4">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h2 className="text-lg font-bold text-gray-800">💰 Quản lý Thu Chi</h2>
        </div>
      </header>

      {/* Coming soon */}
      <div className="max-w-2xl mx-auto px-4 mt-8">
        <div className="text-center py-8">
          <div className="text-5xl mb-3">💰</div>
          <h3 className="font-bold text-gray-700 text-lg">Sắp ra mắt!</h3>
          <p className="text-gray-500 text-sm mt-1">
            Module Thu Chi đang được phát triển
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-xs font-bold text-green-700 mb-2">Tính năng sắp có:</p>
          <div className="space-y-1.5 text-xs text-green-600">
            <p>✅ Ghi thu chi nhanh trong 3 giây</p>
            <p>✅ Danh mục tùy chỉnh + icon + màu</p>
            <p>✅ Ngân sách + cảnh báo vượt mức</p>
            <p>✅ Biểu đồ thu chi theo tháng</p>
            <p>✅ Giao dịch định kỳ tự động</p>
            <p>✅ Liên kết với đơn hàng</p>
          </div>
        </div>
      </div>
    </div>
  )
}
