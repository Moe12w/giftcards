import type { Product, ProductVariant } from '@/lib/types';
import { formatMoney } from '@/lib/money';

export function activeVariants(product: Pick<Product, 'variants'>): ProductVariant[] {
  return (product.variants ?? [])
    .filter((variant) => variant.active)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.price_minor - b.price_minor);
}

export function startingPriceMinor(product: Product): number {
  const variants = activeVariants(product);
  if (variants.length > 0) return Math.min(...variants.map((variant) => variant.price_minor));
  return product.min_amount_minor;
}

export function priceLabel(product: Product): string {
  if (product.fulfilment_type === 'experience') {
    const variants = activeVariants(product);
    if (variants.length === 0) return 'Packages coming soon';
    return `From ${formatMoney(Math.min(...variants.map((variant) => variant.price_minor)))}`;
  }
  if (product.fulfilment_type === 'enterprise_code') {
    return product.min_amount_minor === product.max_amount_minor
      ? formatMoney(product.min_amount_minor)
      : `${formatMoney(product.min_amount_minor)} – ${formatMoney(product.max_amount_minor)}`;
  }
  if (product.min_amount_minor === product.max_amount_minor) {
    return formatMoney(product.min_amount_minor);
  }
  return `${formatMoney(product.min_amount_minor)} – ${formatMoney(product.max_amount_minor)}`;
}

export function fulfilmentLabel(type: string): string {
  if (type === 'experience') return 'Experience';
  if (type === 'enterprise_code') return 'Corporate code';
  return 'Gift card';
}

/**
 * The tones the platform stores. The mobile app paints these five, so the
 * dashboard writes the same names and nothing else can reach the database.
 */
export const PRODUCT_TONES = ['teal', 'pink', 'lavender', 'gold', 'sky'] as const;
export type ProductTone = (typeof PRODUCT_TONES)[number];

/** Older gifts used the dashboard palette names. They still read correctly. */
const TONE_ALIASES: Record<string, ProductTone> = {
  mint: 'teal',
  teal: 'teal',
  coral: 'pink',
  pink: 'pink',
  lavender: 'lavender',
  gold: 'gold',
  sky: 'sky',
};

/** Turns anything into a tone the platform and the app both understand. */
export function normalizeTone(
  tone: string | null | undefined,
  fallback: ProductTone = 'teal',
): ProductTone {
  if (!tone) return fallback;
  const key = tone.trim().toLowerCase();
  return TONE_ALIASES[key] ?? fallback;
}

/** The colour class used by the website for a gift. */
export function productTone(product: Pick<Product, 'tone' | 'fulfilment_type'>): string {
  const tone = normalizeTone(
    product.tone,
    product.fulfilment_type === 'experience'
      ? 'lavender'
      : product.fulfilment_type === 'enterprise_code'
        ? 'sky'
        : 'teal',
  );
  if (tone === 'teal') return 'mint';
  if (tone === 'pink') return 'coral';
  return tone;
}

export function packageSummary(variant: ProductVariant): string {
  const sessions =
    variant.session_count && variant.session_count > 0
      ? `${variant.session_count} ${variant.session_count === 1 ? 'session' : 'sessions'}`
      : null;
  return sessions ? `${variant.label} · ${sessions}` : variant.label;
}
