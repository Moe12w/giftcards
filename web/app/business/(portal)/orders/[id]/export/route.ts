import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function csvEscape(value: unknown) {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: order } = await supabase
    .from('bulk_orders')
    .select('*, vendors(name), bulk_offers(title), business_accounts(company_name,contact_name,business_email)')
    .eq('id', id)
    .eq('buyer_user_id', user.id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: vouchers } = await supabase
    .from('bulk_order_vouchers')
    .select('*')
    .eq('bulk_order_id', id)
    .order('created_at', { ascending: true });

  const header = [
    'order_ref','company','vendor','offer','quantity','face_value_minor','unit_price_minor','total_face_value_minor','total_paid_minor','discount_minor','platform_fee_minor','vendor_payable_minor','currency','order_status','payment_status','allocation_index','voucher_code','voucher_id','recipient_name','recipient_email','delivery_status'
  ];
  const rows = (vouchers && vouchers.length ? vouchers : [null]).map((v: any, i: number) => [
    order.order_ref,
    (order as any).business_accounts?.company_name ?? '',
    (order as any).vendors?.name ?? '',
    (order as any).bulk_offers?.title ?? '',
    order.quantity,
    order.face_value_minor,
    order.unit_price_minor,
    order.total_face_value_minor,
    order.total_paid_minor,
    order.discount_minor,
    order.platform_fee_minor,
    order.vendor_payable_minor,
    order.currency,
    order.status,
    order.payment_status,
    i + 1,
    v?.voucher_code ?? '',
    v?.voucher_id ?? '',
    v?.recipient_name ?? '',
    v?.recipient_email ?? '',
    v?.delivery_status ?? '',
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n');
  return new NextResponse('\ufeff' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${order.order_ref}-bulk-order.csv"`,
    },
  });
}
