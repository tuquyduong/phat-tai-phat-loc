// ============================================
// BOTTOM TABS - FILE MỚI
// Navigation bar dưới cùng cho multi-module
// ============================================

const ALL_TABS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'orders', icon: '📦', label: 'Đơn hàng' },
  { id: 'expenses', icon: '💰', label: 'Thu Chi' },
  { id: 'lab', icon: '🧪', label: 'Lab' },
  { id: 'invest', icon: '📈', label: 'Đầu tư' },
]

export default function BottomTabs({ activeTab, onTabChange, activeModules = [] }) {
  // Luôn hiện Home + Orders, các tab khác tùy thuộc activeModules
  const visibleTabs = ALL_TABS.filter(tab =>
    tab.id === 'home' || tab.id === 'orders' || activeModules.includes(tab.id)
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex justify-around items-center max-w-2xl mx-auto">
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center py-2.5 px-3 min-w-0 flex-1 transition-all ${
                isActive ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <span className={`text-xl leading-none transition-transform ${isActive ? 'scale-110' : ''}`}>
                {tab.icon}
              </span>
              <span className={`text-[10px] mt-1 truncate ${isActive ? 'font-bold' : ''}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="w-5 h-0.5 bg-green-500 rounded-full mt-0.5" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
