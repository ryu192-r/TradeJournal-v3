const CACHE = 'tj-v3-v8'
const STATIC_URLS = ['/', '/index.html', '/manifest.json']
const API_CACHE = 'tj-v3-api-v2'

// Install: cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC_URLS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() =>
      caches.open(CACHE).then((c) => c.addAll(STATIC_URLS))
    )
  )
  self.clients.claim()
})

// Fetch: stale-while-revalidate for API, network-first for HTML, cache-first for assets
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)

  // API calls: stale-while-revalidate
  if (url.pathname.startsWith('/api/v1/')) {
    e.respondWith(staleWhileRevalidate(req))
    return
  }

  // HTML (index.html): network-first — always get fresh hash references
  if (url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(networkFirst(req))
    return
  }

  // Hashed assets: cache-first — immutable, cache aggressively
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(req, clone))
        return res
      }))
    )
    return
  }

  // Everything else: network-first
  e.respondWith(networkFirst(req))
})

async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    const clone = res.clone()
    cache.put(req, clone)
    return res
  } catch {
    const cached = await cache.match(req)
    return cached || new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(API_CACHE)
  const cached = await cache.match(req)

  // Return cached response immediately (if exists)
  const networkPromise = fetch(req)
    .then((res) => {
      const clone = res.clone()
      cache.put(req, clone)
      return res
    })
    .catch(() => {
      // Network failed, we'll return cached below
      return null
    })

  if (cached) {
    // Return cached, update in background
    networkPromise.catch(() => {})
    return cached
  }

  // Nothing cached, wait for network
  const network = await networkPromise
  return network || new Response(
    JSON.stringify({ error: 'offline', message: 'You are offline. Data unavailable.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}
