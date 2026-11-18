import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { removeStaff, updateStaffRole } from '@/lib/actions/vendor';
import { vendorCreateStaff } from '@/lib/actions/team';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { fill, pick } from '@/lib/i18n';
import { common } from '@/lib/i18n/common';
import { getLocale } from '@/lib/i18n/server';
import { vendorCopy } from '@/lib/i18n/vendor';

export default async function VendorStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();
  const locale = await getLocale();
  const t = pick(vendorCopy, locale).staff;
  const c = pick(common, locale);

  const { data: memberRows } = await ctx.supabase
    .from('vendor_members')
    .select('user_id, role, active, created_at, profiles(full_name, email)')
    .eq('vendor_id', ctx.vendor.id)
    .order('created_at', { ascending: true });

  const members = (memberRows ?? []).filter((member) => member.active);
  const canManage = ctx.role === 'owner' || ctx.role === 'manager';

  return (
    <div className="dash-content">
      <PageHead
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Team member created. Share the email and password with them.' : null}
      />

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
            <ShieldCheck size={17} />
          </span>
          <strong>{members.filter((member) => member.role === 'manager').length}</strong>
          <span>Managers</span>
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
            <h3>Add a team member</h3>
            <span className="tag mint">Instant access</span>
          </div>
          <div className="panel-body">
            <form action={vendorCreateStaff} className="form" style={{ display: 'grid', gap: 14 }}>
              <div className="field">
                <label htmlFor="full_name">Full name</label>
                <input id="full_name" name="full_name" required placeholder="e.g. Sara Ahmed" />
              </div>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" name="email" type="email" required placeholder="teammate@business.qa" />
              </div>
              <div className="field">
                <label htmlFor="password">Temporary password</label>
                <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                <span className="hint">At least 8 characters. Share it with them after creating the account.</span>
              </div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="redemption_staff">
                  <option value="redemption_staff">{c.roles.redemption_staff}</option>
                  {ctx.role === 'owner' ? <option value="manager">{c.roles.manager}</option> : null}
                </select>
              </div>
              <button className="btn primary" type="submit">
                <UserPlus size={15} /> Create account
              </button>
            </form>
            <p className="small muted" style={{ marginTop: 10 }}>
              They can sign in immediately at /vendor/login with this email and password. Existing accounts cannot be
              overwritten — ask Giftly support if the person already has one.
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

    </div>
  );
}
