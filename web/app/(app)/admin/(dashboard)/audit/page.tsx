import Link from 'next/link';
import { Activity, Search, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime, initials, titleCase } from '@/lib/format';
import { EmptyState, Notice, PageHead } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

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
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).audit;
  const c = pick(common, locale);
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error ?? error?.message} />

      <div className="kpi-grid">
        <div className="kpi">
          <span className="kpi-icon">
            <Activity size={17} />
          </span>
          <strong>{allEntries.length}</strong>
          <span>{t.recentEntries}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--mint-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{adminEntries.length}</strong>
          <span>{t.adminActions}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--gold-soft)' }}>
            <Activity size={17} />
          </span>
          <strong>{todayCount}</strong>
          <span>{t.today}</span>
        </div>
        <div className="kpi">
          <span className="kpi-icon" style={{ background: 'var(--lavender-soft)' }}>
            <ShieldCheck size={17} />
          </span>
          <strong>{uniqueActors}</strong>
          <span>{t.actors}</span>
        </div>
      </div>

      <form className="toolbar" action="/admin/audit" method="get">
        <div className="search-bar">
          <Search size={17} />
          <input name="q" defaultValue={params.q ?? ''} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
        </div>
        <select name="source" defaultValue={source} aria-label={t.sourceLabel}>
          <option value="">{t.allSources}</option>
          <option value="admin">{t.adminActions}</option>
          <option value="audit">{t.databaseAudit}</option>
        </select>
        <button className="btn sm" type="submit">
          {c.actions.filter}
        </button>
        {q || source ? (
          <Link className="btn sm ghost" href="/admin/audit">
            {c.actions.clear}
          </Link>
        ) : null}
      </form>

      {entries.length === 0 ? (
        <EmptyState
          title={q || source ? t.noEntriesMatch : t.noEntriesYet}
          body={
            q || source
              ? t.tryDifferentSearch
              : t.emptyBody
          }
        />
      ) : (
        <section className="panel">
          <div className="panel-head">
            <h3>
              {fill(entries.length === 1 ? t.entryCountOne : t.entryCount, { count: entries.length })}
            </h3>
            <span className="small muted">{t.newestFirst}</span>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.when}</th>
                    <th>{t.source}</th>
                    <th>{t.action}</th>
                    <th>{t.entity}</th>
                    <th>{t.actor}</th>
                    <th>{t.details}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const profile = entry.actorId ? profileMap.get(entry.actorId) : null;
                    return (
                      <tr key={entry.id}>
                        <td className="small muted" style={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(entry.createdAt, locale)}
                        </td>
                        <td>
                          <span className={`tag ${entry.source === 'admin' ? 'coral' : 'neutral'}`}>
                            {entry.source === 'admin' ? t.admin : t.audit}
                          </span>
                        </td>
                        <td className="strong">{entry.action}</td>
                        <td className="small">
                          {titleCase(entry.entityType, locale)}
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
                            <span className="small muted">{entry.actorRole ?? t.system}</span>
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
