const CACHE_NAME = 'krafttraining-tracker-v52';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/storage.js',
  './js/pwa.js',
  './icons/icon-512x512.png',
  './icons/body-legs.svg',
  './icons/body-arms.svg',
  './icons/body-back.svg',
  './icons/body-core.svg',
  './icons/body-default.svg',
  'https://cdn.tailwindcss.com'
];

const cacheUrl = async (request, response) => {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
};

const networkFirst = async (request, fallbackUrl, shouldCache) => {
  try {
    const freshRequest = new Request(request, { cache: 'no-store' });
    const response = await fetch(freshRequest);
    if (shouldCache) {
      await cacheUrl(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate' && fallbackUrl) {
      return caches.match(fallbackUrl);
    }
    throw error;
  }
};

const cacheFirst = async (request, shouldCache) => {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (shouldCache) {
    await cacheUrl(request, response.clone());
  }
  return response;
};

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened');
        const precacheRequests = urlsToCache.map((url) => new Request(url, { cache: 'reload' }));
        return cache.addAll(precacheRequests);
      })
      .then(() => {
        console.log('All resources cached');
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);
  const basePath = scopeUrl.pathname;
  const isSameOrigin = url.origin === self.location.origin;
  const isInScope = url.pathname.startsWith(basePath);
  const isNavigate = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isScript = isInScope && url.pathname.startsWith(`${basePath}js/`) && url.pathname.endsWith('.js');
  const fallbackUrl = new URL('index.html', self.registration.scope).toString();
  const shouldCache = isSameOrigin;

  if (isNavigate || isScript) {
    event.respondWith(networkFirst(event.request, fallbackUrl, shouldCache));
    return;
  }

  event.respondWith(
    cacheFirst(event.request, shouldCache)
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
