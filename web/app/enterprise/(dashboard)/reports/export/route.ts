import { requireEnterprise } from '@/lib/auth';

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const ctx = await requireEnterprise();
  const url = new URL(request.url);
  const range = url.searchParams.get('range') ?? '90';
  const days = ['30', '90', '365'].includes(range) ? Number(range) : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [productsResult, inventoryResult] = await Promise.all([
    ctx.supabase
      .from('enterprise_products')
      .select('id, name, denomination_minor, selling_price_minor')
      .eq('partner_id', ctx.partner.id),
    ctx.supabase
      .from('enterprise_inventory_summary')
      .select('*')
      .eq('partner_id', ctx.partner.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10000),
  ]);

  const products = productsResult.data ?? [];
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const rows = inventoryResult.data ?? [];

  const header = [
    'inventory_ref',
    'product',
    'code_masked',
    'denomination_minor',
    'currency',
    'status',
    'allocated_at',
    'delivered_at',
    'confirmed_redeemed_at',
    'expires_at',
    'created_at',
  ];

  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.inventory_ref,
        productNames.get(row.enterprise_product_id) ?? '',
        row.code_masked,
        row.denomination_minor,
        row.currency,
        row.status,
        row.allocated_at,
        row.delivered_at,
        row.confirmed_redeemed_at,
        row.expires_at,
        row.created_at,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const csv = `\uFEFF${lines.join('\r\n')}`;
  const filename = `giftly-inventory-${ctx.partner.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
