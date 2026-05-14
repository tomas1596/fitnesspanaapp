import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Loader2, Search, SwitchCamera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

/** Zoom digital solicitado donde el navegador lo soporte (p. ej. Chrome); iOS suele ignorarlo. */
const ZOOM_ADVANCED: MediaTrackConstraintSet[] = [{ zoom: 2 } as MediaTrackConstraintSet];

function buildScannerConstraints(
  videoInputs: MediaDeviceInfo[],
  selectedIndex: number,
  includeAdvancedZoom: boolean,
): MediaStreamConstraints {
  const count = Math.max(videoInputs.length, 1);
  const idx = ((selectedIndex % count) + count) % count;
  const dev = videoInputs[idx];

  const baseTrack: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    ...(includeAdvancedZoom ? { advanced: [...ZOOM_ADVANCED] } : {}),
  };

  if (dev?.deviceId) {
    return {
      audio: false,
      video: {
        ...baseTrack,
        deviceId: { exact: dev.deviceId },
      },
    };
  }

  return {
    audio: false,
    video: {
      ...baseTrack,
      facingMode: 'environment',
    },
  };
}

async function getUserMediaWithZoomFallback(constraints: MediaStreamConstraints): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    const vid = constraints.video;
    if (vid && typeof vid === 'object' && 'advanced' in vid && Array.isArray((vid as MediaTrackConstraints).advanced)) {
      const { advanced: _omit, ...restVideo } = vid as MediaTrackConstraints;
      return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: restVideo,
      });
    }
    throw e;
  }
}

/** Formato esperado por la Barcode Detector API cuando está disponible. */
type NativeBarcodeCtor = new (opts?: { formats?: string[] }) => {
  detect(image: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};

function getNativeBarcodeCtor(): NativeBarcodeCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const Ctor = (window as unknown as { BarcodeDetector?: NativeBarcodeCtor }).BarcodeDetector;
  return typeof Ctor === 'function' ? Ctor : undefined;
}

type ErrorWithZXingKind = Error & {
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

const VIDEO_ELEMENT_CLASSNAME = cn(
  'absolute inset-0 h-full w-full object-cover [transform-origin:50%_50%]',
  /** Refuerzo de “zoom”: empuja alejación física y acentúa centro (iOS). */
  'scale-[1.2]',
);

/** Cámara + Barcode Detector API (`detect` sobre el mismo &lt;video&gt;). */
function BarcodeScannerNativeViewport({
  active,
  streamConstraints,
  onDecoded,
  onStartError,
}: {
  active: boolean;
  streamConstraints: MediaStreamConstraints;
  onDecoded: (barcode: string) => void | Promise<void>;
  onStartError?: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const settledRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const onDecodedRef = useRef(onDecoded);

  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  useEffect(() => {
    if (!active) {
      settledRef.current = false;
      return undefined;
    }
    settledRef.current = false;
    let cancelled = false;
    let raf = 0;
    let lastProbe = 0;
    const BARCODE_CTORS = getNativeBarcodeCtor();
    let detectorInstance: InstanceType<NativeBarcodeCtor> | null = null;

    try {
      if (BARCODE_CTORS) {
        detectorInstance = new BARCODE_CTORS({
          formats: ['ean_13', 'ean_8', 'upc_a'],
        });
      }
    } catch {
      detectorInstance = null;
    }

    if (!detectorInstance) {
      return () => {};
    }

    const stopAll = () => {
      cancelAnimationFrame(raf);
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const el = videoRef.current;
      if (el?.srcObject) {
        el.srcObject = null;
      }
    };

    const probeFrame = async (detector: InstanceType<NativeBarcodeCtor>) => {
      const video = videoRef.current;
      if (!video || cancelled || settledRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA)
        return;
      try {
        const codes = await detector.detect(video as unknown as CanvasImageSource);
        if (codes?.length && !settledRef.current) {
          const raw = codes[0]?.rawValue?.trim();
          if (raw) {
            settledRef.current = true;
            stopAll();
            void onDecodedRef.current(raw);
          }
        }
      } catch {
        /* sin código válido — silenciar */
      }
    };

    const loop = (now: number) => {
      if (cancelled || settledRef.current || !detectorInstance) return;
      if (now - lastProbe >= 200) {
        lastProbe = now;
        void probeFrame(detectorInstance);
      }
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        const stream = await getUserMediaWithZoomFallback(streamConstraints);
        if (cancelled || settledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (!el) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }
        el.srcObject = stream;
        await el.play().catch(() => {});
        lastProbe = 0;
        raf = requestAnimationFrame(loop);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        const hw = shouldReportHardwareError(err);
        if (hw) onStartError?.(hw);
      }
    })();

    return () => {
      cancelled = true;
      stopAll();
    };
  }, [active, streamConstraints, onStartError]);

  return (
    <video
      ref={videoRef}
      className={VIDEO_ELEMENT_CLASSNAME}
      muted
      playsInline
      autoPlay
      aria-hidden
    />
  );
}

/** Cámara + decodificación vía ZXing (react-zxing). */
function BarcodeScannerZxingViewport({
  active,
  streamConstraints,
  onDecoded,
  onStartError,
}: {
  active: boolean;
  streamConstraints: MediaStreamConstraints;
  onDecoded: (barcode: string) => void | Promise<void>;
  onStartError?: (message: string) => void;
}) {
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
    constraints: streamConstraints,
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
      if (isBenignZXingDecodeError(error)) return;
      const hwMessage = shouldReportHardwareError(error);
      if (hwMessage) onStartError?.(hwMessage);
    },
  });

  return (
    <video
      ref={ref}
      className={VIDEO_ELEMENT_CLASSNAME}
      muted
      playsInline
      autoPlay
      aria-hidden
    />
  );
}

