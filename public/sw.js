/* global self, clients */

const RUN_TRACKING_TAG = 'run-tracking';
const CARDIO_PATH = '/cardio';

function fmtTime(s) {
  const sec = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const r = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function fmtPace(secPerKm) {
  const p = Number(secPerKm);
  if (!Number.isFinite(p) || p <= 0) return "--'--\"";
  const mi = Math.floor(p / 60);
  const s = Math.floor(p % 60);
  return `${mi}'${String(s).padStart(2, '0')}"`;
}

function showRunNotification(payload) {
  const seconds = Math.max(0, Math.floor(Number(payload.seconds) || 0));
  const km = Number(payload.km) || 0;
  const paceSecPerKm = Number(payload.paceSecPerKm) || 0;
  const title = `🏃 Pana Fitness - ${fmtTime(seconds)}`;
  const body = `${km.toFixed(2)} km | Ritmo: ${fmtPace(paceSecPerKm)}`;
  return self.registration.showNotification(title, {
    body,
    tag: RUN_TRACKING_TAG,
    silent: true,
    renotify: false,
    data: { path: CARDIO_PATH },
    icon: '/favicon.ico',
    sticky: true,
  });
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'RUN_TICK') {
    event.waitUntil(showRunNotification(data.payload || {}));
    return;
  }
  if (data.type === 'RUN_STOP') {
    event.waitUntil(
      self.registration.getNotifications({ tag: RUN_TRACKING_TAG }).then((list) => {
        list.forEach((n) => n.close());
      }),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || CARDIO_PATH;
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if ('focus' in client) {
          client.postMessage({ type: 'OPEN_CARDIO', path });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
