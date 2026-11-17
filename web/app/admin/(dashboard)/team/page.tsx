import { requireAdmin } from '@/lib/auth';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { formatDate, initials } from '@/lib/format';
import { adminCreateTeamMember } from '@/lib/actions/team';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const admin = createAdminClient();

  const { data: roles } = await admin
    .from('user_roles')
    .select('user_id, role, profiles(full_name, email, status)')
    .eq('role', 'admin')
    .order('user_id');

  const admins = roles ?? [];

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Platform administration"
        title="Team access"
        description="Create admin accounts with a chosen email and password. They can sign in immediately."
      />

      <Notice
        error={params.error}
        success={params.saved === '1' ? 'Admin account created. Share the credentials with them.' : null}
      />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>Add an admin</h3>
            <span className="tag mint">Instant access</span>
          </div>
          <div className="panel-body">
            <form action={adminCreateTeamMember} className="form" style={{ display: 'grid', gap: 14 }}>
              <input type="hidden" name="role" value="admin" />
              <div className="field">
                <label htmlFor="full_name">Full name</label>
                <input id="full_name" name="full_name" required placeholder="e.g. Layla Hassan" />
              </div>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" name="email" type="email" required placeholder="colleague@giftly.qa" />
              </div>
              <div className="field">
                <label htmlFor="password">Temporary password</label>
                <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
                <span className="hint">At least 8 characters. Share it after creating the account.</span>
              </div>
              <button className="btn primary" type="submit">
                Create admin account
              </button>
              <p className="small muted" style={{ margin: 0 }}>
                Existing accounts are never overwritten. Ask the person to contact Giftly if they already have one.
              </p>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Current admins</h3>
            <span className="tag neutral">{admins.length}</span>
          </div>
          <div className="panel-body">
            {admins.length === 0 ? (
              <p className="small muted">No admin accounts found.</p>
            ) : (
              <div className="split-list">
                {admins.map((row: any) => {
                  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
                  return (
                    <div key={row.user_id}>
                      <span className="k" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span className="avatar" style={{ width: 30, height: 30, fontSize: '0.68rem' }}>
                          {initials(profile?.full_name ?? profile?.email ?? '?')}
                        </span>
                        <span>
                          <strong style={{ color: 'var(--ink)' }}>
                            {profile?.full_name ?? profile?.email ?? row.user_id}
                          </strong>
                          <br />
                          <span className="small muted">{profile?.email ?? '—'}</span>
                        </span>
                      </span>
                      <span className="v small">
                        <StatusTag status="approved" /> Admin
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="small muted" style={{ marginTop: 14 }}>
              Admin access is stored in user_roles and is separate from vendor/enterprise team roles.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
