export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-48" />
        </div>
        <div className="text-right">
          <div className="h-5 bg-gray-200 rounded w-20 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-16" />
        </div>
      </div>
      
      {/* Progress bars */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <div className="h-3 bg-gray-100 rounded w-16" />
            <div className="h-3 bg-gray-100 rounded w-12" />
          </div>
          <div className="h-2 bg-gray-200 rounded-full" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <div className="h-3 bg-gray-100 rounded w-20" />
            <div className="h-3 bg-gray-100 rounded w-24" />
          </div>
          <div className="h-2 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-gray-100 rounded-xl p-4 animate-pulse">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-12" />
            </div>
            <div className="w-9 h-9 bg-gray-200 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </div>
  )
}
