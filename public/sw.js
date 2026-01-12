const CACHE_NAME = 'order-tracker-v1';

// Assets cần cache ngay khi install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Install - cache assets cơ bản
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('PWA: Caching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - xóa cache cũ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('PWA: Deleting old cache', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bỏ qua requests đến Supabase (luôn cần network)
  if (url.hostname.includes('supabase')) {
    return;
  }

  // Bỏ qua các request không phải GET
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // Thử network trước
    fetch(request)
      .then((response) => {
        // Clone response để cache
        const responseClone = response.clone();
        
        // Cache response mới
        caches.open(CACHE_NAME).then((cache) => {
          // Chỉ cache successful responses
          if (response.status === 200) {
            cache.put(request, responseClone);
          }
        });

        return response;
      })
      .catch(() => {
        // Network failed, thử cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Nếu là navigation request, trả về index.html
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background Sync (cho tương lai)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    console.log('PWA: Background sync triggered');
    // Có thể implement sync data khi online trở lại
  }
});

// Push Notification (cho tương lai)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Click notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
