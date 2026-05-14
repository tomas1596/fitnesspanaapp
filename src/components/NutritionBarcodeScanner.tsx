import { useEffect, useId, useRef } from 'react';
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

const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
];

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

  useEffect(() => {
    settledRef.current = false;
    if (!active) {
      const inst = instanceRef.current;
      instanceRef.current = null;
      if (inst?.isScanning) {
        void inst.stop().catch(() => {});
      }
      inst?.clear();
      return undefined;
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const start = async () => {
      /** Dar tiempo al Dialog / layout para pintar `#regionId`. */
      await new Promise<void>((resolve) => {
        timeouts.push(setTimeout(resolve, 150));
      });
      if (cancelled || !document.getElementById(regionId)) return;

      const html5 = new Html5Qrcode(regionId, {
        verbose: false,
        formatsToSupport: BARCODE_FORMATS,
        useBarCodeDetectorIfSupported: true,
      });
      instanceRef.current = html5;

      try {
        await html5.start(
          { facingMode: 'environment' },
          {
            fps: 10,
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
            try {
              if (html5.isScanning) await html5.stop();
            } catch {
              /* ignore */
            }
            html5.clear();
            instanceRef.current = null;
            await onDecoded(code);
          },
          () => {},
        );
      } catch (e: unknown) {
        if (cancelled) return;
        const msg =
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Podés permitir el acceso en la configuración del navegador o cargar los datos a mano.'
            : e instanceof Error
              ? e.message || 'No se pudo iniciar la cámara.'
              : 'No se pudo iniciar la cámara.';
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
      if (inst?.isScanning) {
        void inst.stop().catch(() => {});
      }
      inst?.clear();
    };
  }, [active, regionId, onDecoded, onStartError]);

  if (!active) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-center text-sm text-muted-foreground">
        Enfocá el código de barras del producto. Se usará la cámara trasera si está disponible.
      </p>
      <div
        id={regionId}
        className="mx-auto overflow-hidden rounded-2xl border border-border bg-black/90"
        style={{ minHeight: 'min(280px, 45vh)', width: '100%', maxWidth: 400 }}
      />
      <Button
        type="button"
        variant="secondary"
        className="w-full rounded-xl font-semibold"
        onClick={() => {
          settledRef.current = true;
          const inst = instanceRef.current;
          instanceRef.current = null;
          if (inst?.isScanning) void inst.stop().catch(() => {});
          inst?.clear();
          onCancel();
        }}
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
