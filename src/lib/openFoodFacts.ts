/** API pública gratuita Open Food Facts — producto por código de barras. */

export type OpenFoodFactsV2Product = {
  status: number;
  status_verbose?: string;
  product?: {
    product_name?: string;
    product_name_es?: string;
    quantity?: string;
    quantity_unit?: string;
    product_quantity?: number | string;
    product_quantity_unit?: string;
    nutriments?: Record<string, number | string | undefined>;
  };
};

/** Payload mínimo: nombre, nutriments por 100g, tamaño del envase si existe. */
const OFF_FIELDS =
  'product_name,product_name_es,nutriments,quantity,quantity_unit,product_quantity,product_quantity_unit';

export function openFoodFactsProductUrl(barcode: string) {
  const u = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
  );
  u.searchParams.set('fields', OFF_FIELDS);
  return u.href;
}

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<OpenFoodFactsV2Product> {
  const res = await fetch(openFoodFactsProductUrl(barcode), {
    headers: {
      'User-Agent': 'PanaFitness/1.0',
      Accept: 'application/json',
    },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('OFF_PARSE_JSON');
  }

  if (!res.ok) {
    throw new Error(`OFF_HTTP_${res.status}`);
  }

  return body as OpenFoodFactsV2Product;
}

/** Redondeo a un decimal como string para inputs del formulario. */
export function nutritionValueToInputString(v: unknown): string {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10) / 10);
}

export type MacrosPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type OpenFoodFactsPackageTotal = {
  /** Cantidad normalizada como número (ej. 250 g o 330 ml). */
  amount: number;
  unit: 'g' | 'ml';
};

function clampfinite(n: number, fallback = 0) {
  return Number.isFinite(n) ? n : fallback;
}

function parseLeadingNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(',', '.').trim();
  const m = cleaned.match(/[\d.]+/);
  if (!m || m.length === 0) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function normalizePackUnitToken(token: string): { amountScale: number; massOrVolume: 'g' | 'ml' } | null {
  const t = token.replace(/\.$/, '').trim().toLowerCase();
  if (!t) return null;

  if (t === 'g' || t === 'gr' || t === 'gram' || t === 'grams' || t.startsWith('gram')) {
    return { amountScale: 1, massOrVolume: 'g' };
  }
  if (t === 'kg' || t.startsWith('kilogram')) {
    return { amountScale: 1000, massOrVolume: 'g' };
  }
  if (t === 'ml' || t.startsWith('millil')) {
    return { amountScale: 1, massOrVolume: 'ml' };
  }
  if (t === 'cl' || t.startsWith('centilit')) {
    return { amountScale: 10, massOrVolume: 'ml' };
  }
  if (t === 'l' || t === 'ltr' || t === 'liter' || t === 'litre') {
    return { amountScale: 1000, massOrVolume: 'ml' };
  }

  return null;
}

/**
 * Interpreta tamaño declarado por OFF (`product_quantity` + `product_quantity_unit` o cadena `quantity`).
 */
export function extractOpenFoodFactsPackageTotal(
  product: NonNullable<OpenFoodFactsV2Product['product']>,
): OpenFoodFactsPackageTotal | null {
  type Candidate = { amount: number; token: string };
  const candidates: Candidate[] = [];

  const pq = parseLeadingNumber(product.product_quantity);
  if (pq != null) {
    const tok =
      typeof product.product_quantity_unit === 'string' && product.product_quantity_unit.trim()
        ? product.product_quantity_unit.trim()
        : typeof product.quantity_unit === 'string' && product.quantity_unit.trim()
          ? product.quantity_unit.trim()
          : '';
    candidates.push({ amount: pq, token: tok });
  }

  const qtyStr = typeof product.quantity === 'string' ? product.quantity.trim() : '';
  if (qtyStr) {
    const m = qtyStr.match(/([\d.,]+)\s*([a-zA-Zªºµ.]+)?/);
    if (m) {
      const rawNum = m[1].replace(',', '.');
      const num = Number(rawNum);
      if (Number.isFinite(num) && num > 0) {
        candidates.push({ amount: num, token: (m[2] ?? '').trim() });
      }
    }
  }

  for (const { amount, token } of candidates) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (token) {
      const norm = normalizePackUnitToken(token);
      if (norm) {
        const scaled = amount * norm.amountScale;
        if (Number.isFinite(scaled) && scaled > 0) {
          return { amount: scaled, unit: norm.massOrVolume };
        }
      }
    }
  }

  /** Sin unidad clara: devolver null (mejor que asumir gramos equivocados). */
  return null;
}

function nutrientNumber(nm: Record<string, number | string | undefined>, key: string) {
  const v = nm[key];
  const n = typeof v === 'number' ? v : Number(v);
  return clampfinite(n, 0);
}

/**
 * Mapeo de OFF: macros como referencia **por cada 100 g** (nombre ES con fallback EN)
 * + cantidad declarada del envase si viene en la respuesta (`product_quantity`).
 */
export function mapOpenFoodFactsToNutritionFields(data: OpenFoodFactsV2Product): {
  name: string;
  macrosPer100g: MacrosPer100g;
  packageTotal: OpenFoodFactsPackageTotal | null;
} | null {
  if (data.status !== 1 || !data.product) return null;

  const p = data.product;
  const nm =
    typeof p.product_name_es === 'string' && p.product_name_es.trim()
      ? p.product_name_es.trim()
      : typeof p.product_name === 'string' && p.product_name.trim()
        ? p.product_name.trim()
        : '';

  const n = p.nutriments ?? {};
  const kcal =
    nutrientNumber(n, 'energy-kcal_100g') ||
    (nutrientNumber(n, 'energy_100g') > 0 ? nutrientNumber(n, 'energy_100g') / 4.184 : 0);

  const macrosPer100g: MacrosPer100g = {
    calories: Math.max(0, kcal),
    protein: Math.max(0, nutrientNumber(n, 'proteins_100g')),
    carbs: Math.max(0, nutrientNumber(n, 'carbohydrates_100g')),
    fat: Math.max(0, nutrientNumber(n, 'fat_100g')),
  };

  return {
    name: nm,
    macrosPer100g,
    packageTotal: extractOpenFoodFactsPackageTotal(p),
  };
}
