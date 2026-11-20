import { requireVendor } from '@/lib/auth';
import { csvCell } from '@/lib/security';

export async function GET(request: Request) {
  const ctx = await requireVendor();
  const url = new URL(request.url);
  const range = url.searchParams.get('range') ?? '90';
  const days = ['30', '90', '365'].includes(range) ? Number(range) : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: orderItems } = await ctx.supabase
    .from('order_items')
    .select('id, total_minor, commission_minor, vendor_share_minor, currency, created_at, products(title), orders(order_ref, status)')
    .eq('vendor_id', ctx.vendor.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000);

  const rows = (orderItems ?? []).filter((item) => {
    const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
    return order?.status === 'paid';
  });

  const header = [
    'order_ref',
    'product',
    'total_minor',
    'commission_minor',
    'vendor_share_minor',
    'currency',
    'created_at',
  ];

  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    lines.push(
      [
        order?.order_ref ?? '',
        product?.title ?? '',
        row.total_minor,
        row.commission_minor,
        row.vendor_share_minor,
        row.currency,
        row.created_at,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const csv = `\uFEFF${lines.join('\r\n')}`;
  const filename = `giftly-sales-${ctx.vendor.slug ?? ctx.vendor.id}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
