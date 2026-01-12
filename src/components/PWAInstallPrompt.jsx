import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check nếu đã cài rồi
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return

    // Check đã dismiss chưa
    const dismissed = localStorage.getItem('pwa_prompt_dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const now = new Date()
      // Hiện lại sau 7 ngày
      if (now - dismissedDate < 7 * 24 * 60 * 60 * 1000) return
    }

    // Check iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    setIsIOS(isIOSDevice)

    // Listen for beforeinstallprompt (Android/Desktop)
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Đợi 3 giây rồi hiện prompt
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Với iOS, hiện hướng dẫn sau 5 giây
    if (isIOSDevice) {
      setTimeout(() => setShowPrompt(true), 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('PWA installed')
    }
    
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa_prompt_dismissed', new Date().toISOString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80 fade-in">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-xl">
            <Smartphone size={24} className="text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800">Cài đặt ứng dụng</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isIOS 
                ? 'Bấm nút Share rồi chọn "Add to Home Screen"'
                : 'Thêm vào màn hình chính để truy cập nhanh hơn'
              }
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2.5 bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Cài đặt ngay
          </button>
        )}
      </div>
    </div>
  )
}
