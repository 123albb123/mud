const CACHE_NAME = "yanhuang-web-v0.1.0-5309b7d6";
const CACHE_NAME_PREFIX = 'yanhuang-web-';
const APP_SCOPE = '/app/';
const PRECACHE_URLS = ["/app/index.html","/app/manifest.json","/app/icons/icon-192.png","/app/icons/icon-512.png","/app/icons/icon-maskable-512.png","/app/icons/apple-touch-icon.png","/app/assets/index-DobRwtnG.js","/app/assets/index-CHPyEf7X.css"];
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key.startsWith(CACHE_NAME_PREFIX) && key !== CACHE_NAME)
                    .map((key) => caches.delete(key)),
            ))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

const isNavigationRequest = (request) =>
    request.mode === 'navigate' || request.destination === 'document';

const isStaticAppRequest = (request) => {
    if (request.method !== 'GET' || !['http:', 'https:'].includes(new URL(request.url).protocol)) {
        return false;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_SCOPE) ||
        url.pathname === APP_SCOPE + 'service-worker.js') {
        return false;
    }
    return isNavigationRequest(request) || PRECACHE_URLS.includes(url.pathname) || STATIC_DESTINATIONS.has(request.destination);
};

self.addEventListener('fetch', (event) => {
    if (!isStaticAppRequest(event.request)) {
        return;
    }
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
            if (!response.ok) {
                return response;
            }
            const copy = response.clone();
            if (!isNavigationRequest(event.request)) {
                void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
        }).catch(() => isNavigationRequest(event.request)
            ? caches.match(APP_SCOPE + 'index.html')
            : Response.error())),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                const url = new URL(client.url);
                if (url.origin === self.location.origin && url.pathname.startsWith(APP_SCOPE) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(APP_SCOPE + 'index.html');
        }),
    );
});
