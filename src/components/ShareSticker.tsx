import { useRef, useState } from 'react';
import * as htmlToImage from 'html-to-image';
import { Share2, Sun, Moon } from 'lucide-react';
import type { LatLng } from '@/lib/runAnalysis';
import { fmtTime, fmtPace } from '@/lib/runFormat';

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

const NEON = '#22FF55';
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
        <text x={SVG_W / 2} y={SVG_H / 2} textAnchor="middle" fill="#555" fontSize="9">
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
      className="shrink-0"
      style={{ filter: `drop-shadow(0 0 4px ${NEON}88)` }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={d} fill="none" stroke={NEON} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
      <circle cx={start[0]} cy={start[1]} r={DOT_R} fill={NEON} />
      <circle cx={end[0]} cy={end[1]} r={DOT_R} fill="#ef4444" />
    </svg>
  );
}

/* ─── Pana logo inline SVG ─────────────────────────────────────────────────── */
function PanaLogo({ dark }: { dark: boolean }) {
  const accent = NEON;
  const bg = dark ? '#141417' : '#f0fdf4';
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill={bg} />
      <path fill={accent} d="M8 12h3v8H8V12zm13 0h3v8h-3V12z" />
      <path stroke={accent} strokeWidth="2.5" strokeLinecap="round" d="M11 16h10" />
      <circle cx="9.5" cy="16" r="2.25" fill={accent} />
      <circle cx="22.5" cy="16" r="2.25" fill={accent} />
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

  const isDark = theme === 'night';

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

  /* ── Night theme tokens ── */
  const nightBg = 'rgba(0,0,0,0.82)';
  const nightBorder = 'rgba(34,255,85,0.18)';
  const textPrimary = isDark ? '#ffffff' : '#0a1a0f';
  const textMuted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,26,15,0.5)';
  const accentColor = NEON;
  const dividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,26,15,0.12)';

  const stickerStyle: React.CSSProperties = isDark
    ? {
        background: nightBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1.5px solid ${nightBorder}`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${nightBorder} inset, 0 0 20px rgba(34,255,85,0.06)`,
      }
    : {
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(16,185,129,0.2)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(16,185,129,0.1) inset',
      };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'day' : 'night')}
          className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isDark ? 'Modo Día' : 'Modo Noche'}
        </button>
        <button
          type="button"
          onClick={() => void handleShare()}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-full bg-[#22FF55] px-4 py-1.5 text-xs font-bold text-black transition active:scale-95 disabled:opacity-60"
        >
          <Share2 className="h-3.5 w-3.5" />
          {exporting ? 'Generando…' : 'Compartir'}
        </button>
      </div>

      {/* Preview (visible) */}
      <div
        ref={stickerRef}
        style={{
          width: 450,
          height: 150,
          borderRadius: 24,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 0,
          position: 'relative',
          overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          ...stickerStyle,
        }}
      >
        {/* ── LEFT: Route trace ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 90,
            flexShrink: 0,
          }}
        >
          <RouteTrace points={routePoints} />
          <span
            style={{
              marginTop: 4,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: textMuted,
            }}
          >
            Ruta
          </span>
        </div>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 80, background: dividerColor, flexShrink: 0, marginLeft: 6, marginRight: 18 }} />

        {/* ── CENTER: Distance ── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {distanceKm.toFixed(2)}
          </span>
          <span
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: accentColor,
            }}
          >
            Kilómetros
          </span>
        </div>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 80, background: dividerColor, flexShrink: 0, marginLeft: 18, marginRight: 18 }} />

        {/* ── RIGHT: Stats ── */}
        <div
          style={{
            width: 110,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>
              Tiempo
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {fmtTime(durationSec)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: textMuted }}>
              Ritmo
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: textPrimary, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {fmtPace(avgPaceSecPerKm)}<span style={{ fontSize: 11, fontWeight: 600, color: textMuted }}> /km</span>
            </div>
          </div>
        </div>

        {/* ── Branding: top-right ── */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            opacity: 0.7,
          }}
        >
          <PanaLogo dark={isDark} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: textMuted,
            }}
          >
            Pana Fitness
          </span>
        </div>
      </div>
    </div>
  );
}
