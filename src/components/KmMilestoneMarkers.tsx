import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/lib/runAnalysis';
import { getKmMilestonePositions } from '@/lib/runAnalysis';
import type { PaceHeatTheme } from '@/lib/paceHeatmap';

function kmDiscIcon(km: number, theme: PaceHeatTheme) {
  const isDark = theme === 'dark';
  const size = 26;
  const bg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)';
  const border = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.2)';
  const color = isDark ? '#f8fafc' : '#0f172a';
  const shadow = isDark ? '0 0 14px rgba(57,255,20,0.35)' : '0 2px 8px rgba(0,0,0,0.12)';
  const label = `${km}`;
  return L.divIcon({
    className: 'nrc-km-disc',
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:10px;
      font-weight:800;
      font-family:system-ui,sans-serif;
      color:${color};
      background:${bg};
      -webkit-backdrop-filter:blur(10px);
      backdrop-filter:blur(10px);
      border:1px solid ${border};
      box-shadow:${shadow};
      box-sizing:border-box;
    ">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type Props = {
  points: LatLng[];
  mapTheme: PaceHeatTheme;
};

export function KmMilestoneMarkers({ points, mapTheme }: Props) {
  const milestones = useMemo(() => getKmMilestonePositions(points), [points]);
  if (milestones.length === 0) return null;
  return (
    <>
      {milestones.map((m) => (
        <Marker key={m.km} position={[m.lat, m.lng]} icon={kmDiscIcon(m.km, mapTheme)} />
      ))}
    </>
  );
}
