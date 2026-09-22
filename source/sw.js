// Nextel Connect - Progressive Web App & Web Push Service Worker Engine
// Provides offline caching, PWA installability on Android/iOS/Desktop, native Web Push notifications, and instant call answer routing.

const CACHE_NAME = 'taskvest-v3';
const CORE_PRECACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/dashboard/transactions.html',
  '/dashboard/profile.html',
  '/dashboard/change-password.html',
  '/auth/login.html',
  '/auth/register.html',
  '/payment.html',
  '/privacy.html',
  '/terms.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/auth.js',
  '/tasks.js',
  '/admin.html',
  '/build/assets/app-BNec2NMu.css',
  '/build/assets/app-Dpy8HP2u.js'
];

// 1. Install Event - Cache core assets for offline & PWA readiness
self.addEventListener('install', (event) => {
  console.log('[PWA SW] 🚀 Service Worker installing. Scope:', self.registration ? self.registration.scope : 'default');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_PRECACHE).catch((err) => {
        console.warn('[PWA SW] Precache non-critical asset warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event - Clean up stale caches & claim clients immediately
self.addEventListener('activate', (event) => {
  console.log('[PWA SW] ⚡ Service Worker activated. Scope:', self.registration ? self.registration.scope : 'default');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Network-first strategy with cache fallback for PWA resilience
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Always bypass cache for non-GET requests, API endpoints, or external Supabase/audio services
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('catbox.moe') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful basic responses for static/navigation assets
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails (offline PWA support)
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/dashboard.html') || caches.match('/index.html');
          }
          return new Response('Network offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// 4. Cross-tab & Background Broadcast Channel for Call Events
let callBroadcast = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    callBroadcast = new BroadcastChannel('nextel_calls');
  }
} catch (_) {}

// 5. Handle Native Web Push events
self.addEventListener('push', (event) => {
  const swScope = (self.registration && self.registration.scope) || 'unknown-scope';
  console.log(`[PWA SW] 🔔 Web Push event received at ${new Date().toISOString()}`);
  console.log(`[PWA SW] 📍 Active Service Worker scope: ${swScope}`);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
      console.log('[PWA SW] 📦 Parsed push payload JSON:', data);
    } catch (_) {
      const rawText = event.data.text();
      console.log('[PWA SW] 📦 Raw push payload text:', rawText);
      data = { title: '🔔 Nextel Notification', body: rawText };
    }
  } else {
    console.warn('[PWA SW] ⚠️ Push event received without data payload');
  }

  const isTest = data.isTest === true || (data.title && data.title.includes('TEST')) || (data.title && data.title.includes('Test'));
  const brand = data.brand || 'NaijaCard';
  const callerName = data.callerName || (data.name ? `${data.name} (${brand})` : brand);
  const reward = Number(data.reward) || 2100;
  const callId = data.callId || data.call_id || (isTest ? ('test_' + Date.now()) : ('call_' + Date.now()));
  const audioUrl = data.audioUrl || data.audio_url || '';
  
  const title = data.title || (isTest ? '🔔 NEXTEL TEST PUSH' : `📞 Incoming Call: ${callerName}`);
  const body = data.body || (isTest ? 'If you can see this, background Web Push is working.' : `Official Sponsor Call · Offer: ₦${reward.toLocaleString()} · Tap to Answer`);
  const icon = data.icon || '/favicon-192x192.png';
  const badge = data.badge || '/favicon-32x32.png';
  const tag = isTest ? ('test-bg-push-' + Date.now()) : ('incoming-call-' + callId);
  const targetUrl = data.url || (isTest ? '/dashboard.html?test_push=true' : `/dashboard.html?call_id=${encodeURIComponent(callId)}&brand=${encodeURIComponent(brand)}&reward=${encodeURIComponent(reward)}&audio_url=${encodeURIComponent(audioUrl)}&auto_answer=true`);

  const actions = isTest ? [
    { action: 'open', title: '✅ Open App' }
  ] : [
    { action: 'accept', title: '📞 Answer' },
    { action: 'decline', title: '❌ Decline' }
  ];

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    tag: tag,
    renotify: true,
    requireInteraction: true, // Keep notification visible on screen until user acts (heads-up)
    silent: false,
    vibrate: [300, 100, 300, 100, 300, 500, 300, 100, 300], // Phone ring vibration pattern
    timestamp: Date.now(),
    data: {
      isTest: isTest,
      callId: callId,
      brand: brand,
      callerName: callerName,
      reward: reward,
      url: targetUrl,
      audioUrl: audioUrl,
      expiresAt: data.expiresAt || (Date.now() + 45000),
      supabaseUrl: data.supabaseUrl || ''
    },
    actions: actions
  };

  console.log(`[PWA SW] ⏳ Attempting self.registration.showNotification('${title}')...`);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log(`[PWA SW] ✅ Native notification successfully shown on Android/OS display! Title: "${title}", Tag: "${tag}"`);
      })
      .catch((err) => {
        console.error(`[PWA SW] ❌ Native notification show error:`, err);
      })
  );
});

// 6. Handle notification click (both banner click and action buttons)
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const nData = notification.data || {};
  const brandName = nData.brand || 'NaijaCard';
  const callId = nData.callId || ('call_' + Date.now());
  const reward = Number(nData.reward) || 2100;
  const audioUrl = nData.audioUrl || '';
  const targetUrl = nData.url || `/dashboard.html?call_id=${encodeURIComponent(callId)}&brand=${encodeURIComponent(brandName)}&reward=${encodeURIComponent(reward)}&audio_url=${encodeURIComponent(audioUrl)}&auto_answer=true`;
  const absoluteTargetUrl = new URL(targetUrl, self.location.origin).href;

  // Always close notification immediately on click
  notification.close();

  if (action === 'decline') {
    // Notify server/Supabase of decline / missed call
    if (nData.supabaseUrl && nData.callId) {
      event.waitUntil(
        fetch(`${nData.supabaseUrl}/rest/v1/incoming_calls?id=eq.${encodeURIComponent(nData.callId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'declined', responded_at: new Date().toISOString() })
        }).catch(() => {})
      );
    }
    return;
  }

  // Both Notification Body Click AND Accept action button execute the EXACT SAME logic below:
  // Broadcast answering event immediately to all active tabs
  try {
    if (callBroadcast) {
      callBroadcast.postMessage({
        type: 'ANSWER_CALL',
        callId: callId,
        brand: brandName,
        reward: reward,
        audioUrl: audioUrl
      });
    }
  } catch (_) {}

  // Handle opening or focusing window and launching call screen
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // 1. Look for any existing open tab/window matching our app
      for (const client of windowClients) {
        if ('focus' in client) {
          try {
            client.postMessage({
              type: 'NX_INCOMING_CALL_ANSWERED',
              callId: callId,
              brand: brandName,
              reward: reward,
              audioUrl: audioUrl
            });
          } catch (_) {}

          try {
            await client.focus();
          } catch (_) {}

          if ('navigate' in client) {
            try {
              return await client.navigate(absoluteTargetUrl);
            } catch (_) {}
          }
          return;
        }
      }

      // 2. If no window/tab is open (PWA completely closed), open a fresh window
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTargetUrl);
      }
    })
  );
});

// 7. Handle notification dismiss / close event
self.addEventListener('notificationclose', (event) => {
  const nData = event.notification.data || {};
  if (nData.supabaseUrl && nData.callId) {
    event.waitUntil(
      fetch(`${nData.supabaseUrl}/rest/v1/incoming_calls?id=eq.${encodeURIComponent(nData.callId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'missed', responded_at: new Date().toISOString() })
      }).catch(() => {})
    );
  }
});
