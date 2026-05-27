import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { blobFromSquareCrop } from '@/lib/avatarCrop';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AvatarCropModalProps {
  /** Data URL temporal de la foto elegida por el usuario. */
  imageSrc: string | null;
  open: boolean;
  onCancel: () => void;
  /** Recibe el thumbnail cuadrado listo para subir (se muestra circular en UI). */
  onApply: (blob: Blob) => void | Promise<void>;
}

const ZOOM_SLIDER_STEP = 0.02;

/**
 * Modal de recorte (1:1): mínima configuración del cropper + zoom por slider.
 */
export function AvatarCropModal({ imageSrc, open, onCancel, onApply }: AvatarCropModalProps) {
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

  const handleApply = async () => {
    if (!imageSrc || applying) return;
    const pix = croppedPixelsRef.current;
    if (!pix) return;
    setApplying(true);
    try {
      const blob = await blobFromSquareCrop(imageSrc, pix);
      await onApply(blob);
    } finally {
      setApplying(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !applying) onCancel();
      }}
    >
      <DialogContent
        className={cn(
          'w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-black shadow-2xl',
          'dark:border-zinc-700/80 dark:bg-zinc-950 dark:text-white',
        )}
      >
        <DialogHeader className="px-4 pt-5 text-left sm:px-5">
          <DialogTitle id="avatar-crop-title" className="text-center text-base font-semibold text-zinc-900 dark:text-white">
            Ajustar Foto
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-zinc-600 dark:text-zinc-400">
            Mové la imagen y usá zoom para encuadrar. Se verá circular en tu perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] app-main-scroll sm:px-5">
          <div className="relative z-0 h-[min(52vh,340px)] w-full">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              minZoom={1}
              maxZoom={4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              classes={{
                cropAreaClassName: 'border-2 border-white/80',
              }}
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
              rangeClassName="bg-primary"
              thumbClassName="border-primary bg-white shadow-md focus-visible:ring-primary/50 dark:bg-zinc-950 dark:focus-visible:ring-primary/45"
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
                'h-11 flex-1 rounded-xl border-0 font-semibold text-primary-foreground shadow-lg transition',
                'bg-primary hover:bg-[color:var(--brand-hover)]',
                'shadow-[0_0_22px_var(--brand-glow)]',
              )}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
