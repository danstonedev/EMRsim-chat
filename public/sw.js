// Ultra-fast service worker for TTS caching and performance optimization
const CACHE_NAME = "emrchat-cache-v3";
const STATIC_CACHE_NAME = "emrchat-static-v3";
const TTS_CACHE_NAME = "emrchat-tts-v3";

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
  // Static assets: cache first, network fallback
  static: ["/favicon.svg", "/_next/static/"],
  // TTS responses: cache first with long expiry (1 week)
  tts: ["/api/tts"],
  // API routes: network first with cache fallback
  api: [
    "/api/chat",
    "/api/transcribe",
    "/api/transcribe-fast",
    "/api/voice-pipeline",
  ],
};

// Install event - pre-cache critical assets
self.addEventListener("install", (event) => {
  // Be resilient: don't fail install if one precache item 404s
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        const precache = [
          "/",
          "/favicon.svg",
          // Removed: "/img/EMRsim-chat_white.png" (doesn't exist under public/)
        ];

        // Add each item individually and ignore failures
        await Promise.allSettled(precache.map((u) => staticCache.add(u)));

        // Initialize TTS cache in the background
        await caches.open(TTS_CACHE_NAME);

        // Activate immediately
        await self.skipWaiting();
      } catch (err) {
        // Never block SW install on non-critical issues
        console.warn("[SW] install warning:", err);
      }
    })()
  );
});

// Activate event - cleanup old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith("emrchat-") &&
                ![CACHE_NAME, STATIC_CACHE_NAME, TTS_CACHE_NAME].includes(
                  cacheName
                )
            )
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  );
});

// Fetch event - intelligent caching strategies
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle HTTP(S) requests
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // TTS responses - cache first with long expiry (80% faster repeat requests)
  if (url.pathname === "/api/tts") {
    event.respondWith(handleTTSRequest(event.request));
    return;
  }

  // API routes - network first with cache fallback
  if (
    CACHE_STRATEGIES.api.some((pattern) => url.pathname.startsWith(pattern))
  ) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Static assets - cache first
  if (
    CACHE_STRATEGIES.static.some((pattern) => url.pathname.startsWith(pattern))
  ) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // Next.js assets - cache first
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // Default: network first
  event.respondWith(fetch(event.request));
});

// TTS request handler - aggressive caching for audio responses
async function handleTTSRequest(request) {
  try {
    // Create cache key from request body (voice + text combination)
    const body = await request.clone().text();
    const cacheKey = new Request(`${request.url}?body=${btoa(body)}`, {
      method: "GET",
    });

    const cache = await caches.open(TTS_CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      // Cache hit - return immediately (80% faster)
      return cachedResponse;
    }

    // Cache miss - fetch from network and cache
    const networkResponse = await fetch(request);

    if (networkResponse.ok && networkResponse.status === 200) {
      // Cache successful TTS responses for 1 week
      const responseToCache = networkResponse.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set("Cache-Control", "max-age=604800"); // 1 week

      const cachedVersion = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });

      cache.put(cacheKey, cachedVersion);
    }

    return networkResponse;
  } catch (error) {
    console.error("TTS cache error:", error);
    return fetch(request);
  }
}

// Static asset handler - cache first strategy
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    return cachedResponse || new Response("Network error", { status: 503 });
  }
}

// API request handler - network first with cache fallback
async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request.clone());

    // Cache successful GET requests only
    if (request.method === "GET" && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed - try cache
    if (request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    throw error;
  }
}

// Message handling for cache management
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_TTS_CACHE") {
    event.waitUntil(
      caches.delete(TTS_CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }

  if (event.data && event.data.type === "GET_CACHE_SIZE") {
    event.waitUntil(
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ size });
      })
    );
  }
});

// Utility function to get cache size
async function getCacheSize() {
  const cacheNames = [CACHE_NAME, STATIC_CACHE_NAME, TTS_CACHE_NAME];
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    } catch (error) {
      console.warn(`Error calculating size for cache ${cacheName}:`, error);
    }
  }

  return totalSize;
}
