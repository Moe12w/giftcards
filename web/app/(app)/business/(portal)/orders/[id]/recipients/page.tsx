import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { Notice, PageHead } from '@/components/ui';
import { assignBulkRecipients } from '@/lib/actions/business';
import { BulkRecipientsUpload } from '@/components/BulkRecipientsUpload';
import { businessCopy } from '@/lib/i18n/business';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function BusinessRecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; assigned?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireApprovedBusinessBuyer();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(businessCopy, locale);

  const { data: order } = await ctx.supabase
    .from('bulk_orders')
    .select('id, order_ref, quantity, status, buyer_user_id')
    .eq('id', id)
    .eq('buyer_user_id', ctx.user.id)
    .maybeSingle();

  if (!order) notFound();

  const { data: allocations } = await ctx.supabase
    .from('bulk_order_vouchers')
    .select('id, recipient_name, recipient_email, delivery_status')
    .eq('bulk_order_id', order.id)
    .order('assignment_index', { ascending: true });

  const assigned = (allocations ?? []).filter((a: any) => a.recipient_email).length;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.recipients.eyebrow}
        title={t.recipients.title}
        description={t.recipients.description}
        actions={
          <Link className="btn sm ghost" href={`/business/orders/${order.id}`}>
            <ArrowLeft size={15} /> {t.recipients.back}
          </Link>
        }
      />
      <Notice error={sp.error} success={sp.assigned === '1' ? t.recipients.assignDone : null} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="panel">
          <div className="panel-head"><h3>{t.order.uploadCsv}</h3></div>
          <div className="panel-body">
            <p className="small muted">{t.order.uploadCsvBody}</p>
            <BulkRecipientsUpload
              action={assignBulkRecipients}
              orderId={order.id}
              quantity={order.quantity}
              labels={{
                pasteHere: t.order.pasteHere,
                uploadFile: t.order.uploadFile,
                templateHint: t.order.templateHint,
                assign: t.recipients.assign,
                parsed: t.recipients.parsed,
                invalid: t.recipients.invalid,
              }}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>{t.order.recipients}</h3></div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t.order.recipient}</th>
                    <th>{t.order.email}</th>
                    <th>{t.order.deliveryStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocations ?? []).map((a: any, index: number) => (
                    <tr key={a.id}>
                      <td>{index + 1}</td>
                      <td className="small">{a.recipient_name || '—'}</td>
                      <td className="small">{a.recipient_email || '—'}</td>
                      <td className="small muted">{a.delivery_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ padding: 12 }}>
              {t.recipients.orderLimit.replaceAll('{count}', String(order.quantity))} · {assigned}/{order.quantity}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
