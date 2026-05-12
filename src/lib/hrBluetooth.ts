/** UUID corto estándar pulsómetro (Heart Rate). */
const HR_SERVICE = 'heart_rate';
const HR_MEASUREMENT = 'heart_rate_measurement';

export const HR_BT_DEVICE_ID_KEY = 'pana_fitness_hr_bt_device_id';

type GattChar = EventTarget & {
  value: DataView | null;
  startNotifications(): Promise<GattChar>;
  addEventListener(
    type: 'characteristicvaluechanged',
    listener: (ev: Event) => void,
  ): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: (ev: Event) => void): void;
};

type GattServer = {
  connected: boolean;
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<{ getCharacteristic(uuid: string): Promise<GattChar> }>;
};

type BTDevice = EventTarget & {
  id: string;
  gatt?: GattServer;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

type BluetoothApi = {
  requestDevice(options: { filters: { services: string[] }[]; optionalServices?: string[] }): Promise<BTDevice>;
  getDevices?: () => Promise<BTDevice[]>;
};

function getBluetooth(): BluetoothApi | undefined {
  return (navigator as { bluetooth?: BluetoothApi }).bluetooth;
}

function parseHeartRate(data: DataView): number {
  const flags = data.getUint8(0);
  const u16 = (flags & 0x1) !== 0;
  let o = 1;
  if (u16) {
    return data.getUint16(o, true);
  }
  return data.getUint8(o);
}

export type HrConnection = {
  disconnect: () => void;
};

async function beginHrSession(
  device: BTDevice,
  onBpm: (bpm: number) => void,
  onDisconnect: () => void,
): Promise<HrConnection> {
  const gatt = device.gatt;
  if (!gatt) throw new Error('GATT no disponible en el dispositivo.');

  if (!gatt.connected) {
    await gatt.connect();
  }

  const svc = await gatt.getPrimaryService(HR_SERVICE);
  const ch = await svc.getCharacteristic(HR_MEASUREMENT);

  const onValue = (ev: Event) => {
    const target = ev.target as GattChar;
    const v = target.value;
    if (!v) return;
    try {
      onBpm(parseHeartRate(v));
    } catch {
      /* ignore frame */
    }
  };

  await ch.startNotifications();
  ch.addEventListener('characteristicvaluechanged', onValue);

  const onGattDisconnect: EventListener = () => {
    onDisconnect();
  };
  device.addEventListener('gattserverdisconnected', onGattDisconnect);

  return {
    disconnect: () => {
      try {
        ch.removeEventListener('characteristicvaluechanged', onValue);
        device.removeEventListener('gattserverdisconnected', onGattDisconnect);
      } catch {
        /* noop */
      }
      try {
        if (gatt.connected) gatt.disconnect();
      } catch {
        /* noop */
      }
    },
  };
}

/**
 * Conecta a un pulsómetro BLE (servicio Heart Rate), guarda `device.id` en localStorage
 * y emite BPM por `onBpm`.
 */
export async function connectHeartRateSensor(
  onBpm: (bpm: number) => void,
  onDisconnect: () => void,
): Promise<HrConnection> {
  const api = getBluetooth();
  if (!api) {
    throw new Error('Web Bluetooth no disponible en este navegador.');
  }

  const storedId = localStorage.getItem(HR_BT_DEVICE_ID_KEY);
  let device: BTDevice | undefined;

  if (storedId && typeof api.getDevices === 'function') {
    const list = await api.getDevices();
    device = list.find((d) => d.id === storedId);
  }

  if (!device) {
    device = await api.requestDevice({
      filters: [{ services: [HR_SERVICE] }],
      optionalServices: [HR_SERVICE],
    });
    localStorage.setItem(HR_BT_DEVICE_ID_KEY, device.id);
  }

  return beginHrSession(device, onBpm, onDisconnect);
}

/** Reconexión silenciosa al dispositivo guardado (sin selector). */
export async function tryReconnectStoredHeartRate(
  onBpm: (bpm: number) => void,
  onDisconnect: () => void,
): Promise<HrConnection | null> {
  const api = getBluetooth();
  const storedId = localStorage.getItem(HR_BT_DEVICE_ID_KEY);
  if (!api || !storedId || typeof api.getDevices !== 'function') return null;

  const list = await api.getDevices();
  const device = list.find((d) => d.id === storedId);
  if (!device?.gatt) return null;

  return beginHrSession(device, onBpm, onDisconnect);
}
