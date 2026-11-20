import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { formatMoney, minorToInput } from '@/lib/money';
import { Notice, PageHead, StatusTag } from '@/components/ui';
import { adminSaveAdvertisingPlacement, adminSaveAdvertisingPricing } from '@/lib/actions/advertising';

const KINDS = [
  'homepage_hero_carousel',
  'homepage_featured_business',
  'homepage_featured_gift_card',
  'homepage_featured_category',
  'marketplace_sponsored_card',
  'marketplace_sponsored_business',
  'marketplace_category_position',
  'category_carousel',
  'collection_carousel',
  'search_sponsored_result',
  'trending_placement',
  'discovery_placement',
  'bulk_deals_ranking',
];


export default async function AdminAdvertisingPlacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; pricing?: string; saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireAdmin();

  const [placementsResult, pricingResult, slotMapResult] = await Promise.all([
    ctx.supabase.from('advertising_placements').select('*').order('sort_order', { ascending: true }),
    ctx.supabase
      .from('advertising_pricing')
      .select('*, advertising_placements(id,key,name)')
      .order('placement_id')
      .order('pricing_model'),
    ctx.supabase.rpc('advertising_slot_map'),
  ]);

  const placements = placementsResult.data ?? [];
  const pricing = pricingResult.data ?? [];
  const slotRows = (slotMapResult.data ?? []) as Array<Record<string, any>>;
  const editing = params.edit ? placements.find((row: any) => row.id === params.edit) : null;
  const editingPrice = params.pricing ? pricing.find((row: any) => row.id === params.pricing) : null;

  const slotInventory = placements
    .filter((placement: any) => Number(placement.slot_count ?? 0) > 0 && placement.is_active)
    .map((placement: any) => ({
      placement,
      slots: slotRows
        .filter((row) => row.placement_key === placement.key)
        .sort((a, b) => Number(a.slot_number) - Number(b.slot_number)),
    }));

  return (
    <div className="dash-content">
      <PageHead
        eyebrow="Advertising & promotions"
        title="Placements & pricing"
        description="Every sellable advertising position and its fixed price per 6-hour booking. New prices only apply to new bookings — existing campaigns keep their snapshot."
      />
      <Notice error={params.error} success={params.saved === '1' ? 'Saved.' : null} />

      <div className="dash-grid">
        <section className="panel">
          <div className="panel-head">
            <h3>{editing ? 'Edit placement' : 'Add placement'}</h3>
            {editing ? (
              <Link className="btn sm ghost" href="/admin/advertising/placements">
                Cancel
              </Link>
            ) : null}
          </div>
          <div className="panel-body">
            <form action={adminSaveAdvertisingPlacement} style={{ display: 'grid', gap: 12 }}>
              {editing ? <input type="hidden" name="placement_id" value={editing.id} /> : null}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="key">Key</label>
                  <input id="key" name="key" required defaultValue={editing?.key ?? ''} placeholder="homepage_hero_carousel" />
                  <span className="hint">The app requests this key. Changing it breaks live delivery.</span>
                </div>
                <div className="field">
                  <label htmlFor="kind">Kind</label>
                  <select id="kind" name="kind" defaultValue={editing?.kind ?? 'homepage_hero_carousel'}>
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>{kind.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input id="name" name="name" required defaultValue={editing?.name ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="name_ar">Name (Arabic)</label>
                  <input id="name_ar" name="name_ar" dir="rtl" defaultValue={editing?.name_ar ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="description">Description</label>
                  <input id="description" name="description" defaultValue={editing?.description ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="description_ar">Description (Arabic)</label>
                  <input id="description_ar" name="description_ar" dir="rtl" defaultValue={editing?.description_ar ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="format">Format</label>
                  <select id="format" name="format" defaultValue={editing?.format ?? 'banner'}>
                    {['banner', 'carousel', 'native', 'card'].map((format) => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="rotation_mode">Rotation mode</label>
                  <select id="rotation_mode" name="rotation_mode" defaultValue={editing?.rotation_mode ?? 'shared'}>
                    {['fixed', 'shared', 'auction'].map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="slot_count">Guaranteed slots</label>
                  <input id="slot_count" name="slot_count" type="number" min={0} defaultValue={editing?.slot_count ?? 0} />
                  <span className="hint">0 means shared capacity only.</span>
                </div>
                <div className="field full">
                  <label htmlFor="slot_prices">Slot prices (QAR, slot 1 first)</label>
                  <input
                    id="slot_prices"
                    name="slot_prices"
                    defaultValue={(editing?.slot_prices_minor ?? [])
                      .map((value: number) => minorToInput(value))
                      .join(', ')}
                    placeholder="1500, 1200, 1000, 800, 600, 500, 400, 300"
                  />
                  <span className="hint">
                    Comma-separated, one price per numbered slot, each the price of a 24-hour booking. Slot 1 is seen
                    first and should cost the most. Shorter and longer bookings are charged pro-rata to the hour. Leave
                    empty to use the fixed price for every slot.
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="max_active_campaigns">Max active campaigns</label>
                  <input id="max_active_campaigns" name="max_active_campaigns" type="number" min={0} defaultValue={editing?.max_active_campaigns ?? 0} />
                  <span className="hint">0 falls back to the placement capacity rule.</span>
                </div>
                <div className="field">
                  <label htmlFor="priority">Priority</label>
                  <input id="priority" name="priority" type="number" defaultValue={editing?.priority ?? 0} />
                </div>
                <div className="field">
                  <label htmlFor="sort_order">Sort order</label>
                  <input id="sort_order" name="sort_order" type="number" defaultValue={editing?.sort_order ?? 0} />
                </div>
                <div className="field">
                  <label htmlFor="creative_width">Creative width</label>
                  <input id="creative_width" name="creative_width" type="number" defaultValue={editing?.creative_width ?? ''} />
                </div>
                <div className="field">
                  <label htmlFor="creative_height">Creative height</label>
                  <input id="creative_height" name="creative_height" type="number" defaultValue={editing?.creative_height ?? ''} />
                </div>
                <div className="field full">
                  <label htmlFor="config">Config (JSON)</label>
                  <textarea id="config" name="config" rows={4} defaultValue={JSON.stringify(editing?.config ?? {}, null, 2)} />
                  <span className="hint">Auto-rotate seconds, max per vendor, aspect ratio and other app-read settings.</span>
                </div>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" name="is_active" defaultChecked={editing ? editing.is_active : true} />
                Active
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="supports_carousel" defaultChecked={editing?.supports_carousel ?? false} />
                Supports carousel
              </label>
              <label className="checkbox-row">
                <input type="checkbox" name="auction_enabled" defaultChecked={editing ? editing.auction_enabled : true} />
                Auction ranking enabled
              </label>
              <div className="field full">
                <label>Pricing model</label>
                <input type="hidden" name="allowed_pricing_models" value="fixed" />
                <div className="card flat" style={{ padding: '8px 12px' }}>
                  <strong>Fixed price only</strong>
                  <span className="sub">Every booking is a 6-hour slot at the price set below.</span>
                </div>
              </div>
              <button className="btn primary" type="submit">{editing ? 'Save placement' : 'Create placement'}</button>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>{editingPrice ? 'Edit price' : 'Add price'}</h3>
            {editingPrice ? (
              <Link className="btn sm ghost" href="/admin/advertising/placements">
                Cancel
              </Link>
            ) : null}
          </div>
          <div className="panel-body">
            <form action={adminSaveAdvertisingPricing} style={{ display: 'grid', gap: 12 }}>
              {editingPrice ? <input type="hidden" name="pricing_id" value={editingPrice.id} /> : null}
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="placement_id">Placement</label>
                  <select id="placement_id" name="placement_id" defaultValue={editingPrice?.placement_id ?? ''} required>
                    <option value="">Choose a placement</option>
                    {placements.map((placement: any) => (
                      <option key={placement.id} value={placement.id}>{placement.name}</option>
                    ))}
                  </select>
                </div>
                <input type="hidden" name="pricing_model" value="fixed" />
                <div className="field">
                  <label htmlFor="fixed_price">Price per 6-hour booking (QAR)</label>
                  <input id="fixed_price" name="fixed_price" inputMode="decimal" defaultValue={minorToInput(editingPrice?.fixed_price_minor ?? 0)} />
                  <span className="hint">Charged once per booking. The slot price list on the placement overrides it per slot.</span>
                </div>
                <div className="field">
                  <label htmlFor="currency">Currency</label>
                  <input id="currency" name="currency" defaultValue={editingPrice?.currency ?? 'QAR'} />
                </div>
                <div className="field">
                  <label htmlFor="min_budget">Minimum budget (QAR)</label>
                  <input id="min_budget" name="min_budget" inputMode="decimal" defaultValue={minorToInput(editingPrice?.min_budget_minor ?? 0)} />
                </div>
                <div className="field">
                  <label htmlFor="max_budget">Maximum budget (QAR)</label>
                  <input id="max_budget" name="max_budget" inputMode="decimal" defaultValue={editingPrice?.max_budget_minor != null ? minorToInput(editingPrice.max_budget_minor) : ''} />
                </div>
                <div className="field">
                  <label htmlFor="platform_fee_bps">Platform fee (bps)</label>
                  <input id="platform_fee_bps" name="platform_fee_bps" type="number" min={0} max={10000} defaultValue={editingPrice?.platform_fee_bps ?? 0} />
                </div>
                <div className="field">
                  <label htmlFor="tax_bps">Tax (bps)</label>
                  <input id="tax_bps" name="tax_bps" type="number" min={0} max={10000} defaultValue={editingPrice?.tax_bps ?? 0} />
                </div>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" name="is_active" defaultChecked={editingPrice ? editingPrice.is_active : true} />
                Active — deactivates the previous price for this placement and model
              </label>
              <button className="btn primary" type="submit">{editingPrice ? 'Save price' : 'Create price'}</button>
            </form>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3>Placements</h3>
          <span className="small muted">{placements.length} positions</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Placement</th>
                  <th>Format</th>
                  <th className="num">Slots</th>
                  <th className="num">Max active</th>
                  <th>Rotation</th>
                  <th>Models</th>
                  <th>Active</th>
                  <th style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {placements.map((placement: any) => (
                  <tr key={placement.id}>
                    <td>
                      <span className="strong">{placement.name}</span>
                      <div className="sub mono">{placement.key}</div>
                    </td>
                    <td className="small">{placement.format}</td>
                    <td className="num">{placement.slot_count || '—'}</td>
                    <td className="num">{placement.max_active_campaigns || 'rule'}</td>
                    <td className="small">{placement.rotation_mode}</td>
                    <td className="small">
                      {(placement.allowed_pricing_models ?? ['fixed'])
                        .map((m: string) => m.toUpperCase())
                        .join(', ')}
                    </td>
                    <td><StatusTag status={placement.is_active ? 'active' : 'paused'} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn sm ghost" href={`/admin/advertising/placements?edit=${placement.id}`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Slot inventory</h3>
          <span className="small muted">Numbered slots, live occupancy and when each one frees up</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Placement</th>
                  <th className="num">Slot</th>
                  <th>State</th>
                  <th>Filled until</th>
                  <th>Queue clears</th>
                </tr>
              </thead>
              <tbody>
                {slotInventory.map(({ placement, slots }) =>
                  slots.map((slot: any, index: number) => (
                    <tr key={`${placement.id}-${slot.slot_number}`}>
                      {index === 0 ? (
                        <td rowSpan={slots.length}>
                          <span className="strong">{placement.name}</span>
                          <div className="sub mono">{placement.key}</div>
                        </td>
                      ) : null}
                      <td className="num">{slot.slot_number}</td>
                      <td>
                        <span
                          className={`tag ${
                            slot.state === 'occupied' ? 'warning' : slot.state === 'reserved' ? 'neutral' : 'success'
                          }`}
                        >
                          {slot.state}
                        </span>
                      </td>
                      <td className="small">
                        {slot.occupied_until ? new Date(slot.occupied_until).toLocaleString() : '—'}
                      </td>
                      <td className="small">
                        {slot.next_free_at ? new Date(slot.next_free_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Pricing</h3>
          <span className="small muted">One fixed price per placement, charged per 6-hour booking</span>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Placement</th>
                  <th className="num">Per 6 hours</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {pricing.map((price: any) => (
                  <tr key={price.id}>
                    <td>{price.advertising_placements?.name ?? '—'}</td>
                    <td className="num">{price.fixed_price_minor ? formatMoney(price.fixed_price_minor) : '—'}</td>
                    <td className="small">v{price.version}</td>
                    <td><StatusTag status={price.is_active ? 'active' : 'archived'} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn sm ghost" href={`/admin/advertising/placements?pricing=${price.id}`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
