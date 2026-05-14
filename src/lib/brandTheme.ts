/**
 * Paletas de marca aplicadas en `document.documentElement` vía `applyBrandTheme`.
 * - `default`: verde neón (usuarios estándar).
 * - `pink`: rosa VIP (`profiles.theme === 'pink'`).
 *
 * El valor de `BRAND_COLOR` en `runFormat.ts` es `var(--brand-color)` y sigue
 * automáticamente al tema activo.
 */

export type BrandThemeName = 'default' | 'pink';

/** Mismo esquema de claves para poder intercambiar temas sin fugas de color. */
export type BrandCssVars = Record<string, string>;

const NEON_GREEN: BrandCssVars = {
  '--brand-color': '#39FF14',
  '--brand-hover': '#52FF47',
  '--brand-chart-mid': '#22c55e',
  '--brand-color-dim': 'rgba(57, 255, 20, 0.13)',
  '--brand-glow-sm': 'rgba(57, 255, 20, 0.33)',
  '--brand-glow': 'rgba(57, 255, 20, 0.45)',
  '--brand-glow-lg': 'rgba(57, 255, 20, 0.65)',
  '--primary': '109 100% 54%',
  '--ring': '109 100% 54%',
  '--sidebar-primary': '109 100% 54%',
  '--sidebar-ring': '109 100% 54%',
};

const NEON_PINK: BrandCssVars = {
  '--brand-color': '#FF1493',
  '--brand-hover': '#FF4DA6',
  '--brand-chart-mid': '#db2777',
  '--brand-color-dim': 'rgba(255, 20, 147, 0.13)',
  '--brand-glow-sm': 'rgba(255, 20, 147, 0.33)',
  '--brand-glow': 'rgba(255, 20, 147, 0.45)',
  '--brand-glow-lg': 'rgba(255, 20, 147, 0.65)',
  '--primary': '328 100% 54%',
  '--ring': '328 100% 54%',
  '--sidebar-primary': '328 100% 54%',
  '--sidebar-ring': '328 100% 54%',
};

const BRAND_THEMES: Record<BrandThemeName, BrandCssVars> = {
  default: { ...NEON_GREEN },
  pink: { ...NEON_PINK },
};

const BRAND_THEME_EVENT = 'brand-theme-change';

export function applyBrandTheme(name: BrandThemeName) {
  const root = document.documentElement;
  root.dataset.brand = name;
  const vars = BRAND_THEMES[name];
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  queueMicrotask(() => {
    window.dispatchEvent(new Event(BRAND_THEME_EVENT));
  });
}

export function getBrandThemeEventName() {
  return BRAND_THEME_EVENT;
}
