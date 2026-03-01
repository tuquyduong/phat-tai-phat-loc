import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // Lock body scroll (iOS-safe)
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${scrollY}px`
    }
    return () => {
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-2xl',
  }

  return (
    // z-[70]: luôn trên BottomTabs(z-50), FAB(z-40)
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop - chỉ hiện trên desktop */}
      <div className="absolute inset-0 bg-black/50 modal-backdrop hidden sm:block" onClick={onClose} />

      {/* Mobile: full screen | Desktop: centered card */}
      <div
        className={`relative w-full ${sizeClasses[size]} bg-white sm:rounded-2xl shadow-modal flex flex-col
          h-full sm:h-auto sm:max-h-[90vh]`}
      >
        {/* Header - sticky */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0"
            style={{ paddingTop: 'calc(0.875rem + env(safe-area-inset-top, 0px))' }}>
            <h2 className="text-lg font-semibold text-gray-800 pr-2">{title}</h2>
            <button onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body - full scroll area */}
        <div className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
