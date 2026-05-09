import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import type { LatLng } from '@/lib/runAnalysis';
import { segmentRouteByPaceGradient, type PaceHeatTheme } from '@/lib/paceHeatmap';

const LINE_WEIGHT = 5;

type Props = {
  points: LatLng[];
  /** Ritmo medio de la carrera (s/km); si es 0 se usa la mediana de tramos. */
  avgPaceSecPerKm: number;
  /** Tema del mapa: resplandor en oscuro, colores más contrastados en claro. */
  mapTheme: PaceHeatTheme;
};

/**
 * Degradado por ritmo (verde neón → amarillo → rojo cereza).
 * Modo noche: capa ancha semitransparente debajo simula glow (Leaflet SVG no expone shadowBlur por trazo).
 */
export function PaceHeatPolylines({ points, avgPaceSecPerKm, mapTheme }: Props) {
  const segments = useMemo(
    () => segmentRouteByPaceGradient(points, avgPaceSecPerKm, mapTheme),
    [points, avgPaceSecPerKm, mapTheme],
  );

  if (points.length < 2) return null;

  const isDark = mapTheme === 'dark';

  return (
    <>
      {isDark &&
        segments.map((s, i) => (
          <Polyline
            key={`heat-glow-${i}-${s.color}`}
            positions={s.positions}
            pathOptions={{
              color: s.color,
              weight: LINE_WEIGHT + 12,
              opacity: 0.22,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}
      {segments.map((s, i) => (
        <Polyline
          key={`heat-${i}-${s.color}`}
          positions={s.positions}
          pathOptions={{
            color: s.color,
            weight: LINE_WEIGHT,
            opacity: isDark ? 0.98 : 1,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
    </>
  );
}
