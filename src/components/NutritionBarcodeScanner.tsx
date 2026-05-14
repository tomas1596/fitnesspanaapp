import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZxing } from 'react-zxing';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { cn } from '@/lib/utils';

export type NutritionBarcodeScannerProps = {
  active: boolean;
  className?: string;
  onCancel: () => void;
  onDecoded: (barcode: string) => void | Promise<void>;
  onStartError?: (message: string) => void;
};

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: 'environment' },
};

type ErrorWithZXingKind = Error & {
  /** ZXing-ts: `ReaderException` subclasses exponen tipo vía `.getKind()`. */
  getKind?: () => string;
};

function isBenignZXingDecodeError(error: Error): boolean {
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('no multiformat readers')) return true;

  const getKind = (error as ErrorWithZXingKind).getKind;
  if (typeof getKind === 'function') {
    const kind = getKind.call(error);
    if (
      kind === 'NotFoundException' ||
      kind === 'ChecksumException' ||
      kind === 'FormatException'
    ) {
      return true;
    }
  }

  const n = error.name || '';
  if (n === 'NotFoundException' || n === 'ChecksumException' || n === 'FormatException') return true;

  return false;
}

function shouldReportHardwareError(error: Error): string | null {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'Permiso de cámara denegado. Podés permitir el acceso en la configuración del navegador o cargar los datos a mano.';
      case 'NotFoundError':
        return 'No se detectó ninguna cámara en el dispositivo.';
      case 'NotReadableError':
      case 'AbortError':
        return 'La cámara está en uso o no se puede abrir. Probá cerrar otras apps que la usen.';
      case 'OverconstrainedError':
        return 'No se pudo inicializar la cámara con la configuración actual.';
      default:
        break;
    }
  }

  const m = (error.message || '').toLowerCase();
  if (/permission\s*denied|not\s*allowed|user\s*denied|denied by system/i.test(m)) {
    return 'Permiso de cámara denegado o bloqueado. Revisá ajustes del navegador o del sistema.';
  }
  if (/no camera|devices not found|could not find|no .*video input/i.test(m)) {
    return 'No se encontró cámara disponible.';
  }
  if (/could not start video source|failed to allocate|device in use/i.test(m)) {
    return 'No se pudo acceder a la cámara. Puede estar en uso por otra aplicación.';
  }

  return null;
}

/**
 * Lector ZXing (@zxing/library) vía `react-zxing`; suele comportarse mejor en iOS Safari que html5-qrcode.
 * `react-zxing` usa la callback `onResult` (equivale al flujo solicitado tipo onDecodeResult).
 */
export function NutritionBarcodeScanner({
  active,
  className,
  onCancel,
  onDecoded,
  onStartError,
}: NutritionBarcodeScannerProps) {
  const settledRef = useRef(false);
  const [scanDonePause, setScanDonePause] = useState(false);
  const onDecodedRef = useRef(onDecoded);

  const hints = useMemo(
    () =>
      new Map<DecodeHintType, unknown>([
        [
          DecodeHintType.POSSIBLE_FORMATS,
          [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A],
        ],
        [DecodeHintType.TRY_HARDER, true],
      ]),
    [],
  );

  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  useEffect(() => {
    if (active) {
      settledRef.current = false;
      setScanDonePause(false);
    }
  }, [active]);

  const { ref } = useZxing({
    paused: !active || scanDonePause,
    hints,
    constraints: CAMERA_CONSTRAINTS,
    /** Más intentos por segundo pueden ayudar en cámara movil lentilla; coste algo mayor de CPU. */
    timeBetweenDecodingAttempts: 200,
    onResult(result) {
      if (!active || settledRef.current) return;
      const text = result.getText()?.trim();
      if (!text) return;
      settledRef.current = true;
      setScanDonePause(true);
      void onDecodedRef.current(text);
    },
    onError(error) {
      if (!active) return;

      /** Cada fotograma sin código dispara estos errores; nunca molestar al usuario. */
      if (isBenignZXingDecodeError(error)) return;

      const hwMessage = shouldReportHardwareError(error);
      if (hwMessage) {
        onStartError?.(hwMessage);
      }
      /** Errores no clasificados: silenciar para no inundar la UI (el escaneo sigue en vivo). */
    },
  });

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-center text-sm text-muted-foreground">
        Enfocá el código de barras del producto. Se usará la cámara trasera si está disponible.
      </p>
      <div className="relative mx-auto aspect-[16/9] max-h-[min(40vh,280px)] w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-black">
        <video
          ref={ref}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
          aria-hidden
        />
      </div>
      {active ? (
        <p className="mx-auto max-w-[400px] text-center text-[11px] leading-snug text-muted-foreground px-1">
          Mantené el código recto, sin reflejos y a unos 15 cm de distancia
        </p>
      ) : (
        <p className="sr-only">Escáner inactivo.</p>
      )}
      <Button
        type="button"
        variant="secondary"
        className="w-full rounded-xl font-semibold"
        onClick={onCancel}
      >
        Cancelar escaneo
      </Button>
    </div>
  );
}

export function NutritionBarcodeScanLoadingOverlay() {
  return (
    <div
      className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 rounded-xl bg-background/92 px-4 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-center text-sm font-semibold text-foreground">Buscando producto…</p>
    </div>
  );
}
