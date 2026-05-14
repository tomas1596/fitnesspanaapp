/**
 * Variables CSS de marca: acento Rosa Neón (--brand-*, shadcn --primary).
 * `default` y `pink` comparten la misma paleta (migración global Theme Pink).
 */

export type BrandThemeName = 'default' | 'pink';

const NEON_PINK: Record<string, string> = {
  '--brand-color': '#FF1493',
  '--brand-color-dim': 'rgba(255, 20, 147, 0.13)',
  '--brand-glow-sm': 'rgba(255, 20, 147, 0.33)',
  '--brand-glow': 'rgba(255, 20, 147, 0.45)',
  '--brand-glow-lg': 'rgba(255, 20, 147, 0.65)',
  '--primary': '328 100% 54%',
  '--primary-foreground': '0 0% 100%',
  '--ring': '328 100% 54%',
  '--sidebar-primary': '328 100% 54%',
  '--sidebar-primary-foreground': '0 0% 100%',
  '--sidebar-ring': '328 100% 54%',
};

const BRAND_THEMES: Record<BrandThemeName, Record<string, string>> = {
  default: { ...NEON_PINK },
  pink: { ...NEON_PINK },
};

export function applyBrandTheme(name: BrandThemeName) {
  const vars = BRAND_THEMES[name];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}
