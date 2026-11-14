'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Check,
  Megaphone,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { formatMoney } from '@/lib/money';
import { AdvertisingCreativeImage } from '@/components/AdvertisingCreativeImage';

export interface WizardPricing {
  id: string;
  pricing_model: 'fixed' | 'cpc' | 'cpm';
  currency: string;
  fixed_price_minor: number;
  cpc_rate_minor: number;
  cpm_rate_minor: number;
  min_duration_days: number;
  max_duration_days: number;
  default_duration_days: number;
  min_budget_minor: number;
  max_budget_minor: number | null;
}

export interface WizardPlacement {
  id: string;
  key: string;
  kind: string;
  name: string;
  description: string | null;
  format: string;
  supports_carousel: boolean;
  slot_count: number;
  slot_prices_minor: number[] | null;
  max_active_campaigns: number;
  rotation_mode: string;
  creative_width: number | null;
  creative_height: number | null;
  allowed_pricing_models: string[];
  advertising_pricing: WizardPricing[];
}

export interface WizardCampaign {
  id: string;
  name: string;
  placement_key: string;
  pricing_id: string | null;
  pricing_model: string;
  slot_number: number | null;
  starts_at: string;
  ends_at: string;
  total_budget_minor: number;
  daily_budget_minor: number;
  auto_renew: boolean;
  payment_status: string;
  status: string;
  advertising_creatives?: Array<Record<string, any>>;
}

export interface WizardSlot {
  slot_number: number;
  state: 'free' | 'occupied' | 'reserved';
  occupied_until: string | null;
  next_free_at: string | null;
}

/** Groups placements by the surface they run on, so the list stays readable. */
export type PlacementSurface = 'homepage' | 'categories' | 'collections' | 'search' | 'marketplace' | 'other';

const SURFACES: { id: PlacementSurface; label: string }[] = [
  { id: 'homepage', label: 'Homepage' },
  { id: 'categories', label: 'Categories' },
  { id: 'collections', label: 'Collections' },
  { id: 'search', label: 'Search' },
  { id: 'marketplace', label: 'Marketplace' },
  { id: 'other', label: 'Other' },
];

export function surfaceFor(key: string): PlacementSurface {
  if (key.startsWith('homepage')) return 'homepage';
  if (key.startsWith('category')) return 'categories';
  if (key.startsWith('collection')) return 'collections';
  if (key.startsWith('search')) return 'search';
  if (key.startsWith('marketplace')) return 'marketplace';
  return 'other';
}

const STEPS = [
  { title: 'Placement', hint: 'Where the ad appears' },
  { title: 'Creative', hint: 'What the customer sees' },
];

