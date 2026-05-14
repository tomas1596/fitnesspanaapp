import { TileLayer } from 'react-leaflet';

/** OSM + CARTO — mostrar una sola vez (la capa base lleva el texto legal). */
export const READABLE_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const CARTO_SUBDOMAINS = 'abcd';

export type ReadableBasemapTheme = 'light' | 'dark';

/**
 * Carto raster optimizado para legibilidad de calles:
 * - Día: Voyager en dos capas (cartografía + etiquetas oscuras sobre fondo claro).
 * - Noche: Dark Matter sin etiquetas + capa solo etiquetas (texto claro sobre relieve oscuro).
 *
 * @see https://github.com/CartoDB/basemap-styles/blob/master/README.md
 */
export function ReadableBasemapLayers({ theme }: { theme: ReadableBasemapTheme }) {
  if (theme === 'dark') {
    return (
      <>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution={READABLE_MAP_ATTRIBUTION}
          subdomains={CARTO_SUBDOMAINS}
          maxZoom={20}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          attribution=""
          subdomains={CARTO_SUBDOMAINS}
          maxZoom={20}
        />
      </>
    );
  }

  return (
    <>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
        attribution={READABLE_MAP_ATTRIBUTION}
        subdomains={CARTO_SUBDOMAINS}
        maxZoom={20}
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
        attribution=""
        subdomains={CARTO_SUBDOMAINS}
        maxZoom={20}
      />
    </>
  );
}

/** Color de fondo del pane de Leaflet mientras cargan los tiles (aprox. al estilo Carto). */
export function readableMapFallbackBg(theme: ReadableBasemapTheme): string {
  return theme === 'dark' ? '#2b2b2b' : '#eee9df';
}
