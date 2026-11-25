import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ghi danh sách mọi file chương trình (js, css, font woff2, ảnh) vào /asset-list.json.
// Service Worker đọc danh sách này để lưu sẵn TẤT CẢ trong máy → mở app tức thì, mất mạng vẫn chạy đủ các tab.
function assetList() {
  return {
    name: 'asset-list',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter(f => f.startsWith('assets/') && !/\.woff$/.test(f) && !/\.map$/.test(f))
        .map(f => '/' + f)
        .sort()
      this.emitFile({ type: 'asset', fileName: 'asset-list.json', source: JSON.stringify(files) })
    },
  }
}

export default defineConfig({
  plugins: [react(), assetList()],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true
  }
})
