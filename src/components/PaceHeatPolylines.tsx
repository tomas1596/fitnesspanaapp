import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import type { LatLng } from '@/lib/runAnalysis';
import { segmentRouteByPaceGradient, type PaceHeatTheme } from '@/lib/paceHeatmap';

const LINE_WEIGHT = 5;
/** Resplandor neón (modo oscuro): capa ancha + capa media. */
const GLOW_OUTER_EXTRA = 26;
const GLOW_OUTER_OPACITY = 0.2;
const GLOW_INNER_EXTRA = 14;
const GLOW_INNER_OPACITY = 0.34;

type Props = {
  points: LatLng[];
  /** Ritmo medio de la carrera (s/km); respaldo si faltan datos de tiempo en tramos. */
  avgPaceSecPerKm: number;
  /** Tema del mapa: resplandor en oscuro, colores más contrastados en claro. */
  mapTheme: PaceHeatTheme;
};

/**
 * Degradado por ritmo (verde neón → amarillo → rojo cereza) según ventana móvil de 2 min.
 * Modo noche: dos capas semitransparentes anchas simulan glow neón (Leaflet SVG no expone shadowBlur por trazo).
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
            key={`heat-glow-outer-${i}-${s.color}`}
            positions={s.positions}
            pathOptions={{
              color: s.color,
              weight: LINE_WEIGHT + GLOW_OUTER_EXTRA,
              opacity: GLOW_OUTER_OPACITY,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}
      {isDark &&
        segments.map((s, i) => (
          <Polyline
            key={`heat-glow-inner-${i}-${s.color}`}
            positions={s.positions}
            pathOptions={{
              color: s.color,
              weight: LINE_WEIGHT + GLOW_INNER_EXTRA,
              opacity: GLOW_INNER_OPACITY,
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
