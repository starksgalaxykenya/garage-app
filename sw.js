// =================================================================
// sw.js — Garage Manager PRO Service Worker
// Strategy: Network First for app files (always gets latest version),
//           Cache First only for third-party CDN assets (fonts, icons, libs).
// To force all users to get a new version: bump CACHE_VERSION below.
// =================================================================

const CACHE_VERSION = 'gmp-v3'; // ← bump this (e.g. v4, v5) whenever you deploy changes
const APP_CACHE     = `${CACHE_VERSION}-app`;
const CDN_CACHE      = `${CACHE_VERSION}-cdn`;

// Your own app files — always fetched from network, cached as fallback only
const APP_FILES = [
    './',
    './index.html',
    './management.html',
    './admin.html',
    './payment.html',
    './auth.js',
    './garage-branding.js',
    './management.js',
    './subscription.js',
    './pwa-install.js',
    './manifest.json',
    './icons/72x72.png',
    './icons/96x96.png',
    './icons/128x128.png',
    './icons/144x144.png',
    './icons/152x152.png',
    './icons/192x192.png',
    './icons/384x384.png',
    './icons/512x512.png',
];

// Optional offline fallback page — only used if you actually have this file.
// If you don't have an offline.html, leave this as null.
const OFFLINE_FALLBACK = './offline.html';

// Third-party CDN assets — these rarely change, so cache-first is fine
const CDN_ORIGINS = [
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'www.gstatic.com',   // Firebase JS SDKs
];

// Specific CDN files used by this app, pre-cached on install so they
// work offline immediately instead of waiting for first visit.
const CDN_FILES = [
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
];

// =================================================================
// INSTALL — pre-cache app shell + known CDN assets
// =================================================================
self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            const appCache = await caches.open(APP_CACHE);
            // addAll fails entirely if one file 404s, so add files individually
            // to keep one bad path from blocking the whole install.
            await Promise.all(
                APP_FILES.map(url =>
                    appCache.add(url).catch(err =>
                        console.warn('[SW] Failed to cache app file:', url, err)
                    )
                )
            );

            const cdnCache = await caches.open(CDN_CACHE);
            await Promise.all(
                CDN_FILES.map(url =>
                    cdnCache.add(url).catch(err =>
                        console.warn('[SW] Failed to cache CDN file:', url, err)
                    )
                )
            );
        })()
    );
    // Activate immediately — don't wait for old tabs to close
    self.skipWaiting();
});

// =================================================================
// ACTIVATE — delete old caches from previous versions
// =================================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== APP_CACHE && key !== CDN_CACHE)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            )
        )
    );
    // Take control of all open tabs immediately
    self.clients.claim();
});

// =================================================================
// FETCH — routing strategy
// =================================================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip non-GET requests (POST to Firebase, etc.)
    if (event.request.method !== 'GET') return;

    // Skip Firebase API calls — never cache these
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('firebasestorage.googleapis.com')) {
        return; // let the browser handle it directly
    }

    // CDN assets → Cache First (they're versioned/immutable)
    if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
        event.respondWith(cdnCacheFirst(event.request));
        return;
    }

    // Everything else (your own app files) → Network First
    event.respondWith(networkFirst(event.request));
});

// =================================================================
// STRATEGY: Network First
// Tries the network; falls back to cache only if offline.
// This ensures users always get the latest version of your app.
// =================================================================
async function networkFirst(request) {
    const cache = await caches.open(APP_CACHE);
    try {
        const networkResponse = await fetch(request);
        // Only cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        // Offline fallback
        const cached = await cache.match(request);
        if (cached) return cached;

        // Last resort: for page navigations, try a sensible fallback page
        if (request.mode === 'navigate') {
            return (
                (await cache.match('./')) ||
                (await cache.match('./index.html')) ||
                (await cache.match(OFFLINE_FALLBACK)) ||
                Response.error()
            );
        }
        return Response.error();
    }
}

// =================================================================
// STRATEGY: Cache First (for CDN assets)
// Serves from cache immediately; fetches and updates cache in background.
// =================================================================
async function cdnCacheFirst(request) {
    const cache  = await caches.open(CDN_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        return cached; // already null if we get here, but safe
    }
}
