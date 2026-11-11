import type { Product, ProductVariant } from '@/lib/types';

/**
 * Supabase returns joined variants under the table name. The rest of the web
 * app expects them as `product.variants`, active first.
 */
export function mapProducts(rows: unknown[] | null | undefined): Product[] {
  return (rows ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    const variants = (record.product_variants as ProductVariant[] | undefined) ?? [];
    const { product_variants: _ignored, ...rest } = record;
    return {
      ...(rest as unknown as Product),
      variants: variants
        .filter((variant) => variant.active)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.price_minor - b.price_minor),
    };
  });
}

export function mapProduct(row: unknown): Product | null {
  if (!row) return null;
  return mapProducts([row])[0] ?? null;
}
