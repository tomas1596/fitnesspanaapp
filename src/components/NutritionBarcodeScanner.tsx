import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { cn } from '@/lib/utils';

export type NutritionBarcodeScannerProps = {
  active: boolean;
  className?: string;
  onCancel: () => void;
  onDecoded: (barcode: string) => void | Promise<void>;
  onStartError?: (message: string) => void;
};

/** Códigos de barras típicos de alimentación (retail). */
const SUPERMARKET_BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
];

/**
 * Liberación ordenada recomendada por html5-qrcode: stop asíncrono y luego clear.
 * Ignora errores (pista ya cerrada, etc.).
 */
async function safeStopAndClear(camera: Html5Qrcode): Promise<void> {
  try {
    if (camera.isScanning) await camera.stop();
  } catch {
    /* ignorar — plataforma o estado inconsistente */
  }
  try {
    camera.clear();
  } catch {
    /* ignorar */
  }
}

/** Constraints de vídeo (`videoConstraints` del scan config; la librería los usa con getUserMedia). */
function buildVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: 'environment',
    advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
  };
}

/**
 * Lector html5-qrcode (cámara trasera cuando el dispositivo lo permite).
 * Pensado para PWAs en iOS Safari y Android Chrome.
 */
export function NutritionBarcodeScanner({
  active,
  className,
  onCancel,
  onDecoded,
  onStartError,
}: NutritionBarcodeScannerProps) {
  const reactId = useId();
  const regionId = `nutrition-bc-${reactId.replace(/:/g, '')}`;
  const instanceRef = useRef<Html5Qrcode | null>(null);
  const settledRef = useRef(false);
  /** Mantener el hueco DOM montado hasta que stop+clear terminan (evita pantalla gris). */
  const [isReleasingCamera, setIsReleasingCamera] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const showChrome = active || isReleasingCamera;

  useLayoutEffect(() => {
    if (!active) {
      if (instanceRef.current?.isScanning) setIsReleasingCamera(true);
      else setIsReleasingCamera(false);
    } else {
      setIsReleasingCamera(false);
    }
  }, [active]);

  useEffect(() => {
    settledRef.current = false;

    /** El padre dejó de mostrar modo escaneo pero el efecto anterior puede seguir cerrando por cleanup. */
    if (!active) {
      void (async () => {
        const inst = instanceRef.current;
        if (!inst) {
          setIsReleasingCamera(false);
          return;
        }
        await safeStopAndClear(inst);
        if (instanceRef.current === inst) instanceRef.current = null;
        setIsReleasingCamera(false);
      })();
      return undefined;
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const start = async () => {
      await new Promise<void>((resolve) => {
        timeouts.push(setTimeout(resolve, 150));
      });
      if (cancelled || !document.getElementById(regionId)) return;

      const html5 = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: SUPERMARKET_BARCODE_FORMATS,
        useBarCodeDetectorIfSupported: true,
      });

      const videoConstraints = buildVideoConstraints();

      try {
        await html5.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            videoConstraints,
            qrbox(viewfinderWidth, viewfinderHeight) {
              const w = Math.floor(viewfinderWidth * 0.92);
              const h = Math.min(160, Math.max(96, Math.floor(viewfinderHeight * 0.32)));
              return { width: w, height: h };
            },
          },
          async (decodedText) => {
            const code = decodedText?.trim();
            if (!code || cancelled || settledRef.current) return;
            settledRef.current = true;
            await safeStopAndClear(html5);
            if (instanceRef.current === html5) instanceRef.current = null;
            await onDecoded(code);
          },
          () => {},
        );

        if (cancelled) {
          await safeStopAndClear(html5);
          if (instanceRef.current === html5) instanceRef.current = null;
          return;
        }
        instanceRef.current = html5;
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Podés permitir el acceso en la configuración del navegador o cargar los datos a mano.'
            : e instanceof Error
              ? e.message || 'No se pudo iniciar la cámara.'
              : 'No se pudo iniciar la cámara.';
        try {
          await safeStopAndClear(html5);
        } catch {
          /* no-op */
        }
        instanceRef.current = null;
        onStartError?.(msg);
      }
    };

    void start();

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      settledRef.current = false;
      const inst = instanceRef.current;
      instanceRef.current = null;
      if (inst) void safeStopAndClear(inst);
    };
  }, [active, regionId, onDecoded, onStartError]);

  if (!showChrome) return null;

  const handleCancel = () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    settledRef.current = true;
    const inst = instanceRef.current;
    void (async () => {
      try {
        if (inst) await safeStopAndClear(inst);
      } finally {
        if (instanceRef.current === inst) instanceRef.current = null;
        setCancelBusy(false);
        onCancel();
      }
    })();
  };

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-center text-sm text-muted-foreground">
        {!active && isReleasingCamera
          ? 'Cerrando la cámara…'
          : 'Enfocá el código de barras del producto. Se usará la cámara trasera si está disponible.'}
      </p>
      <div
        id={regionId}
        className="mx-auto overflow-hidden rounded-2xl border border-border bg-black/90"
        style={{ minHeight: 'min(280px, 45vh)', width: '100%', maxWidth: 400 }}
      />
      {active ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-xl font-semibold"
          disabled={cancelBusy}
          onClick={handleCancel}
        >
          Cancelar escaneo
        </Button>
      ) : (
        <p className="sr-only">Cámara cerrándose.</p>
      )}
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
