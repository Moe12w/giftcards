import Link from 'next/link';
import { Activity, Search, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime, initials, titleCase } from '@/lib/format';
import { EmptyState, Notice, PageHead } from '@/components/ui';

interface Entry {
  id: string;
  source: 'audit' | 'admin';
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorRole: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

function detailsText(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const entries = Object.entries(details);
  if (entries.length === 0) return '—';
  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const q = (params.q ?? '').trim().toLowerCase();
  const source = params.source ?? '';

  const [auditResult, adminActionsResult] = await Promise.all([
    ctx.supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
    ctx.supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const auditEntries: Entry[] = (auditResult.data ?? []).map((entry) => ({
    id: `audit-${entry.id}`,
    source: 'audit',
    action: entry.action,
    entityType: entry.entity_type,
    entityId: entry.entity_id,
    actorId: entry.actor_user_id,
    actorRole: entry.actor_role,
    details: entry.after_data ?? entry.before_data ?? null,
    createdAt: entry.created_at,
  }));

  const adminEntries: Entry[] = (adminActionsResult.data ?? []).map((entry) => ({
    id: `admin-${entry.id}`,
    source: 'admin',
    action: entry.action,
    entityType: entry.target_type ?? 'platform',
    entityId: entry.target_id,
    actorId: entry.admin_id,
    actorRole: 'admin',
    details: entry.details ?? null,
    createdAt: entry.created_at,
  }));

  const error = auditResult.error ?? adminActionsResult.error ?? null;

  const actorIds = [...new Set([...auditEntries, ...adminEntries].map((entry) => entry.actorId).filter(Boolean))] as string[];
  const { data: profiles } = actorIds.length
    ? await ctx.supabase.from('profiles').select('id, full_name, email').in('id', actorIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const allEntries = [...auditEntries, ...adminEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const entries = allEntries.filter((entry) => {
    if (source && entry.source !== source) return false;
    if (!q) return true;
    const profile = entry.actorId ? profileMap.get(entry.actorId) : null;
    return [entry.action, entry.entityType, entry.entityId, profile?.full_name, profile?.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = allEntries.filter((entry) => entry.createdAt.slice(0, 10) === today).length;
  const uniqueActors = new Set(allEntries.map((entry) => entry.actorId).filter(Boolean)).size;

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Operations"
        title="Audit log"
        description="Every admin action and database change recorded by the platform, newest first."
      />

      <Notice error={params.error ?? error?.message} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Activity size={17} />
          </span>
          <strong>{allEntries.length}</strong>
          <span>Recent entries</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{adminEntries.length}</strong>
          <span>Admin actions</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Activity size={17} />
          </span>
          <strong>{todayCount}</strong>
          <span>Today</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{uniqueActors}</strong>
          <span>Actors</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/audit" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder="Action, entity or actor…" aria-label="Search audit log" />
        </div>
        <select name="source" defaultValue={source} aria-label="Log source">
          <option value="">All sources</option>
          <option value="admin">Admin actions</option>
          <option value="audit">Database audit</option>
        </select>
        <button className="btn sm" type="submit">
          Filter
        </button>
        {q || source ? (
          <Link className="btn sm ghost" href="/admin/audit">
            Clear
          </Link>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <EmptyState
          title={q || source ? 'No entries match' : 'No audit entries yet'}
          body={
            q || source
              ? 'Try a different search or clear the filters.'
              : 'Admin actions and database changes will be recorded here.'
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </h3>
            <span className="small muted">Newest first</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Source</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const profile = entry.actorId ? profileMap.get(entry.actorId) : null;
                    return (
                      <tr key={entry.id}>
                        <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(entry.createdAt)}
                        </td>
                        <td>
                          <span className={`tag ${entry.source === 'admin' ? 'coral' : 'neutral'}`}>
                            {entry.source === 'admin' ? 'Admin' : 'Audit'}
                          </span>
                        </td>
                        <td className="strong">{entry.action}</td>
                        <td className="small">
                          {titleCase(entry.entityType)}
                          {entry.entityId ? (
                            <>
                              <br />
                              <span className="sub mono">{entry.entityId}</span>
                            </>
                          ) : null}
                        </td>
                        <td>
                          {profile ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span className="avatar" style={{ width: 26, height: 26, fontSize: '0.62rem' }}>
                                {initials(profile.full_name ?? profile.email ?? '?')}
                              </span>
                              <span className="small">
                                {profile.full_name ?? profile.email}
                                <br />
                                <span className="sub">{entry.actorRole ?? '—'}</span>
                              </span>
                            </span>
                          ) : (
                            <span className="small muted">{entry.actorRole ?? 'System'}</span>
                          )}
                        </td>
                        <td className="small muted" style={{ maxWidth: 340 }}>
                          {detailsText(entry.details)}
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
