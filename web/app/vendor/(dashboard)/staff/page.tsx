import { headers } from 'next/headers';
import { Mail, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { inviteStaff, removeStaff, updateStaffRole } from '@/lib/actions/vendor';
import { CopyField } from '@/components/CopyField';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).staff;
  const c = pick(common, locale);

  const [membersResult, invitesResult] = await Promise.all([
    ctx.supabase
      .from('vendor_members')
      .select('user_id, role, active, created_at, profiles(full_name, email)')
      .eq('vendor_id', ctx.vendor.id)
      .order('created_at', { ascending: true }),
    ctx.supabase
      .from('vendor_invites')
      .select('id, email, role, token, expires_at, accepted_at, created_at')
      .eq('vendor_id', ctx.vendor.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const members = (membersResult.data ?? []).filter((member) => member.active);
  const invites = (invitesResult.data ?? []).filter(
    (invite) => new Date(invite.expires_at).getTime() > Date.now(),
  );

  const headerStore = await headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';
  const proto =
    headerStore.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? `${proto}://${host}`;

  const canManage = ctx.role === 'owner' || ctx.role === 'manager';
  const invitedToken = params.invited ?? '';
  const invitedLink = invitedToken ? `${origin}/vendor/join?token=${invitedToken}` : '';

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? t.teamUpdated : null}
      />

      {invitedLink ? (
        <div className="callout" style={{ display: 'grid', gap: 10 }}>
          <strong>
            <UserPlus size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> {t.inviteCreated}
          </strong>
          <span className="small">{t.inviteCreatedBody}</span>
          <CopyField value={invitedLink} />
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Users size={17} />
          </span>
          <strong>{members.length}</strong>
          <span>{t.activeMembers}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Mail size={17} />
          </span>
          <strong>{invites.length}</strong>
          <span>{t.pendingInvites}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{titleCase(ctx.role, locale)}</strong>
          <span>{t.yourRole}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <UserPlus size={17} />
          </span>
          <strong>{canManage ? t.open : t.restricted}</strong>
          <span>{t.invitePermissions}</span>
        </div>
      </div>

      {canManage ? (
        <section className="panel">
          <div className="panel-head">
            <h3>{t.inviteSomeone}</h3>
            <span className="tag mint">{t.emailMustMatch}</span>
          </div>
          <div className="panel-body">
            <form action={inviteStaff} className="inline-form">
              <div className="field" style={{ flex: '1 1 260px' }}>
                <label htmlFor="email">{t.emailAddress}</label>
                <input id="email" name="email" type="email" required placeholder="teammate@business.qa" />
              </div>
              <div className="field">
                <label htmlFor="role">{t.role}</label>
                <select id="role" name="role" defaultValue="redemption_staff">
                  <option value="redemption_staff">{c.roles.redemption_staff}</option>
                  {ctx.role === 'owner' ? <option value="manager">{c.roles.manager}</option> : null}
                </select>
              </div>
              <button className="btn primary" type="submit">
                <UserPlus size={15} /> {t.createInvite}
              </button>
            </form>
            <p className="small muted" style={{ marginTop: 10 }}>
              {t.inviteExpiry}
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>{t.teamMembers}</h3>
          <span className="small muted">{fill(t.activeCount, { count: members.length })}</span>
        </div>
        <div className="panel-body flush">
          {members.length === 0 ? (
            <div className="table-empty">{t.noMembers}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.person}</th>
                    <th>{t.role}</th>
                    <th>{t.joined}</th>
                    <th style={{ textAlign: 'right' }}>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
                    const isSelf = member.user_id === ctx.user.id;
                    return (
                      <tr key={member.user_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                              {initials(profile?.full_name ?? profile?.email ?? '?')}
                            </span>
                            <div>
                              <span className="strong">
                                {profile?.full_name ?? profile?.email ?? t.teamMember}
                                {isSelf ? t.youSuffix : ''}
                              </span>
                              <br />
                              <span className="sub">{profile?.email ?? '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusTag status={member.role === 'owner' ? 'approved' : member.role === 'manager' ? 'active' : 'pending'} />
                          <span className="small" style={{ marginLeft: 8 }}>
                            {titleCase(member.role, locale)}
                          </span>
                        </td>
                        <td className="small muted">{formatDate(member.created_at, locale)}</td>
                        <td>
                          <div className="row-actions">
                            {ctx.role === 'owner' && member.role !== 'owner' ? (
                              <form action={updateStaffRole} className="inline-role">
                                <input type="hidden" name="user_id" value={member.user_id} />
                                <select
                                  name="role"
                                  defaultValue={member.role}
                                  aria-label={fill(t.roleFor, {
                                    name: profile?.email ?? t.memberFallback,
                                  })}
                                >
                                  <option value="manager">{c.roles.manager}</option>
                                  <option value="redemption_staff">{c.roles.redemption_staff}</option>
                                </select>
                                <button className="btn sm" type="submit">
                                  {c.actions.save}
                                </button>
                              </form>
                            ) : null}
                            {canManage && member.role !== 'owner' && !isSelf ? (
                              <form action={removeStaff}>
                                <input type="hidden" name="user_id" value={member.user_id} />
                                <button className="btn sm ghost" type="submit">
                                  {c.actions.remove}
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t.pendingInvitesTitle}</h3>
          <span className="small muted">{t.expireAfter}</span>
        </div>
        <div className="panel-body flush">
          {invites.length === 0 ? (
            <div className="table-empty">{t.noInvites}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{c.labels.email}</th>
                    <th>{t.role}</th>
                    <th>{t.expires}</th>
                    <th>{t.inviteLink}</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="strong">{invite.email}</td>
                      <td>{titleCase(invite.role, locale)}</td>
                      <td className="small muted">{formatDate(invite.expires_at, locale)}</td>
                      <td style={{ minWidth: 320 }}>
                        <CopyField value={`${origin}/vendor/join?token=${invite.token}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
