// ============================================
// LAB HUB PAGE - FILE MỚI (Placeholder)
// Sẽ được xây dựng ở Phase 2
// ============================================

export default function Lab() {
  return (
    <div className="pb-4">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <h2 className="text-lg font-bold text-gray-800">🧪 Lab Hub</h2>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 mt-8">
        <div className="text-center py-8">
          <div className="text-5xl mb-3">🧪</div>
          <h3 className="font-bold text-gray-700 text-lg">Sắp ra mắt!</h3>
          <p className="text-gray-500 text-sm mt-1">
            Module Lab Hub đang được phát triển
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 max-w-sm mx-auto">
          <p className="text-xs font-bold text-purple-700 mb-2">Tính năng sắp có:</p>
          <div className="space-y-1.5 text-xs text-purple-600">
            <p>✅ Quản lý nguyên liệu + nhà cung cấp</p>
            <p>✅ Tạo công thức với tỷ lệ pha chế</p>
            <p>✅ Máy tính quy đổi serving tự động</p>
            <p>✅ Ước tính chi phí sản xuất</p>
            <p>✅ Ghi chú thí nghiệm + pin</p>
            <p>✅ Copy danh sách nguyên liệu 1 nút</p>
          </div>
        </div>
      </div>
    </div>
  )
}
