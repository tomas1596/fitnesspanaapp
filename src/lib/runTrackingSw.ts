const SW_PATH = '/sw.js';

export async function registerRunTrackingServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
  } catch (e) {
    console.warn('[run-tracking] Service Worker no registrado', e);
  }
}

export type RunTickPayload = {
  seconds: number;
  km: number;
  paceSecPerKm: number;
};

async function postToActiveSw(message: unknown): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage(message);
}

export function postRunTickToSw(payload: RunTickPayload): void {
  void postToActiveSw({ type: 'RUN_TICK', payload });
}

export function postRunStopToSw(): void {
  void postToActiveSw({ type: 'RUN_STOP' });
}
