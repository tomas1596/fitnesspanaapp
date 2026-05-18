import { useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { Share2, Sun, Moon } from 'lucide-react';
import type { LatLng } from '@/lib/runAnalysis';
import { fmtTime, fmtPace } from '@/lib/runFormat';
import { cn } from '@/lib/utils';

interface ShareStickerProps {
  distanceKm: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  routePoints: LatLng[];
}

type Theme = 'night' | 'day';

/** Normalize points to fit inside a [0, size] square, with padding. */
function normalizePoints(
  points: LatLng[],
  width: number,
  height: number,
  padding: number,
): [number, number][] {
  if (points.length === 0) return [];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const rangeX = maxLng - minLng || 1;
  const rangeY = maxLat - minLat || 1;

  const uw = width - padding * 2;
  const uh = height - padding * 2;
  const scale = Math.min(uw / rangeX, uh / rangeY);
  const ox = padding + (uw - rangeX * scale) / 2;
  const oy = padding + (uh - rangeY * scale) / 2;

  return points.map((p) => [
    ox + (p.lng - minLng) * scale,
    oy + (maxLat - p.lat) * scale,
  ]);
}

/** Thin the points to at most maxPts to keep the SVG path light. */
function thinPoints(points: LatLng[], maxPts: number): LatLng[] {
  if (points.length <= maxPts) return points;
  const step = points.length / maxPts;
  const out: LatLng[] = [];
  for (let i = 0; i < maxPts; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

const SVG_W = 80;
const SVG_H = 80;
const PAD = 6;
const DOT_R = 3.5;

function RouteTrace({ points }: { points: LatLng[] }) {
  const thin = thinPoints(points, 300);
  const pts = normalizePoints(thin, SVG_W, SVG_H, PAD);

  if (pts.length < 2) {
    return (
      <svg width={SVG_W} height={SVG_H} className="shrink-0">
        <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" fill="#888" fontSize="9">
          Sin ruta
        </text>
      </svg>
    );
  }

  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="shrink-0 text-primary"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={start[0]} cy={start[1]} r={DOT_R} fill="currentColor" />
      <circle cx={end[0]} cy={end[1]} r={DOT_R} fill="#ef4444" />
    </svg>
  );
}

export default function ShareSticker({
  distanceKm,
  durationSec,
  avgPaceSecPerKm,
  routePoints,
}: ShareStickerProps) {
  const stickerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>('night');
  const [exporting, setExporting] = useState(false);

  const isNight = theme === 'night';

  const handleShare = async () => {
    if (!stickerRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await htmlToImage.toPng(stickerRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        skipFonts: false,
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'pana-run.png', { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mi carrera en Pana Fitness' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'pana-run.png';
        a.click();
      }
    } catch (err) {
      console.error('ShareSticker export error:', err);
    } finally {
      setExporting(false);
    }
  };

  const textStrong = isNight ? '#ffffff' : '#0f172a';
  const statLabel = isNight ? 'rgba(255,255,255,0.45)' : 'rgba(71,85,105,0.92)';
  const paceSuffix = isNight ? 'rgba(255,255,255,0.42)' : 'rgba(71,85,105,0.75)';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(isNight ? 'day' : 'night')}
          className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
        >
          {isNight ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isNight ? 'Modo Día' : 'Modo Noche'}
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold text-black transition active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: 'var(--brand-color)' }}
        >
          <Share2 className="h-3.5 w-3.5" />
          {exporting ? 'Generando…' : 'Compartir'}
        </button>
      </div>

      {/* Preview exportada */}
      <div
        ref={stickerRef}
        data-share-sticker
        className={cn(
          'relative flex h-[174px] w-[450px] items-stretch gap-3 overflow-hidden rounded-3xl px-5 py-4 font-sans antialiased backdrop-blur-md',
          isNight ? 'border border-white/10 bg-black/82 shadow-2xl' : 'border border-black/[0.08] bg-white/95 shadow-xl',
        )}
        style={{
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {/* ── Logo + marca (tarjeta iOS-like) ── */}
        <div
          className={cn(
            'absolute right-5 top-3.5 flex items-center gap-2',
            isNight ? 'text-zinc-300' : 'text-zinc-500',
          )}
        >
          <img
            src="/android-chrome-192x192.png"
            alt="Logo Pana Fitness"
            width={24}
            height={24}
            className={cn(
              'h-6 w-6 shrink-0 rounded-md object-cover shadow-sm ring-1',
              isNight ? 'ring-white/12' : 'ring-black/10',
            )}
          />
          <span className="text-[9px] font-extrabold uppercase tracking-[0.14em]">Pana Fitness</span>
        </div>

        {/* ── Ruta ── */}
        <div className={cn(
          'mt-9 flex w-[104px] shrink-0 flex-col items-center justify-center self-center rounded-2xl px-2 py-2.5 ring-1',
          isNight
            ? 'bg-white/[0.06] ring-white/[0.07]'
            : 'bg-black/[0.045] ring-black/[0.06]',
        )}
        >
          <RouteTrace points={routePoints} />
          <span
            style={{ color: statLabel }}
            className="mt-2 text-[9px] font-bold uppercase tracking-[0.22em]"
          >
            Ruta
          </span>
        </div>

        {/* ── Distancia ── */}
        <div className="mt-9 flex flex-1 flex-col items-center justify-center text-center leading-none">
          <span
            style={{ color: textStrong }}
            className="text-6xl font-black tabular-nums leading-none tracking-tight"
          >
            {distanceKm.toFixed(2)}
          </span>
          <span className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Kilómetros</span>
        </div>

        {/* ── Tiempo · Ritmo ── */}
        <div
          className="mt-9 flex w-[118px] shrink-0 flex-col justify-center gap-5 pr-1"
        >
          <div>
            <div
              style={{ color: statLabel }}
              className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em]"
            >
              Tiempo
            </div>
            <div
              style={{ color: textStrong }}
              className="text-xl font-black tabular-nums leading-snug tracking-tight"
            >
              {fmtTime(durationSec)}
            </div>
          </div>
          <div>
            <div
              style={{ color: statLabel }}
              className="mb-1 text-[9px] font-bold uppercase tracking-[0.22em]"
            >
              Ritmo
            </div>
            <div style={{ color: textStrong }} className="text-xl font-black tabular-nums leading-snug tracking-tight">
              {fmtPace(avgPaceSecPerKm)}
              <span style={{ color: paceSuffix }} className="text-xs font-bold">
                {' '}
                /km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
