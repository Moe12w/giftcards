import Link from 'next/link';
import { Building2, ShieldCheck, Users } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { saveEnterpriseProfile } from '@/lib/actions/enterprise';
import { formatDate, initials, titleCase } from '@/lib/format';
import { Notice, PageHead, StatusTag } from '@/components/ui';

export default async function EnterpriseSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireEnterprise();
  const partner = ctx.partner;
  const canManage = ctx.role !== 'analyst';

  const { data: members } = await ctx.supabase
    .from('enterprise_members')
    .select('user_id, role, active, created_at, profiles(full_name, email)')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: true });

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Settings"
        title="Your company profile."
        description="These details are used on corporate paperwork, delivery messages and your account record."
      />

      <Notice error={params.error} success={params.saved === '1' ? 'Settings saved.' : null} />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Company details</h3>
            <StatusTag status={partner.status} />
          </div>
          <div className="panel-body">
            <form action={saveEnterpriseProfile} style={{ display: 'grid', gap: 16 }}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="name">Company name</label>
                  <input id="name" name="name" required defaultValue={partner.name} />
                </div>
                <div className="field">
                  <label htmlFor="website">Website</label>
                  <input id="website" name="website" defaultValue={partner.website ?? ''} placeholder="https://…" />
                </div>
                <div className="field">
                  <label htmlFor="industry">Industry</label>
                  <input id="industry" name="industry" defaultValue={partner.industry ?? ''} placeholder="Technology, hospitality…" />
                </div>
                <div className="field">
                  <label htmlFor="contact_name">Primary contact</label>
                  <input id="contact_name" name="contact_name" defaultValue={partner.contact_name ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="contact_email">Contact email</label>
                  <input id="contact_email" name="contact_email" type="email" defaultValue={partner.contact_email ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="contact_phone">Contact phone</label>
                  <input id="contact_phone" name="contact_phone" defaultValue={partner.contact_phone ?? ''} placeholder="+974 …" />
                </div>
                <div className="field">
                  <label htmlFor="expected_volume">Expected annual volume</label>
                  <input id="expected_volume" name="expected_volume" defaultValue={partner.expected_volume ?? ''} placeholder="500 codes" />
                </div>
                <div className="field full">
                  <label htmlFor="notes">Notes for the Giftly team</label>
                  <textarea id="notes" name="notes" defaultValue={partner.notes ?? ''} placeholder="Anything we should know about your programme." />
                </div>
                <div className="field full">
                  <label htmlFor="full_name">Your name</label>
                  <input id="full_name" name="full_name" defaultValue={ctx.profile?.full_name ?? ''} />
                  <span className="hint">Shown on your account and to teammates.</span>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn lavender" type="submit" disabled={!canManage}>
                  Save settings
                </button>
                {!canManage ? (
                  <span className="small muted">Analysts have read-only access.</span>
                ) : null}
              </div>
            </form>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>Account</h3>
              <Building2 size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">Signed in as</span>
                  <span className="v small">{ctx.user.email}</span>
                </div>
                <div>
                  <span className="k">Your role</span>
                  <span className="v">{titleCase(ctx.role)}</span>
                </div>
                <div>
                  <span className="k">Partner since</span>
                  <span className="v">{formatDate(partner.created_at)}</span>
                </div>
                <div>
                  <span className="k">Partner slug</span>
                  <span className="v small mono">{partner.slug}</span>
                </div>
              </div>
              <div className="callout info" style={{ marginTop: 14 }}>
                <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Codes are
                encrypted at rest. Your team can only see masked codes in the dashboard.
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Team access</h3>
              <Users size={16} />
            </div>
            <div className="panel-body">
              {(members ?? []).length === 0 ? (
                <p className="small muted">No team members linked yet.</p>
              ) : (
                <div className="split-list">
                  {(members ?? []).map((member) => {
                    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                    return (
                      <div key={member.user_id}>
                        <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.68rem' }}>
                            {initials(profile?.full_name ?? profile?.email ?? '?')}
                          </span>
                          <span>
                            <strong style={{ color: 'var(--ink)' }}>
                              {profile?.full_name ?? profile?.email ?? 'Team member'}
                            </strong>
                            <br />
                            <span className="small muted">{profile?.email ?? '—'}</span>
                          </span>
                        </span>
                        <span className="v small">
                          <StatusTag status={member.role === 'owner' ? 'approved' : member.role === 'manager' ? 'active' : 'pending'} />{' '}
                          {titleCase(member.role)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="callout info" style={{ marginTop: 14 }}>
                To add or remove a colleague, contact your Giftly account manager.
              </div>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <Link className="btn sm" href="/contact">
                  Contact Giftly
                </Link>
                <Link className="btn sm ghost" href="/corporate#enquiry">
                  Corporate site
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
