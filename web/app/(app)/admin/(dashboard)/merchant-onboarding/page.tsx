import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { formatDate } from '@/lib/format';
import type { MerchantApplicationStatus } from '@/lib/merchant';

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'All applications' },
  { key: 'submitted', label: 'New submissions' },
  { key: 'under_review', label: 'Under review' },
  { key: 'documents_required', label: 'Documents required' },
  { key: 'additional_information_required', label: 'More information required' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Active merchants' },
  { key: 'rejected', label: 'Rejected' },
];

interface ApplicationRow {
  id: string;
  owner_type: 'vendor' | 'partner';
  status: MerchantApplicationStatus;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
  vendors: { name: string } | null;
  enterprise_partners: { name: string } | null;
}

export default async function AdminMerchantOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const status = params.status ?? '';

  const { data, error } = await ctx.supabase
    .from('merchant_applications')
    .select(
      'id, owner_type, status, business_name, business_email, business_phone, submitted_at, updated_at, created_at, vendors(name), enterprise_partners(name)',
    )
    .order('updated_at', { ascending: false })
    .limit(500);

  const applications = (data ?? []) as unknown as ApplicationRow[];

  const stats = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === 'submitted').length,
    underReview: applications.filter((a) => a.status === 'under_review').length,
    documents: applications.filter((a) =>
      ['documents_required', 'additional_information_required', 'agreement_pending'].includes(a.status),
    ).length,
    approved: applications.filter((a) => a.status === 'approved').length,
    active: applications.filter((a) => a.status === 'active').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const filtered = applications.filter((application) => {
    if (status && application.status !== status) return false;
    if (!q) return true;
    const owner = application.vendors?.name ?? application.enterprise_partners?.name ?? '';
    return [application.business_name, application.business_email, application.business_phone, owner, application.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Merchant onboarding"
        title="Payment applications"
        description="Review merchant applications, check documents and activate payment processing. Payment approval is separate from platform account approval."
        actions={
          <Link className="btn sm" href="/admin/merchant-onboarding/agreements">
            Manage agreements
          </Link>
        }
      />

      <Notice error={error?.message} />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Overview</h3>
          </div>
          <div className="panel-body">
            <div className="split-list">
              <div>
                <span className="k">Total applications</span>
                <span className="v">{stats.total}</span>
              </div>
              <div>
                <span className="k">New submissions</span>
                <span className="v">{stats.submitted}</span>
              </div>
              <div>
                <span className="k">Under review</span>
                <span className="v">{stats.underReview}</span>
              </div>
              <div>
                <span className="k">Requiring documents</span>
                <span className="v">{stats.documents}</span>
              </div>
              <div>
                <span className="k">Approved</span>
                <span className="v">{stats.approved}</span>
              </div>
              <div>
                <span className="k">Active merchants</span>
                <span className="v">{stats.active}</span>
              </div>
              <div>
                <span className="k">Rejected</span>
                <span className="v">{stats.rejected}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <form className="toolbar" action="/admin/merchant-onboarding" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search by business name, email or application ID"
            aria-label="Search applications"
          />
        </div>
        <select name="status" defaultValue={status} aria-label="Filter by status">
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.key || 'all'} value={filter.key}>
              {filter.label}
            </option>
          ))}
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || status ? (
          <Link className="btn sm ghost" href="/admin/merchant-onboarding">
            Clear
          </Link>
        ) : null}
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          title={q || status ? 'No applications match those filters' : 'No payment applications yet'}
          body={
            q || status
              ? 'Try a different search or clear the filters.'
              : 'Applications appear here as soon as a business starts its Online Payments onboarding.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {filtered.length} application{filtered.length === 1 ? '' : 's'}
            </h3>
            <span className="small muted">Newest activity first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Type</th>
                    <th>Contact</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((application) => {
                    const owner = application.vendors?.name ?? application.enterprise_partners?.name ?? '—';
                    return (
                      <tr key={application.id}>
                        <td>
                          <Link href={`/admin/merchant-onboarding/${application.id}`} className="strong">
                            {application.business_name ?? owner}
                          </Link>
                          <br />
                          <span className="sub mono">{application.id.slice(0, 8)}</span>
                        </td>
                        <td className="small">{application.owner_type === 'vendor' ? 'Vendor' : 'Enterprise'}</td>
                        <td>
                          <span className="small">{application.business_email ?? '—'}</span>
                          <br />
                          <span className="sub">{application.business_phone ?? '—'}</span>
                        </td>
                        <td className="small muted">
                          {application.submitted_at ? formatDate(application.submitted_at) : 'Not submitted'}
                        </td>
                        <td>
                          <StatusTag status={application.status} />
                        </td>
                        <td>
                          <div className="row-actions">
                            <Link className="btn sm" href={`/admin/merchant-onboarding/${application.id}`}>
                              Open
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
