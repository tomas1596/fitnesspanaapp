/** API pública gratuita Open Food Facts — producto por código de barras. */

export type OpenFoodFactsV2Product = {
  status: number;
  status_verbose?: string;
  product?: {
    product_name?: string;
    product_name_es?: string;
    nutriments?: Record<string, number | string | undefined>;
  };
};

/** Payload mínimo: nombres + nutrimientos (incluye energy-kcal_100g, macros por 100g). */
const OFF_FIELDS = 'product_name,product_name_es,nutriments';

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

/** Mapeo por 100 g según solicitado; nombre ES con fallback EN. */
export function mapOpenFoodFactsToNutritionFields(data: OpenFoodFactsV2Product): {
  name: string;
  base_calories: string;
  base_protein: string;
  base_carbs: string;
  base_fat: string;
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

  return {
    name: nm,
    base_calories: nutritionValueToInputString(n['energy-kcal_100g']),
    base_protein: nutritionValueToInputString(n.proteins_100g),
    base_carbs: nutritionValueToInputString(n.carbohydrates_100g),
    base_fat: nutritionValueToInputString(n.fat_100g),
  };
}
