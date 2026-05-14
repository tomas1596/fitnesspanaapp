import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import type { LatLng } from '@/lib/runAnalysis';
import { segmentRouteByPaceGradient, type PaceHeatTheme } from '@/lib/paceHeatmap';
import { useBrandColorHex } from '@/hooks/useBrandColorHex';

/** Trazo fino y nítido (sin capas de glow). */
const LINE_WEIGHT = 3;

type Props = {
  points: LatLng[];
  /** Ritmo medio de la carrera (s/km); respaldo si faltan datos de tiempo en tramos. */
  avgPaceSecPerKm: number;
  /** Tema del mapa: colores del degradado (verde → rojo según ritmo). */
  mapTheme: PaceHeatTheme;
};

/**
 * Degradado por ritmo (verde → amarillo → rojo) según ventana móvil de 2 min.
 * Línea SVG sólida, sin sombras ni halos extra.
 */
export function PaceHeatPolylines({ points, avgPaceSecPerKm, mapTheme }: Props) {
  const brandHex = useBrandColorHex();
  const segments = useMemo(
    () => segmentRouteByPaceGradient(points, avgPaceSecPerKm, mapTheme),
    [points, avgPaceSecPerKm, mapTheme, brandHex],
  );

  if (points.length < 2) return null;

  return (
    <>
      {segments.map((s, i) => (
        <Polyline
          key={`heat-${i}-${s.color}`}
          positions={s.positions}
          pathOptions={{
            color: s.color,
            weight: LINE_WEIGHT,
            opacity: 1,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      ))}
    </>
  );
}
