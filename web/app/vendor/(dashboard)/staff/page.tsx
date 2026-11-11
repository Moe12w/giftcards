import { headers } from 'next/headers';
import { Mail, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { requireVendor } from '@/lib/auth';
import { formatDate, initials, titleCase } from '@/lib/format';
import { inviteStaff, removeStaff, updateStaffRole } from '@/lib/actions/vendor';
import { CopyField } from '@/components/CopyField';
import { EmptyState, Notice, PageHead, StatusTag } from '@/components/ui';

export default async function VendorStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireVendor();

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
        eyebrow="Team"
        title="People behind the counter."
        description="Owners and managers can invite teammates. Redemption staff can scan and redeem but cannot change prices or settings."
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Team updated.' : null}
      />

      {invitedLink ? (
        <div className="callout" style={{ display: 'grid', gap: 10 }}>
          <strong>
            <UserPlus size={16} style={{ display: 'inline', verticalAlign: '-3px' }} /> Invite created
          </strong>
          <span className="small">
            Send this link to the invitee. They must sign in with the email you entered.
          </span>
          <CopyField value={invitedLink} />
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Users size={17} />
          </span>
          <strong>{members.length}</strong>
          <span>Active team members</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <Mail size={17} />
          </span>
          <strong>{invites.length}</strong>
          <span>Pending invites</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{titleCase(ctx.role)}</strong>
          <span>Your role</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--coral-soft)' }}>
            <UserPlus size={17} />
          </span>
          <strong>{canManage ? 'Open' : 'Restricted'}</strong>
          <span>Invite permissions</span>
        </div>
      </div>

      {canManage ? (
        <section className="panel">
          <div className="panel-head">
            <h3>Invite someone</h3>
            <span className="tag mint">Email must match</span>
          </div>
          <div className="panel-body">
            <form action={inviteStaff} className="inline-form">
              <div className="field" style={{ flex: '1 1 260px' }}>
                <label htmlFor="email">Email address</label>
                <input id="email" name="email" type="email" required placeholder="teammate@business.qa" />
              </div>
              <div className="field">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="redemption_staff">
                  <option value="redemption_staff">Redemption staff</option>
                  {ctx.role === 'owner' ? <option value="manager">Manager</option> : null}
                </select>
              </div>
              <button className="btn primary" type="submit">
                <UserPlus size={15} /> Create invite
              </button>
            </form>
            <p className="small muted" style={{ marginTop: 10 }}>
              Invites expire after 14 days. The invitee signs in or creates an account with the same
              email, then opens the link.
            </p>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head">
          <h3>Team members</h3>
          <span className="small muted">{members.length} active</span>
        </div>
        <div className="panel-body flush">
          {members.length === 0 ? (
            <div className="table-empty">No team members yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                                {profile?.full_name ?? profile?.email ?? 'Team member'}
                                {isSelf ? ' (you)' : ''}
                              </span>
                              <br />
                              <span className="sub">{profile?.email ?? '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusTag status={member.role === 'owner' ? 'approved' : member.role === 'manager' ? 'active' : 'pending'} />
                          <span className="small" style={{ marginLeft: 8 }}>
                            {titleCase(member.role)}
                          </span>
                        </td>
                        <td className="small muted">{formatDate(member.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            {ctx.role === 'owner' && member.role !== 'owner' ? (
                              <form action={updateStaffRole} className="inline-role">
                                <input type="hidden" name="user_id" value={member.user_id} />
                                <select name="role" defaultValue={member.role} aria-label={`Role for ${profile?.email ?? 'member'}`}>
                                  <option value="manager">Manager</option>
                                  <option value="redemption_staff">Redemption staff</option>
                                </select>
                                <button className="btn sm" type="submit">
                                  Save
                                </button>
                              </form>
                            ) : null}
                            {canManage && member.role !== 'owner' && !isSelf ? (
                              <form action={removeStaff}>
                                <input type="hidden" name="user_id" value={member.user_id} />
                                <button className="btn sm ghost" type="submit">
                                  Remove
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
          <h3>Pending invites</h3>
          <span className="small muted">Expire after 14 days</span>
        </div>
        <div className="panel-body flush">
          {invites.length === 0 ? (
            <div className="table-empty">No pending invites.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Expires</th>
                    <th>Invite link</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="strong">{invite.email}</td>
                      <td>{titleCase(invite.role)}</td>
                      <td className="small muted">{formatDate(invite.expires_at)}</td>
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
