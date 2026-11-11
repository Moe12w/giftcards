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

export function productTone(product: Pick<Product, 'tone' | 'fulfilment_type'>): string {
  if (product.tone && ['mint', 'lavender', 'coral', 'gold', 'sky'].includes(product.tone)) {
    return product.tone;
  }
  if (product.fulfilment_type === 'experience') return 'lavender';
  if (product.fulfilment_type === 'enterprise_code') return 'sky';
  return 'mint';
}

export function packageSummary(variant: ProductVariant): string {
  const sessions =
    variant.session_count && variant.session_count > 0
      ? `${variant.session_count} ${variant.session_count === 1 ? 'session' : 'sessions'}`
      : null;
  return sessions ? `${variant.label} · ${sessions}` : variant.label;
}