export function CampaignWizard({
  action,
  placements,
  offers,
  categories,
  vendorId,
  vendorName,
  home,
  locale = 'en',
  campaign,
  slotsByPlacement = {},
}: {
  action: (formData: FormData) => void | Promise<void>;
  placements: WizardPlacement[];
  offers: { id: string; title: string }[];
  categories: { id: string; name: string }[];
  vendorId: string;
  vendorName: string;
  /** Base path for the cancel link, derived from the signed-in advertiser context. */
  home?: string;
  locale?: 'en' | 'ar';
  campaign?: WizardCampaign | null;
  /** Slot states keyed by placement, loaded once on the server. */
  slotsByPlacement?: Record<string, WizardSlot[]>;
}) {
  const creative = campaign?.advertising_creatives?.[0] ?? {};
  const firstPlacement =
    placements.find((placement) => placement.key === campaign?.placement_key) ?? placements[0] ?? null;

  const [step, setStep] = useState(0);
  const [surface, setSurface] = useState<PlacementSurface>(
    surfaceFor(campaign?.placement_key ?? firstPlacement?.key ?? ''),
  );
  const [placementKey, setPlacementKey] = useState(firstPlacement?.key ?? '');
  const [pricingId, setPricingId] = useState(
    campaign?.pricing_id ?? firstPlacement?.advertising_pricing?.[0]?.id ?? '',
  );
  const [slotNumber, setSlotNumber] = useState(campaign?.slot_number ?? 1);
  const [periods, setPeriods] = useState(() => {
    if (!campaign) return 1;
    const hours =
      (new Date(campaign.ends_at).getTime() - new Date(campaign.starts_at).getTime()) / (60 * 60 * 1000);
    return Math.max(1, Math.round(hours / 6));
  });
  const [destinationType, setDestinationType] = useState(String(creative.destination_type ?? 'business'));
  const [headline, setHeadline] = useState(String(creative.headline ?? ''));
  const [body, setBody] = useState(String(creative.body ?? ''));
  const [imageUrl, setImageUrl] = useState(String(creative.image_url ?? ''));
  const [mobileImageUrl, setMobileImageUrl] = useState(String(creative.mobile_image_url ?? ''));
  const [ctaLabel, setCtaLabel] = useState(String(creative.cta_label ?? 'Learn more'));
  const [message, setMessage] = useState<string | null>(null);


  const placement = placements.find((row) => row.key === placementKey) ?? null;
  const price = placement?.advertising_pricing.find((row) => row.id === pricingId) ?? null;
  const slotBased = Boolean(placement && placement.slot_count > 0);
  const slotCount = slotBased ? placement!.slot_count : 0;
  const slotPrice = slotBased
    ? placement?.slot_prices_minor?.[slotNumber - 1] ?? price?.fixed_price_minor ?? 0
    : price?.fixed_price_minor ?? 0;
  const quoteMinor = slotPrice * periods;
  const PERIOD_CHOICES = [1, 2, 3, 4, 6, 8, 12];
  const periodsLocked = Boolean(campaign && campaign.payment_status === 'paid');
  const needsImage = placement?.format === 'banner' || placement?.format === 'carousel';
  const visiblePlacements = placements.filter((row) => surfaceFor(row.key) === surface);
  const slots = placement ? slotsByPlacement[placement.key] ?? [] : [];

  // A booking is a single six-hour window. The server picks the first free one,
  // so the wizard only shows when that is.
  const nextSlotStart = useMemo(() => {
    const info = slots.find((row) => row.slot_number === slotNumber);
    const occupiedUntil = info?.occupied_until ? new Date(info.occupied_until).getTime() : 0;
    return new Date(Math.max(Date.now(), Number.isFinite(occupiedUntil) ? occupiedUntil : 0));
  }, [slots, slotNumber]);
  const hoursToNextSlot = Math.max(
    0,
    Math.ceil((nextSlotStart.getTime() - Date.now()) / (60 * 60 * 1000)),
  );

  function choosePlacement(next: WizardPlacement) {
    setPlacementKey(next.key);
    setPricingId(
      next.advertising_pricing.find((row) => row.pricing_model === 'fixed')?.id ??
        next.advertising_pricing[0]?.id ??
        '',
    );
    setSlotNumber(1);
    setMessage(null);
    // Gift-card surfaces should land their audience on a gift card, not the
    // vendor's generic business page. Category and collection carousels render
    // gift cards too, so they default to a gift-card destination.
    const giftCardSurfaces = new Set([
      'homepage_featured_gift_card',
      'marketplace_sponsored_card',
      'search_sponsored_result',
      'bulk_deals_ranking',
    ]);
    const wantsGiftCard =
      giftCardSurfaces.has(next.key) ||
      next.kind === 'category_carousel' ||
      next.kind === 'collection_carousel';
    setDestinationType(wantsGiftCard ? 'gift_card' : 'business');
  }

  function chooseSlot(slot: number) {
    setSlotNumber(slot);
    setMessage(null);
  }

  function nextStep() {
    if (step === 0 && (!placementKey || !pricingId)) {
      setMessage('Choose a placement and a pricing model to continue.');
      return;
    }
    if (step === 1) {
      if (!headline.trim()) {
        setMessage('Add a headline so the ad can be reviewed.');
        return;
      }
      if (needsImage && !imageUrl.trim()) {
        setMessage('This placement needs a banner image. Upload one to continue.');
        return;
      }
      if (destinationType === 'url') {
        const url = String((document.getElementById('destination_url') as HTMLInputElement | null)?.value ?? '');
        if (!/^https?:\/\//i.test(url)) {
          setMessage('Enter a full destination URL starting with http:// or https://.');
          return;
        }
      }
    }
    if (step === 0 && slotBased && (!slotNumber || slotNumber < 1 || slotNumber > slotCount)) {
      setMessage('Choose the slot you want to rent.');
      return;
    }
    setMessage(null);
    setStep((current) => Math.min(1, current + 1));
  }

  return (
    <form action={action} style={{ display: 'grid', gap: 18 }}>
      {campaign ? <input type="hidden" name="campaign_id" value={campaign.id} /> : null}
      <input type="hidden" name="placement_key" value={placementKey} />
      <input type="hidden" name="pricing_id" value={pricingId} />
      <input type="hidden" name="slot_number" value={slotNumber} />
      <input
        type="hidden"
        name="starts_at"
        value={campaign ? campaign.starts_at : nextSlotStart.toISOString()}
      />
      <input
        type="hidden"
        name="periods"
        value={periods}
      />
      <input
        type="hidden"
        name="ends_at"
        value={new Date(
          (campaign ? new Date(campaign.starts_at).getTime() : nextSlotStart.getTime()) +
            periods * 6 * 60 * 60 * 1000,
        ).toISOString()}
      />
      <input type="hidden" name="type" value="image" />
      <input type="hidden" name="sponsored_label" value="Sponsored" />
      <input type="hidden" name="sponsored_label_ar" value="إعلان مدفوع" />

      <div className="step-card">
        <div className="stepper">
          {STEPS.map((item, index) => (
            <div key={item.title} className={`step${index === step ? ' active' : index < step ? ' done' : ''}`}>
              <span className="step-number">{index < step ? <Check size={14} /> : index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <div className="sub">{item.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {message ? <div className="callout error">{message}</div> : null}

      <section className="panel" style={{ display: step === 0 ? undefined : 'none' }}>
        <div className="panel-head">
          <h3>
            <Megaphone size={17} /> Choose a placement
          </h3>
          <span className="small muted">Prices are set by the platform and frozen at purchase.</span>
        </div>
        <div className="panel-body">
          <div className="btn-row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {SURFACES.filter((entry) => placements.some((row) => surfaceFor(row.key) === entry.id)).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`btn sm${surface === entry.id ? ' primary' : ' ghost'}`}
                onClick={() => {
                  setSurface(entry.id);
                  const first = placements.find((row) => surfaceFor(row.key) === entry.id);
                  if (first) choosePlacement(first);
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="offer-grid">
            {visiblePlacements.map((row) => {
              const selected = row.key === placementKey;
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`offer-card${selected ? ' selected' : ''}`}
                  onClick={() => choosePlacement(row)}
                  style={{ textAlign: 'left', borderColor: selected ? 'var(--mint)' : undefined }}
                >
                  <div className="offer-body">
                    <div className="offer-meta">
                      <span className="tag neutral">{row.format}</span>
                      <span className="tag lavender">{row.rotation_mode}</span>
                    </div>
                    <strong>{row.name}</strong>
                    {row.description ? <p className="small muted">{row.description}</p> : null}
                    <div className="small">
                      {row.slot_count > 0 ? `${row.slot_count} guaranteed slots` : 'Shared rotation'}
                      {row.creative_width && row.creative_height
                        ? ` · ${row.creative_width}×${row.creative_height}`
                        : ''}
                    </div>
                    {selected ? (
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {row.advertising_pricing.map((model) => (
                          <label
                            key={model.id}
                            className="checkbox-row"
                            style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}
                          >
                            <input
                              type="radio"
                              name="pricing_choice"
                              value={model.id}
                              checked={pricingId === model.id}
                              onChange={() => setPricingId(model.id)}
                            />
                            <span>
                              <strong>{model.pricing_model.toUpperCase()}</strong>{' '}
                              {formatMoney(
                                row.slot_count > 0
                                  ? row.slot_prices_minor?.[0] ?? model.fixed_price_minor
                                  : model.fixed_price_minor,
                              )}
                              <span className="sub">Per 6-hour booking</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          {slotBased ? (
            <div className="field full" style={{ marginTop: 14 }}>
              <label>Slot</label>
              <div className="btn-row" style={{ flexWrap: 'wrap' }}>
                {Array.from({ length: slotCount }, (_, index) => index + 1).map((slot) => {
                  const slotPriceMinor = placement?.slot_prices_minor?.[slot - 1] ?? price?.fixed_price_minor ?? 0;
                  const chosen = slotNumber === slot;
                  const info = slots.find((row) => row.slot_number === slot);
                  const occupied = info?.state === 'occupied';
                  const freeIn = info?.occupied_until
                    ? Math.max(1, Math.ceil((new Date(info.occupied_until).getTime() - Date.now()) / (60 * 60 * 1000)))
                    : 0;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`btn sm${chosen ? ' primary' : ' ghost'}`}
                      onClick={() => chooseSlot(slot)}
                      disabled={Boolean(campaign)}
                      title={`Slot ${slot} — ${formatMoney(slotPriceMinor)} per 6 hours`}
                      style={{ display: 'grid', gap: 2, textAlign: 'center', opacity: occupied && !chosen ? 0.65 : 1 }}
                    >
                      <span>{slot === 1 ? 'Slot 1 · first' : `Slot ${slot}`}</span>
                      <span className="small" style={{ opacity: 0.8 }}>{formatMoney(slotPriceMinor)} / 6h</span>
                      <span className="small" style={{ opacity: 0.8 }}>
                        {occupied && info?.occupied_until
                          ? `Free in ${freeIn}h`
                          : info?.state === 'reserved'
                            ? 'Free now · booked later'
                            : 'Available now'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="callout info" style={{ marginTop: 10 }}>
                <Clock size={16} />{' '}
                {hoursToNextSlot <= 0
                  ? 'This slot is free now, so your ad starts as soon as it is paid and approved.'
                  : `The next available time for your ad in this slot is in ${hoursToNextSlot} hour${hoursToNextSlot === 1 ? '' : 's'} — ${nextSlotStart.toLocaleString()}.`}
              </div>
              <span className="hint">
                Slot 1 is seen first and costs the most. No calendar to fill in — your ad takes the next free time in
                the slot.
              </span>
            </div>
          ) : null}
          {slotBased ? (
            <div className="field full" style={{ marginTop: 14 }}>
              <label>How many 6-hour periods?</label>
              <div className="btn-row" style={{ flexWrap: 'wrap' }}>
                {PERIOD_CHOICES.map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={`btn sm${periods === count ? ' primary' : ' ghost'}`}
                    onClick={() => setPeriods(count)}
                    disabled={periodsLocked}
                  >
                    {count} × 6h{count === 1 ? '' : ` · ${(count * slotPrice) > 0 ? formatMoney(count * slotPrice) : ''}`}
                  </button>
                ))}
              </div>
              <span className="hint">
                {periods} period{periods === 1 ? '' : 's'} = {periods * 6} hours. Total{' '}
                <strong>{formatMoney(quoteMinor)}</strong> at {formatMoney(slotPrice)} per period.
                {campaign?.payment_status === 'paid' ? ' A paid campaign keeps the length it was bought for.' : ''}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel" style={{ display: step === 1 ? undefined : 'none' }}>
        <div className="panel-head">
          <h3>
            <Sparkles size={17} /> Creative
          </h3>
          <span className="small muted">Bilingual copy is optional but recommended.</span>
        </div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="name">Campaign name</label>
              <input id="name" name="name" required defaultValue={campaign?.name ?? ''} placeholder="Weekend coffee promotion" />
              <span className="hint">Only your team sees this name.</span>
            </div>
            <div className="field">
              <label htmlFor="headline">Headline</label>
              <input
                id="headline"
                name="headline"
                required
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder="Your coffee weekend starts here"
              />
            </div>
            <div className="field">
              <label htmlFor="headline_ar">Headline (Arabic)</label>
              <input id="headline_ar" name="headline_ar" dir="rtl" defaultValue={String(creative.headline_ar ?? '')} />
            </div>
            <div className="field">
              <label htmlFor="body">Body</label>
              <textarea
                id="body"
                name="body"
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Two-for-one on every handcrafted coffee this weekend."
              />
            </div>
            <div className="field">
              <label htmlFor="body_ar">Body (Arabic)</label>
              <textarea id="body_ar" name="body_ar" rows={3} dir="rtl" defaultValue={String(creative.body_ar ?? '')} />
            </div>
            {needsImage ? (
              <>
                <div className="field full">
                  <label>Creative image (required)</label>
                  <AdvertisingCreativeImage kind="image" currentUrl={imageUrl || null} locale={locale} onUploaded={setImageUrl} />
                </div>
                <div className="field full">
                  <label>Mobile image</label>
                  <AdvertisingCreativeImage kind="mobile_image" currentUrl={mobileImageUrl || null} locale={locale} onUploaded={setMobileImageUrl} />
                </div>
                <div className="field">
                  <label htmlFor="image_alt">Image alt text</label>
                  <input id="image_alt" name="image_alt" defaultValue={String(creative.image_alt ?? '')} />
                </div>
                <div className="field">
                  <label htmlFor="image_alt_ar">Image alt text (Arabic)</label>
                  <input id="image_alt_ar" name="image_alt_ar" dir="rtl" defaultValue={String(creative.image_alt_ar ?? '')} />
                </div>
              </>
            ) : null}
            <input type="hidden" name="image_url" value={needsImage ? imageUrl : ''} />
            <input type="hidden" name="mobile_image_url" value={mobileImageUrl} />
            <div className="field">
              <label htmlFor="cta_label">Button label</label>
              <input
                id="cta_label"
                name="cta_label"
                value={ctaLabel}
                onChange={(event) => setCtaLabel(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="cta_label_ar">Button label (Arabic)</label>
              <input id="cta_label_ar" name="cta_label_ar" dir="rtl" defaultValue={String(creative.cta_label_ar ?? '')} />
            </div>
            <div className="field">
              <label htmlFor="destination_type">Destination</label>
              <select
                id="destination_type"
                name="destination_type"
                value={destinationType}
                onChange={(event) => setDestinationType(event.target.value)}
              >
                <option value="business">Business page</option>
                <option value="gift_card">Gift card</option>
                <option value="category">Category</option>
                <option value="url">External URL</option>
              </select>
            </div>
            {destinationType === 'business' ? (
              <div className="field">
                <label>Business</label>
                <input value={vendorName} readOnly />
                <input type="hidden" name="destination_id" value={vendorId} />
                <span className="hint">Sponsored traffic can point at your own business page.</span>
              </div>
            ) : null}
            {destinationType === 'gift_card' ? (
              <div className="field">
                <label htmlFor="destination_gift_card">Gift card</label>
                <select
                  id="destination_gift_card"
                  name="destination_id"
                  defaultValue={String(creative.destination_id ?? '')}
                  required
                >
                  <option value="">Choose a gift card</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>{offer.title}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {destinationType === 'category' ? (
              <div className="field">
                <label htmlFor="destination_category">Category</label>
                <select
                  id="destination_category"
                  name="destination_id"
                  defaultValue={String(creative.destination_id ?? '')}
                  required
                >
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {destinationType === 'url' ? (
              <div className="field">
                <label htmlFor="destination_url">Destination URL</label>
                <input
                  id="destination_url"
                  name="destination_url"
                  defaultValue={String(creative.destination_url ?? '')}
                  placeholder="https://your-business.com/offer"
                />
              </div>
            ) : (
              <input type="hidden" name="destination_url" value="" />
            )}
          </div>
        </div>
      </section>

      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <div>
          {step > 0 ? (
            <button className="btn ghost" type="button" onClick={() => setStep((current) => current - 1)}>
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <Link className="btn ghost" href={home ?? '/vendor/advertising'}>
              Cancel
            </Link>
          )}
        </div>
        <div className="btn-row">
          {step < 1 ? (
            <button className="btn primary" type="button" onClick={nextStep}>
              Continue <ArrowRight size={15} />
            </button>
          ) : (
            <button className="btn primary" type="submit">
              <Wallet size={15} /> {campaign ? 'Save changes' : 'Continue to checkout'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
