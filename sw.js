const CACHE_NAME = 'hitech-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/student.html',
  '/admin.html',
  '/offline.html',
  '/js/supabase.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/app.js',
  '/js/admin.js'
];

// Install event - cache all important files
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching files...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache first
self.addEventListener('fetch', event => {
  // Skip Supabase API calls (need internet)
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  // Skip storage files (need internet)
  if (event.request.url.includes('storage.googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if found
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }
        
        // Otherwise try network
        return fetch(event.request)
          .then(networkResponse => {
            // Cache the new response
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('[SW] Fetch failed:', error);
            // Return offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('/offline.html');
            }
            return new Response('Offline - Content not available', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});
