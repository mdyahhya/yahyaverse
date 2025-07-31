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

// Add these to your existing sw.js file

// ========== ANONSHARE ADDITIONS ==========

// Add AnonShare routes to your existing STATIC_CACHE_URLS array
const ANONSHARE_CACHE_URLS = [
  '/anonshare.html',  // or whatever you name the file
  '/anonshare',       // if using routing
];

// Add to your existing cache URLs
// STATIC_CACHE_URLS.push(...ANONSHARE_CACHE_URLS);

// ========== BLUETOOTH FILE TRANSFER HANDLERS ==========

// Handle Bluetooth-related background tasks
self.addEventListener('sync', (event) => {
  // Add this to your existing sync handler or create new one
  if (event.tag === 'bluetooth-retry') {
    console.log('[SW] Retrying Bluetooth connection...');
    event.waitUntil(retryBluetoothConnection());
  }
  
  if (event.tag === 'file-cleanup') {
    console.log('[SW] Cleaning up temporary files...');
    event.waitUntil(cleanupTempFiles());
  }
});

// Push notification handler for file transfers
self.addEventListener('push', (event) => {
  // Add this to your existing push handler
  if (event.data) {
    const data = event.data.json();
    
    if (data.type === 'file-received') {
      const options = {
        body: `📁 ${data.filename} received via AnonShare`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'anonshare-file',
        requireInteraction: true,
        data: { 
          action: 'anonshare',
          filename: data.filename,
          size: data.size 
        },
        actions: [
          {
            action: 'download-file',
            title: '⬇️ Download',
            icon: '/icons/download.png'
          },
          {
            action: 'delete-file',
            title: '🗑️ Delete',
            icon: '/icons/delete.png'
          }
        ],
        vibrate: [200, 100, 200],
        silent: false
      };

      event.waitUntil(
        self.registration.showNotification('AnonShare - File Received', options)
      );
    }
  }
});

// Enhanced notification click handler
self.addEventListener('notificationclick', (event) => {
  // Add this to your existing notification handler
  event.notification.close();

  if (event.notification.tag === 'anonshare-file') {
    if (event.action === 'download-file') {
      event.waitUntil(
        clients.openWindow('/anonshare?action=download&file=' + event.notification.data.filename)
      );
    } else if (event.action === 'delete-file') {
      event.waitUntil(deleteReceivedFile(event.notification.data.filename));
    } else {
      event.waitUntil(clients.openWindow('/anonshare'));
    }
  }
});

// ========== ANONSHARE SPECIFIC FUNCTIONS ==========

// Bluetooth connection retry handler
async function retryBluetoothConnection() {
  try {
    // Get stored connection attempts from IndexedDB
    const db = await openAnonShareDB();
    const failedConnections = await getFailedConnections(db);
    
    for (const connection of failedConnections) {
      try {
        // Attempt to reconnect
        await attemptBluetoothReconnect(connection);
        await removeFailedConnection(db, connection.id);
      } catch (error) {
        console.log('[SW] Retry failed for:', connection.deviceId);
      }
    }
  } catch (error) {
    console.error('[SW] Bluetooth retry failed:', error);
  }
}

// Clean up temporary files
async function cleanupTempFiles() {
  try {
    // Clear any temporary file data from IndexedDB
    const db = await openAnonShareDB();
    const transaction = db.transaction(['tempFiles'], 'readwrite');
    const store = transaction.objectStore('tempFiles');
    
    // Delete files older than 1 hour
    const cutoffTime = Date.now() - (60 * 60 * 1000);
    const files = await getAllTempFiles(store);
    
    for (const file of files) {
      if (file.timestamp < cutoffTime) {
        await store.delete(file.id);
        console.log('[SW] Cleaned up temp file:', file.name);
      }
    }
  } catch (error) {
    console.error('[SW] Cleanup failed:', error);
  }
}

// Delete received file
async function deleteReceivedFile(filename) {
  try {
    const db = await openAnonShareDB();
    const transaction = db.transaction(['receivedFiles'], 'readwrite');
    const store = transaction.objectStore('receivedFiles');
    
    // Find and delete the file
    const files = await getAllReceivedFiles(store);
    const fileToDelete = files.find(f => f.name === filename);
    
    if (fileToDelete) {
      await store.delete(fileToDelete.id);
      console.log('[SW] Deleted file:', filename);
    }
  } catch (error) {
    console.error('[SW] File deletion failed:', error);
  }
}

// ========== INDEXEDDB HELPERS ==========

function openAnonShareDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AnonShareDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores
      if (!db.objectStoreNames.contains('tempFiles')) {
        const tempStore = db.createObjectStore('tempFiles', { keyPath: 'id', autoIncrement: true });
        tempStore.createIndex('timestamp', 'timestamp');
      }
      
      if (!db.objectStoreNames.contains('receivedFiles')) {
        const receivedStore = db.createObjectStore('receivedFiles', { keyPath: 'id', autoIncrement: true });
        receivedStore.createIndex('name', 'name');
      }
      
      if (!db.objectStoreNames.contains('failedConnections')) {
        const connStore = db.createObjectStore('failedConnections', { keyPath: 'id', autoIncrement: true });
        connStore.createIndex('deviceId', 'deviceId');
      }
    };
  });
}
function getAllTempFiles(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getAllReceivedFiles(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function getFailedConnections(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['failedConnections'], 'readonly');
    const store = transaction.objectStore('failedConnections');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removeFailedConnection(db, connectionId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['failedConnections'], 'readwrite');
    const store = transaction.objectStore('failedConnections');
    const request = store.delete(connectionId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

async function attemptBluetoothReconnect(connection) {
  // This would contain actual Bluetooth reconnection logic
  // Implementation depends on your specific needs
  console.log('[SW] Attempting to reconnect to:', connection.deviceId);
  throw new Error('Reconnection not implemented');
}

// ========== MESSAGE HANDLERS ==========

// Add these to your existing message handler
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'ANONSHARE_CACHE_FILE':
      // Cache a received file temporarily
      cacheReceivedFile(data.file, data.metadata);
      break;
      
    case 'ANONSHARE_CLEANUP':
      // Trigger immediate cleanup
      cleanupTempFiles();
      break;
      
    case 'ANONSHARE_RETRY_CONNECTION':
      // Register background sync for retry
      self.registration.sync.register('bluetooth-retry');
      break;
      
    case 'ANONSHARE_SCHEDULE_CLEANUP':
      // Schedule file cleanup
      self.registration.sync.register('file-cleanup');
      break;
  }
});

async function cacheReceivedFile(file, metadata) {
  try {
    const db = await openAnonShareDB();
    const transaction = db.transaction(['receivedFiles'], 'readwrite');
    const store = transaction.objectStore('receivedFiles');
    
    await store.add({
      name: metadata.filename,
      size: metadata.size,
      type: metadata.type,
      data: file,
      timestamp: Date.now(),
      received: true
    });
    
    console.log('[SW] Cached received file:', metadata.filename);
  } catch (error) {
    console.error('[SW] Failed to cache file:', error);
  }
}
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
