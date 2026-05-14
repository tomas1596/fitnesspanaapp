import { BrowserMultiFormatReader } from '@zxing/library';

/**
 * Fracción del lado corto centrado que ZXing usa para decodificar (tipo “qrbox”).
 * Se recalcula en cada fotograma según `videoWidth` / `videoHeight` (rotación, etc.).
 */
export const NUTRITION_SCAN_CENTER_FRACTION = 0.72;

export function drawVideoCenterCropToCanvas(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  fraction = NUTRITION_SCAN_CENTER_FRACTION,
): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;
  const side = Math.min(vw, vh);
  const crop = Math.max(128, Math.floor(side * fraction));
  const sx = Math.floor((vw - crop) / 2);
  const sy = Math.floor((vh - crop) / 2);
  canvas.width = crop;
  canvas.height = crop;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(video, sx, sy, crop, crop, 0, 0, crop, crop);
  return true;
}

export class CenterCropBrowserMultiFormatReader extends BrowserMultiFormatReader {
  drawFrameOnCanvas(
    srcElement: HTMLVideoElement,
    dimensions?: {
      sx: number;
      sy: number;
      sWidth: number;
      sHeight: number;
      dx: number;
      dy: number;
      dWidth: number;
      dHeight: number;
    },
    canvasElementContext?: CanvasRenderingContext2D,
  ): void {
    const vw = srcElement.videoWidth;
    const vh = srcElement.videoHeight;

    if (!vw || !vh) {
      super.drawFrameOnCanvas(srcElement, dimensions, canvasElementContext);
      return;
    }

    const side = Math.min(vw, vh);
    const crop = Math.max(128, Math.floor(side * NUTRITION_SCAN_CENTER_FRACTION));
    const sx = Math.floor((vw - crop) / 2);
    const sy = Math.floor((vh - crop) / 2);

    if (this.captureCanvas && (this.captureCanvas.width !== crop || this.captureCanvas.height !== crop)) {
      this.captureCanvas.width = crop;
      this.captureCanvas.height = crop;
      this.captureCanvas.style.width = `${crop}px`;
      this.captureCanvas.style.height = `${crop}px`;
      try {
        this.captureCanvasContext = this.captureCanvas.getContext('2d', {
          willReadFrequently: true,
        }) as CanvasRenderingContext2D;
      } catch {
        this.captureCanvasContext = this.captureCanvas.getContext('2d') as CanvasRenderingContext2D;
      }
    }

    const ctx = canvasElementContext ?? this.captureCanvasContext;
    if (!ctx) {
      super.drawFrameOnCanvas(srcElement, dimensions, canvasElementContext);
      return;
    }

    super.drawFrameOnCanvas(
      srcElement,
      {
        sx,
        sy,
        sWidth: crop,
        sHeight: crop,
        dx: 0,
        dy: 0,
        dWidth: crop,
        dHeight: crop,
      },
      ctx,
    );
  }
}