/** Línea láser sólo cosmética (keyframes globales únicos por id). */
function BarcodeLaserScanLine() {
  const styleId = 'nutrition-bc-laser-keyframes';
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (document.getElementById(styleId)) return undefined;
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = `
      @keyframes nutrition-barcode-laser-y {
        0%, 100% { top: 12%; opacity: 0.7; }
        50% { top: 80%; opacity: 1; }
      }
    `;
    document.head.appendChild(el);
    return undefined;
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[8] overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute left-[6%] right-[6%] h-[3px] rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.95)]"
        style={{
          animation: 'nutrition-barcode-laser-y 2.4s ease-in-out infinite alternate',
        }}
      />
    </div>
  );
}

export function NutritionBarcodeScanner({
  active,
  className,
  onCancel,
  onDecoded,
  onStartError,
}: NutritionBarcodeScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [slowCameraHint, setSlowCameraHint] = useState(false);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [cameraIndex, setCameraIndex] = useState(0);

  const prefersNativeBarcodeApi = useSyncExternalStore(
    () => () => {},
    () => typeof window !== 'undefined' && getNativeBarcodeCtor() !== undefined,
    () => false,
  );

  const manualInputRef = useRef<HTMLInputElement>(null);

  const streamConstraintsNative = useMemo(
    () => buildScannerConstraints(videoInputs, cameraIndex, true),
    [videoInputs, cameraIndex],
  );

  /** Sin `advanced` de zoom para evitar Overconstrained en navegadores que no lo soporten (ZXing usa getUserMedia interno). */
  const streamConstraintsZxing = useMemo(
    () => buildScannerConstraints(videoInputs, cameraIndex, false),
    [videoInputs, cameraIndex],
  );

  const cycleCamera = useCallback(() => {
    const n = videoInputs.length;
    if (n <= 1) return;
    setCameraIndex((i) => (i + 1) % n);
  }, [videoInputs.length]);

  const focusManualBarcode = () => {
    document.getElementById('nutrition-manual-barcode-section')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
    manualInputRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    setManualCode('');
    setCameraIndex(0);
    setVideoInputs([]);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const vid = list.filter((d) => d.kind === 'videoinput' && d.deviceId);
        setVideoInputs(vid);
      } catch {
        if (!cancelled) setVideoInputs([]);
      }
    };
    void refresh();

    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      setSlowCameraHint(false);
      return undefined;
    }
    setSlowCameraHint(false);
    const t = window.setTimeout(() => setSlowCameraHint(true), 10_000);
    return () => window.clearTimeout(t);
  }, [active]);

  const handleManualLookup = useCallback(() => {
    const raw = manualCode.trim();
    if (!raw) return;
    void onDecoded(raw);
  }, [manualCode, onDecoded]);

  const viewport: ReactNode = active ? (
    prefersNativeBarcodeApi ? (
      <BarcodeScannerNativeViewport
        active={active}
        streamConstraints={streamConstraintsNative}
        onDecoded={onDecoded}
        onStartError={onStartError}
      />
    ) : (
      <BarcodeScannerZxingViewport
        active={active}
        streamConstraints={streamConstraintsZxing}
        onDecoded={onDecoded}
        onStartError={onStartError}
      />
    )
  ) : (
    <div className="absolute inset-0 bg-neutral-950" />
  );

  const showFlipCamera = active && videoInputs.length > 1;

  return (
    <div className={cn('space-y-4', className)}>
      <p className="text-center text-sm text-muted-foreground">
        Podés buscar primero por número o enfocá el código con la cámara.
      </p>
      <div id="nutrition-manual-barcode-section" className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ingresar código de barras manualmente
        </p>
        <div className="flex gap-2">
          <label htmlFor="nutrition-manual-barcode" className="sr-only">
            Código de barras manual
          </label>
          <Input
            id="nutrition-manual-barcode"
            ref={manualInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej. EAN‑13…"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleManualLookup();
              }
            }}
            className={cn(
              'min-h-[44px] flex-1 rounded-xl border-border/70 bg-background text-base',
              'placeholder:text-muted-foreground/70',
            )}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            title="Buscar producto por código"
            className="h-11 w-11 shrink-0 rounded-xl"
            aria-label="Buscar producto"
            onClick={handleManualLookup}
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="relative mx-auto aspect-[16/9] max-h-[min(40vh,280px)] w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-black">
        {viewport}
        {active && (
          <>
            <BarcodeLaserScanLine />
            {showFlipCamera ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Cambiar cámara"
                title="Otra lente trasera"
                className="absolute right-3 top-3 z-20 h-11 w-11 shrink-0 rounded-full border border-white/25 bg-black/55 text-white shadow-lg backdrop-blur-sm hover:bg-black/70"
                onClick={(e) => {
                  e.stopPropagation();
                  cycleCamera();
                }}
              >
                <SwitchCamera className="h-5 w-5" />
              </Button>
            ) : null}
          </>
        )}
      </div>
      {active ? (
        <p className="mx-auto max-w-[400px] text-center text-[11px] leading-snug text-muted-foreground px-1">
          Probá también alejar el teléfono ~20–25 cm si el centro se ve muy ampliado: ayuda al enfoque.
        </p>
      ) : (
        <p className="sr-only">Escáner inactivo.</p>
      )}
      {slowCameraHint && active && (
        <p role="note" className="text-center text-xs leading-snug text-amber-800 dark:text-amber-400/95">
          ¿Problemas con la cámara? Probá{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={focusManualBarcode}
          >
            ingresando el código manualmente
          </button>
          .
        </p>
      )}
      <Button type="button" variant="outline" className="w-full rounded-xl font-semibold" onClick={onCancel}>
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
