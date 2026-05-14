import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/lib/runAnalysis';
import { getKmMilestonePositions } from '@/lib/runAnalysis';
import type { PaceHeatTheme } from '@/lib/paceHeatmap';
import { useBrandColorHex } from '@/hooks/useBrandColorHex';

function readBrandGlow(): string {
  if (typeof document === 'undefined') return 'rgba(57,255,20,0.45)';
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--brand-glow').trim() || 'rgba(57,255,20,0.45)'
  );
}

function kmDiscIcon(km: number, theme: PaceHeatTheme) {
  const isDark = theme === 'dark';
  const h = 30;
  const bg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';
  const border = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.22)';
  const color = isDark ? '#f8fafc' : '#0f172a';
  const shadow = isDark ? `0 0 18px ${readBrandGlow()}` : '0 2px 10px rgba(0,0,0,0.14)';
  const label = `${km} km`;
  const iconW = km >= 10 ? 52 : 44;
  return L.divIcon({
    className: 'nrc-km-disc',
    html: `<div style="
      min-width:${iconW}px;
      height:${h}px;
      padding:0 8px;
      border-radius:9999px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      font-weight:800;
      font-family:system-ui,sans-serif;
      white-space:nowrap;
      color:${color};
      background:${bg};
      -webkit-backdrop-filter:blur(15px);
      backdrop-filter:blur(15px);
      border:1px solid ${border};
      box-shadow:${shadow};
      box-sizing:border-box;
    ">${label}</div>`,
    iconSize: [iconW, h],
    iconAnchor: [iconW / 2, h / 2],
  });
}

type Props = {
  points: LatLng[];
  mapTheme: PaceHeatTheme;
};

export function KmMilestoneMarkers({ points, mapTheme }: Props) {
  const brandHex = useBrandColorHex();
  const milestones = useMemo(() => getKmMilestonePositions(points), [points]);
  if (milestones.length === 0) return null;
  return (
    <>
      {milestones.map((m) => (
        <Marker key={`${m.km}-${brandHex}`} position={[m.lat, m.lng]} icon={kmDiscIcon(m.km, mapTheme)} />
      ))}
    </>
  );
}
