import { requireAdmin } from '@/lib/auth';
import { adminDeleteGiftCover, adminSaveGiftCover } from '@/lib/actions/gift-covers';
import { Notice, PageHead } from '@/components/ui';
import { adminCopy } from '@/lib/i18n/admin';
import { pick } from '@/lib/i18n';
import { getUserLocale } from '@/lib/i18n/server';

export default async function AdminGiftCoversPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();
  const locale = await getUserLocale(ctx.profile?.preferred_language);
  const t = pick(adminCopy, locale).nav;

  const { data } = await ctx.supabase
    .from('gift_covers')
    .select('id, name, name_ar, image_url, active, sort_order')
    .order('sort_order', { ascending: true });
  const covers = (data ?? []) as {
    id: string;
    name: string;
    name_ar: string | null;
    image_url: string;
    active: boolean;
    sort_order: number;
  }[];

  return (
    <div className="dash-content">
      <PageHead eyebrow={t.group7} title={t.expoCovers} description={t.expoCoversHint} />
      <Notice error={params.error} success={params.saved === '1' ? 'Cover saved.' : null} />

      <section className="panel">
        <div className="panel-head">
          <h3>Upload a cover</h3>
          <span className="small muted">PNG, JPEG, WebP or GIF up to 5 MB</span>
        </div>
        <div className="panel-body">
          <form action={adminSaveGiftCover} style={{ display: 'grid', gap: 12 }} encType="multipart/form-data">
            <div className="form-grid">
              <label>
                <span>Name (EN)</span>
                <input name="name" required maxLength={80} />
              </label>
              <label>
                <span>Name (AR)</span>
                <input name="name_ar" maxLength={80} />
              </label>
              <label>
                <span>Order</span>
                <input name="sort_order" type="number" defaultValue={0} />
              </label>
              <label>
                <span>Active</span>
                <input name="active" type="checkbox" defaultChecked />
              </label>
              <label>
                <span>Artwork</span>
                <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
              </label>
            </div>
            <div><button className="btn primary" type="submit">Save cover</button></div>
          </form>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Covers in the app</h3></div>
        <div className="panel-body">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Preview</th><th>Name</th><th>Order</th><th>Active</th><th>Edit</th><th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {covers.map((cover) => (
                  <tr key={cover.id}>
                    <td>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cover.image_url} alt={cover.name} width={40} height={56} style={{ objectFit: 'cover' }} />
                    </td>
                    <td>{cover.name}</td>
                    <td>{cover.sort_order}</td>
                    <td>{cover.active ? 'Yes' : 'No'}</td>
                    <td>
                      <form action={adminSaveGiftCover} encType="multipart/form-data">
                        <input type="hidden" name="id" value={cover.id} />
                        <input type="hidden" name="name" value={cover.name} />
                        <input type="hidden" name="name_ar" value={cover.name_ar ?? ''} />
                        <input type="hidden" name="sort_order" value={cover.sort_order} />
                        {cover.active ? <input type="hidden" name="active" value="on" /> : null}
                        <label className="small muted">
                          Replace image <input name="image" type="file" accept="image/*" />
                        </label>
                        <button className="btn sm" type="submit">Save</button>
                      </form>
                    </td>
                    <td>
                      <form action={adminDeleteGiftCover}>
                        <input type="hidden" name="id" value={cover.id} />
                        <button className="btn sm danger" type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {covers.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No covers uploaded yet. The app still shows its built-in designs.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
