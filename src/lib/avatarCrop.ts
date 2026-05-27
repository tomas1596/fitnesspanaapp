import type { Area } from 'react-easy-crop';

/** Lado máximo (px) del PNG que subimos como avatar (thumbnail). */
export const AVATAR_THUMB_MAX_SIDE = 512;

/** MIME usado para el thumbnail estándar del perfil (con transparencia). */
export const AVATAR_THUMB_MIME = 'image/png';

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = url;
  });
}

function normalizeSquareCrop(pixelCrop: Area, imageW: number, imageH: number): { sx: number; sy: number; side: number } {
  const side = Math.max(1, Math.round(Math.min(pixelCrop.width, pixelCrop.height)));
  const centerX = pixelCrop.x + pixelCrop.width / 2;
  const centerY = pixelCrop.y + pixelCrop.height / 2;
  const half = side / 2;

  const maxSx = Math.max(0, imageW - side);
  const maxSy = Math.max(0, imageH - side);
  const sx = Math.min(maxSx, Math.max(0, Math.round(centerX - half)));
  const sy = Math.min(maxSy, Math.max(0, Math.round(centerY - half)));
  return { sx, sy, side };
}

/**
 * Genera un blob circular del área seleccionada, reescalado a thumbnail.
 *
 * Futuro: conservar `File` original en el caller y subirlo aparte como alta resolución
 * (`avatar_original_url`) sin pasar por este pipeline.
 */
export async function blobFromCircularCrop(
  imageSrc: string,
  pixelCrop: Area,
  options?: { maxSide?: number; mimeType?: string; quality?: number },
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const { sx, sy, side } = normalizeSquareCrop(pixelCrop, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  const maxSide = Math.min(options?.maxSide ?? AVATAR_THUMB_MAX_SIDE, side);
  canvas.width = maxSide;
  canvas.height = maxSide;
  ctx.clearRect(0, 0, maxSide, maxSide);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.beginPath();
  ctx.arc(maxSide / 2, maxSide / 2, maxSide / 2, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(image, sx, sy, side, side, 0, 0, maxSide, maxSide);

  const mimeType = options?.mimeType ?? AVATAR_THUMB_MIME;
  const quality = options?.quality ?? 0.9;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas vacío'));
      },
      mimeType,
      mimeType === 'image/png' ? undefined : quality,
    );
  });
}
