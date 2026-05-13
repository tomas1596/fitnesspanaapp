/* global self, clients */

// ── Sticky-notification system disabled (re-enable before App Store launch) ──
// const RUN_TRACKING_TAG = 'run-tracking';
// const CARDIO_PATH = '/cardio';
//
// function fmtTime(s) { ... }
// function fmtPace(secPerKm) { ... }
// function showRunNotification(payload) { ... self.registration.showNotification ... }

self.addEventListener('message', () => {
  // Notification messages (RUN_TICK / RUN_STOP) are intentionally ignored.
});

// Notification-click handler disabled — no active notifications.
// self.addEventListener('notificationclick', ...);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
