const CACHE_NAME = 'yahyaverse-v' + Date.now(); // Dynamic cache name forces updates
const STATIC_CACHE = 'yahyaverse-static-v1.0.0';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css',
  '/offline.html',
  // Your game files
  '/game1.html', '/game2.html', '/game3.html', '/game4.html', '/game5.html',
  '/game6.html', '/game7.html', '/game8.html', '/game9.html', '/game10.html',
  '/game11.html', '/game12.html', '/game13.html', '/game14.html', '/game15.html',
  '/game16.html', '/game17.html', '/game18.html', '/game19.html', '/game20.html',
  // Icons
  '/yahya.png', '/yahya.png', '/yahya.png',
  '/yahya.png', '/yahya.png', '/yahya.png',
  '/yahya.png', '/yahya.png'
];

// Install event - aggressive caching with cache busting
self.addEventListener('install', (event) => {
  console.log('SW: Installing new version...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW: Caching app shell with cache busting');
        // Add cache-busting query parameters
        const cacheBustingUrls = urlsToCache.map(url => {
          const cacheBuster = '?v=' + Date.now();
          return new Request(url + cacheBuster, {
            cache: 'reload', // Force reload from network
            mode: 'cors'
          });
        });
        return cache.addAll(cacheBustingUrls);
      })
      .then(() => {
        console.log('SW: New version cached successfully');
        // Force immediate activation
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('SW: Cache failed:', error);
      })
  );
});

// Activate event - aggressive cache cleanup
self.addEventListener('activate', (event) => {
  console.log('SW: Activating new version...');
  event.waitUntil(
    Promise.all([
      // Delete ALL old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              console.log('SW: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Claim all clients immediately
      self.clients.claim()
    ])
  );
  
  // Notify all clients about the update
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_UPDATED',
        message: 'App updated successfully! 🎉'
      });
    });
  });
});

// Fetch event - Network First strategy for dynamic content
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests and chrome-extension
  if (url.origin !== location.origin || url.protocol === 'chrome-extension:') {
    return;
  }

  // Network First strategy - always try to get fresh content
  event.respondWith(
    fetch(event.request.clone(), {
      cache: 'no-cache', // Don't use browser cache
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    .then((networkResponse) => {
      // If network succeeds, update cache and return response
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        
        return networkResponse;
      }
      
      // If network fails, try cache
      return caches.match(event.request);
    })
    .catch(() => {
      // If both network and cache fail, return cached version or offline page
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/offline.html');
        }
        
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Check for updates every 30 seconds
setInterval(() => {
  console.log('SW: Checking for updates...');
  self.registration.update();
}, 30000);

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('SW: Force updating...');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
});
