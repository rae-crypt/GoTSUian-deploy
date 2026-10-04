// GoTSUian service worker — only so phones can install the site to the home
// screen (IT expert review, 2026-10-04). It caches NOTHING: every request goes
// straight to the network, so a deploy shows up immediately and a ride's live
// data is never served stale. Installing/updating takes over right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // No respondWith(): the browser handles the request exactly as without a
  // service worker. The handler only has to exist for installability.
});
