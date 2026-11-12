import Link from 'next/link';
import { Building2, ShieldCheck, Users, Image } from 'lucide-react';
import { requireEnterprise } from '@/lib/auth';
import { saveEnterpriseProfile } from '@/lib/actions/enterprise';
import { uploadPartnerImage, removePartnerImage } from '@/lib/actions/partner';
import { formatDate, initials, titleCase } from '@/lib/format';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { VendorImageUpload } from '@/components/VendorImageUpload';
import { pick } from '@/lib/i18n';
import { enterpriseCopy } from '@/lib/i18n/enterprise';
import { getLocale } from '@/lib/i18n/server';

export default async function EnterpriseSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = pick(enterpriseCopy, locale).settings;
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
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
      />

      <Notice error={params.error} success={params.saved === '1' ? t.saved : null} />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{t.companyDetails}</h3>
            <StatusTag status={partner.status} />
          </div>
          <div className="panel-body">
            <form action={saveEnterpriseProfile} style={{ display: 'grid', gap: 16 }}>
              <div className="form-grid">
                <div className="field full">
                  <label htmlFor="name">{t.companyName}</label>
                  <input id="name" name="name" required defaultValue={partner.name} />
                </div>
                <div className="field">
                  <label htmlFor="website">{t.website}</label>
                  <input id="website" name="website" defaultValue={partner.website ?? ''} placeholder="https://…" />
                </div>
                <div className="field">
                  <label htmlFor="industry">{t.industry}</label>
                  <input id="industry" name="industry" defaultValue={partner.industry ?? ''} placeholder={t.industryPlaceholder} />
                </div>
                <div className="field">
                  <label htmlFor="contact_name">{t.primaryContact}</label>
                  <input id="contact_name" name="contact_name" defaultValue={partner.contact_name ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="contact_email">{t.contactEmail}</label>
                  <input id="contact_email" name="contact_email" type="email" defaultValue={partner.contact_email ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="contact_phone">{t.contactPhone}</label>
                  <input id="contact_phone" name="contact_phone" defaultValue={partner.contact_phone ?? ''} placeholder="+974 …" />
                </div>
                <div className="field">
                  <label htmlFor="expected_volume">{t.expectedVolume}</label>
                  <input id="expected_volume" name="expected_volume" defaultValue={partner.expected_volume ?? ''} placeholder={t.volumePlaceholder} />
                </div>
                <div className="field full">
                  <label htmlFor="notes">{t.notesForGiftly}</label>
                  <textarea id="notes" name="notes" defaultValue={partner.notes ?? ''} placeholder={t.notesPlaceholder} />
                </div>
                <div className="field full">
                  <label htmlFor="full_name">{t.yourName}</label>
                  <input id="full_name" name="full_name" defaultValue={ctx.profile?.full_name ?? ''} />
                  <span className="hint">{t.yourNameHint}</span>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn lavender" type="submit" disabled={!canManage}>
                  {t.saveSettings}
                </button>
                {!canManage ? (
                  <span className="small muted">{t.analystReadOnly}</span>
                ) : null}
              </div>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{t.storefrontImages}</h3>
            <Image size={16} />
          </div>
          <div className="panel-body">
            <p className="small muted" style={{ marginBottom: 14 }}>
              {t.storefrontImagesBody}
            </p>
            <div style={{ display: 'grid', gap: 16 }}>
              <VendorImageUpload kind="logo" currentUrl={partner.logo_url} />
              <VendorImageUpload kind="banner" currentUrl={partner.banner_url} />
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gap: 20 }}>
          <section className="panel">
            <div className="panel-head">
              <h3>{t.account}</h3>
              <Building2 size={16} />
            </div>
            <div className="panel-body">
              <div className="split-list">
                <div>
                  <span className="k">{t.signedInAs}</span>
                  <span className="v small">{ctx.user.email}</span>
                </div>
                <div>
                  <span className="k">{t.yourRole}</span>
                  <span className="v">{titleCase(ctx.role, locale)}</span>
                </div>
                <div>
                  <span className="k">{t.partnerSince}</span>
                  <span className="v">{formatDate(partner.created_at, locale)}</span>
                </div>
                <div>
                  <span className="k">{t.partnerSlug}</span>
                  <span className="v small mono">{partner.slug}</span>
                </div>
              </div>
              <div className="callout info" style={{ marginTop: 14 }}>
                <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t.encryptionNote}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>{t.teamAccess}</h3>
              <Users size={16} />
            </div>
            <div className="panel-body">
              {(members ?? []).length === 0 ? (
                <p className="small muted">{t.noTeamMembers}</p>
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
                              {profile?.full_name ?? profile?.email ?? t.teamMember}
                            </strong>
                            <br />
                            <span className="small muted">{profile?.email ?? '—'}</span>
                          </span>
                        </span>
                        <span className="v small">
                          <StatusTag status={member.role === 'owner' ? 'approved' : member.role === 'manager' ? 'active' : 'pending'} />{' '}
                          {titleCase(member.role, locale)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="callout info" style={{ marginTop: 14 }}>
                {t.addColleagueNote}
              </div>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <Link className="btn sm" href="/contact">
                  {t.contactGiftly}
                </Link>
                <Link className="btn sm ghost" href="/corporate#enquiry">
                  {t.corporateSite}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
