import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { blobFromCircularCrop } from '@/lib/avatarCrop';
import { cn } from '@/lib/utils';

interface AvatarCropModalProps {
  /** `URL.createObjectURL` de la foto elegida por el usuario. */
  imageSrc: string | null;
  open: boolean;
  onCancel: () => void;
  /** Recibe el thumbnail listo para subir (JPEG circular). */
  onApply: (blob: Blob) => void | Promise<void>;
}

const ZOOM_SLIDER_STEP = 0.02;

/**
 * Modal de recorte circular (premium): zoom por slider + arrastre nativo del cropper.
 */
export function AvatarCropModal({ imageSrc, open, onCancel, onApply }: AvatarCropModalProps) {
  const { resolved } = useTheme();
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const croppedPixelsRef = useRef<Area | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open || !imageSrc) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    croppedPixelsRef.current = null;
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, applying]);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    croppedPixelsRef.current = areaPixels;
  }, []);

  /** Visibilidad del velo circular: la sombra usa `color` como currentColor en react-easy-crop. */
  const cropVisualStyle = useMemo(() => {
    const overlay =
      resolved === 'dark'
        ? 'rgba(0, 0, 0, 0.7)'
        : 'rgba(15, 23, 42, 0.48)';
    return {
      cropAreaStyle: {
        border: '2px solid #FF1493',
        boxShadow: `0 0 0 9999em ${overlay}`,
      } as CSSProperties,
      containerBg: resolved === 'dark' ? '#18181b' : '#f4f4f5',
    };
  }, [resolved]);

  const handleApply = async () => {
    if (!imageSrc || applying) return;
    const pix = croppedPixelsRef.current;
    if (!pix) return;
    setApplying(true);
    try {
      const blob = await blobFromCircularCrop(imageSrc, pix);
      await onApply(blob);
    } finally {
      setApplying(false);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[220] flex items-end justify-center sm:items-center',
        'bg-black/60 backdrop-blur-sm',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !applying) onCancel();
      }}
    >
      <div
        className={cn(
          'flex max-h-[95dvh] w-full max-w-md flex-col gap-4 rounded-t-3xl border p-4 text-black shadow-2xl',
          'border-zinc-200 bg-white dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white',
          'sm:rounded-3xl sm:p-5',
        )}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="avatar-crop-title" className="text-center text-base font-semibold text-zinc-900 dark:text-white">
          Ajustar foto
        </h2>
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
          Mové la imagen y usá zoom para encuadrar. El recorte es circular.
        </p>

        <div
          className={cn(
            'relative h-[min(52vh,340px)] w-full overflow-hidden rounded-2xl ring-1 ring-zinc-200 dark:ring-zinc-700',
          )}
          style={{ backgroundColor: cropVisualStyle.containerBg }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={0}
            aspect={1}
            cropShape="round"
            showGrid={false}
            restrictPosition
            objectFit="contain"
            zoomWithScroll={false}
            minZoom={1}
            maxZoom={4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onRotationChange={() => {}}
            style={{
              cropAreaStyle: cropVisualStyle.cropAreaStyle,
            }}
            classes={{}}
            mediaProps={{
              draggable: false,
            }}
            cropperProps={{
              /** Evita interferir con el scroll de la página bajo el modal en móvil. */
              'aria-label': 'Área de recorte',
              className: 'touch-pan-x touch-pan-y',
            }}
            zoomSpeed={0.65}
            keyboardStep={1}
          />
        </div>

        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            <span>Zoom</span>
            <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{zoom.toFixed(2)}×</span>
          </div>
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={ZOOM_SLIDER_STEP}
            onValueChange={([z]) => setZoom(z)}
            className="py-1"
            trackClassName="bg-zinc-600 dark:bg-zinc-400/35"
            rangeClassName="bg-[#FF1493]"
            thumbClassName="border-[#FF1493] bg-white shadow-md focus-visible:ring-[#FF1493]/50 dark:bg-zinc-950 dark:focus-visible:ring-[#FF1493]/45"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-xl border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={onCancel}
            disabled={applying}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={applying}
            onClick={() => void handleApply()}
            className={cn(
              'h-11 flex-1 rounded-xl border-0 font-semibold text-zinc-950 shadow-lg transition',
              'bg-[#FF1493] hover:bg-[#FF4DA6]',
              'shadow-[0_0_22px_rgba(255,20,147,0.45)]',
            )}
          >
            {applying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Aplicar'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
