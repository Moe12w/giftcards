'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Check,
  Eye,
  Image as ImageIcon,
  Megaphone,
  ShieldCheck,
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

function localInput(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addDays(value: string, days: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate() + days);
  return localInput(date);
}

function addHours(value: string, hours: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setHours(date.getHours() + hours);
  return localInput(date);
}

const STEPS = [
  { title: 'Placement', hint: 'Where the ad appears' },
  { title: 'Creative', hint: 'What the customer sees' },
  { title: 'Schedule & budget', hint: 'When and how much' },
  { title: 'Review & checkout', hint: 'Confirm and pay' },
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
  const firstSlotBased = Boolean(firstPlacement && firstPlacement.slot_count > 0);

  const [step, setStep] = useState(0);
  const [surface, setSurface] = useState<PlacementSurface>(
    surfaceFor(campaign?.placement_key ?? firstPlacement?.key ?? ''),
  );
  const [placementKey, setPlacementKey] = useState(firstPlacement?.key ?? '');
  const [pricingId, setPricingId] = useState(
    campaign?.pricing_id ?? firstPlacement?.advertising_pricing?.[0]?.id ?? '',
  );
  const [slotNumber, setSlotNumber] = useState(campaign?.slot_number ?? 1);
  const [startsAt, setStartsAt] = useState(
    campaign ? localInput(campaign.starts_at) : localInput(new Date()),
  );
  const [endsAt, setEndsAt] = useState(
    campaign
      ? localInput(campaign.ends_at)
      : localInput(new Date(Date.now() + (firstSlotBased ? 24 : 30 * 24) * 60 * 60 * 1000)),
  );
  const [totalBudget, setTotalBudget] = useState(
    campaign ? String((campaign.total_budget_minor ?? 0) / 100) : '',
  );
  const [dailyBudget, setDailyBudget] = useState(
    campaign ? String((campaign.daily_budget_minor ?? 0) / 100) : '',
  );
  const [destinationType, setDestinationType] = useState(String(creative.destination_type ?? 'business'));
  const [headline, setHeadline] = useState(String(creative.headline ?? ''));
  const [body, setBody] = useState(String(creative.body ?? ''));
  const [imageUrl, setImageUrl] = useState(String(creative.image_url ?? ''));
  const [mobileImageUrl, setMobileImageUrl] = useState(String(creative.mobile_image_url ?? ''));
  const [ctaLabel, setCtaLabel] = useState(String(creative.cta_label ?? 'Learn more'));
  const [message, setMessage] = useState<string | null>(null);

  const placement = placements.find((row) => row.key === placementKey) ?? null;
  const price = placement?.advertising_pricing.find((row) => row.id === pricingId) ?? null;
  const isFixed = price?.pricing_model === 'fixed';
  const slotBased = Boolean(placement && placement.slot_count > 0);
  const slotCount = slotBased ? placement!.slot_count : 0;
  const slotPrice = slotBased
    ? placement?.slot_prices_minor?.[slotNumber - 1] ?? price?.fixed_price_minor ?? 0
    : 0;
  const budgetLocked = campaign?.payment_status === 'paid';
  const needsImage = placement?.format === 'banner' || placement?.format === 'carousel';
  const visiblePlacements = placements.filter((row) => surfaceFor(row.key) === surface);
  const slots = placement ? slotsByPlacement[placement.key] ?? [] : [];

  const days = useMemo(() => {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
  }, [startsAt, endsAt]);

  const hours = useMemo(() => {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    return (end - start) / (60 * 60 * 1000);
  }, [startsAt, endsAt]);

  // A slot price is the price of a 24-hour block. Shorter and longer bookings
  // are charged pro-rata to the hour, so 6 hours costs a quarter of the slot
  // price and 72 hours costs three times it.
  const slotQuoteMinor = Math.max(1, Math.round((slotPrice * hours) / 24));
  const quoteMinor = isFixed
    ? slotBased
      ? hours > 0
        ? slotQuoteMinor
        : slotPrice
      : price?.fixed_price_minor ?? 0
    : Math.round((Number(totalBudget) || 0) * 100);

  function choosePlacement(next: WizardPlacement) {
    setPlacementKey(next.key);
    setPricingId(next.advertising_pricing[0]?.id ?? '');
    setSlotNumber(1);
    setMessage(null);
    // A slot rental is 6-72 hours, so start with a 24-hour window. Other
    // placements keep the longer default.
    if (next.slot_count > 0) {
      setEndsAt(addHours(startsAt, 24));
    }
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
    const info = slots.find((row) => row.slot_number === slot);
    // An occupied slot can still be booked for a later window; move the start
    // to the moment it frees up so the advertiser does not hit a validation
    // error on save.
    if (info?.state === 'occupied' && info.occupied_until) {
      const nextStart = localInput(info.occupied_until);
      setStartsAt(nextStart);
      setEndsAt(addHours(nextStart, 24));
    }
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
    if (step === 2) {
      if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
        setMessage('The end date must be after the start date.');
        return;
      }
      if (slotBased) {
        if (hours < 6 || hours > 72) {
          setMessage('A slot is rented for between 6 and 72 hours. Adjust the end time.');
          return;
        }
        if (!slotNumber || slotNumber < 1 || slotNumber > slotCount) {
          setMessage('Choose the slot you want to rent.');
          return;
        }
      } else if (price) {
        const min = Math.max(price.min_duration_days, 1);
        const max = Math.min(price.max_duration_days, 365);
        if (days < min || days > max) {
          setMessage(`This placement runs between ${min} and ${max} days.`);
          return;
        }
        if (!isFixed) {
          const budget = Math.round((Number(totalBudget) || 0) * 100);
          if (budget < price.min_budget_minor) {
            setMessage(`The minimum budget for this placement is ${formatMoney(price.min_budget_minor)}.`);
            return;
          }
          if (price.max_budget_minor != null && budget > price.max_budget_minor) {
            setMessage(`The maximum budget for this placement is ${formatMoney(price.max_budget_minor)}.`);
            return;
          }
          if (Number(dailyBudget) > 0 && Number(dailyBudget) * 100 > budget) {
            setMessage('The daily budget cannot be higher than the total budget.');
            return;
          }
        }
      }
    }
    setMessage(null);
    setStep((current) => Math.min(3, current + 1));
  }

  return (
    <form action={action} style={{ display: 'grid', gap: 18 }}>
      {campaign ? <input type="hidden" name="campaign_id" value={campaign.id} /> : null}
      <input type="hidden" name="placement_key" value={placementKey} />
      <input type="hidden" name="pricing_id" value={pricingId} />
      <input type="hidden" name="slot_number" value={slotNumber} />
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
                              {model.pricing_model === 'fixed'
                                ? formatMoney(
                                    row.slot_count > 0
                                      ? row.slot_prices_minor?.[0] ?? model.fixed_price_minor
                                      : model.fixed_price_minor,
                                  )
                                : model.pricing_model === 'cpc'
                                  ? `${formatMoney(model.cpc_rate_minor)} / click`
                                  : `${formatMoney(model.cpm_rate_minor)} / 1,000 views`}
                              <span className="sub">
                                {row.slot_count > 0
                                  ? '6–72 hour rental · slot price per 24 hours'
                                  : `${model.min_duration_days}–${model.max_duration_days} days`}
                                {model.pricing_model !== 'fixed'
                                  ? ` · min budget ${formatMoney(model.min_budget_minor)}`
                                  : ''}
                              </span>
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

      <section className="panel" style={{ display: step === 2 ? undefined : 'none' }}>
        <div className="panel-head">
          <h3>
            <CalendarRange size={17} /> Schedule &amp; budget
          </h3>
          {price ? (
            <span className="small muted">
              {slotBased
                ? 'Slot price per 24 hours · 6–72 hour booking'
                : `${price.pricing_model.toUpperCase()} · ${price.min_duration_days}–${price.max_duration_days} days`}
            </span>
          ) : null}
        </div>
        <div className="panel-body">
          <div className="form-grid">
            {slotBased ? (
              <div className="field full">
                <label>Slot</label>
                <div className="btn-row" style={{ flexWrap: 'wrap' }}>
                  {Array.from({ length: slotCount }, (_, index) => index + 1).map((slot) => {
                    const slotPriceMinor = placement?.slot_prices_minor?.[slot - 1] ?? price?.fixed_price_minor ?? 0;
                    const chosen = slotNumber === slot;
                    const info = slots.find((row) => row.slot_number === slot);
                    const occupied = info?.state === 'occupied';
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`btn sm${chosen ? ' primary' : ' ghost'}`}
                        onClick={() => chooseSlot(slot)}
                        disabled={Boolean(campaign)}
                        title={`Slot ${slot} — ${formatMoney(slotPriceMinor)} per 24 hours`}
                        style={{
                          display: 'grid',
                          gap: 2,
                          textAlign: 'center',
                          opacity: occupied && !chosen ? 0.65 : 1,
                        }}
                      >
                        <span>{slot === 1 ? 'Slot 1 · first' : `Slot ${slot}`}</span>
                        <span className="small" style={{ opacity: 0.8 }}>{formatMoney(slotPriceMinor)} / 24h</span>
                        <span className="small" style={{ opacity: 0.8 }}>
                          {occupied && info?.occupied_until
                            ? `Filled until ${new Date(info.occupied_until).toLocaleString()}`
                            : info?.state === 'reserved'
                              ? 'Free now · booked later'
                              : 'Available'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <span className="hint">
                  Slot 1 is seen first and costs the most. Prices are per 24 hours and are charged pro-rata to the hour,
                  so 6 hours costs a quarter and 72 hours costs three times the slot price. Picking a filled slot moves
                  your start time to the moment it frees up; availability is checked again when you save.
                </span>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="starts_at">Starts</label>
              <input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                required
                disabled={budgetLocked && slotBased}
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="ends_at">Ends</label>
              <input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                required
                disabled={budgetLocked && slotBased}
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
              <span className="hint">
                {hours > 0 ? `${hours.toFixed(1)} hours` : 'Choose an end date'}
                {slotBased ? ' · 6–72 hours allowed' : days > 0 ? ` · ${days} days` : ''}
                {budgetLocked && slotBased ? ' · paid rentals cannot change length' : ''}
              </span>
            </div>

            {isFixed ? (
              <div className="field full">
                <label>{slotBased ? 'Booking total' : 'Fixed price'}</label>
                <div className="card flat">
                  <strong style={{ fontSize: 22 }}>{formatMoney(quoteMinor)}</strong>
                  <span className="small muted">
                    {slotBased
                      ? `${formatMoney(slotPrice)} per 24 hours · ${hours > 0 ? hours.toFixed(1) : 0} hours booked. One payment for the whole window, no automatic renewal.`
                      : 'One payment for the whole schedule. Delivery is not metered.'}
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="total_budget">Total budget (QAR)</label>
                  <input
                    id="total_budget"
                    name="total_budget"
                    inputMode="decimal"
                    required
                    disabled={budgetLocked}
                    value={totalBudget}
                    onChange={(event) => setTotalBudget(event.target.value)}
                  />
                  <span className="hint">
                    Minimum {formatMoney(price?.min_budget_minor ?? 0)}. Spend stops at this amount.
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="daily_budget">Daily budget (QAR)</label>
                  <input
                    id="daily_budget"
                    name="daily_budget"
                    inputMode="decimal"
                    disabled={budgetLocked}
                    value={dailyBudget}
                    onChange={(event) => setDailyBudget(event.target.value)}
                  />
                  <span className="hint">Optional. 0 means no daily cap.</span>
                </div>
              </>
            )}

            <div className="field full">
              <span className="hint">
                {slotBased
                  ? 'No automatic renewal. When your window ends the slot is released for the next advertiser — book again if you want it back.'
                  : 'No automatic renewal. Renew manually from the campaign page when this run ends.'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ display: step === 3 ? undefined : 'none' }}>
        <div className="panel-head">
          <h3>
            <Eye size={17} /> Review
          </h3>
          <span className="small muted">Nothing is charged until you confirm on the next screen.</span>
        </div>
        <div className="panel-body">
          <div className="dash-grid">
            <div className="card flat" style={{ display: 'grid', gap: 8 }}>
              <span className="tag lavender">Sponsored</span>
              {imageUrl ? (
                <img
                  src={mobileImageUrl || imageUrl}
                  alt=""
                  style={{ width: '100%', borderRadius: 12, aspectRatio: '2 / 1', objectFit: 'cover' }}
                />
              ) : (
                <div className="image-preview banner">
                  <ImageIcon size={22} />
                </div>
              )}
              <strong style={{ fontSize: 18 }}>{headline || 'Your headline'}</strong>
              {body ? <p className="small">{body}</p> : null}
              <span className="btn sm primary" style={{ width: 'fit-content' }}>{ctaLabel || 'Learn more'}</span>
              <span className="small muted">{vendorName}</span>
            </div>
            <div className="split-list">
              <div>
                <span className="k">Placement</span>
                <span className="v">{placement?.name ?? '—'}</span>
              </div>
              <div>
                <span className="k">Pricing model</span>
                <span className="v">{price?.pricing_model.toUpperCase() ?? '—'}</span>
              </div>
              <div>
                <span className="k">Schedule</span>
                <span className="v">
                  {startsAt ? new Date(startsAt).toLocaleString() : '—'} → {endsAt ? new Date(endsAt).toLocaleString() : '—'}
                </span>
              </div>
              <div>
                <span className="k">Duration</span>
                <span className="v">{slotBased ? `${hours.toFixed(1)} hours` : `${days} days`}</span>
              </div>
              {slotBased ? (
                <div>
                  <span className="k">Slot</span>
                  <span className="v">{slotNumber === 1 ? 'Slot 1 · first position' : `Slot ${slotNumber}`}</span>
                </div>
              ) : null}
              <div>
                <span className="k">Total</span>
                <span className="v strong" style={{ fontSize: 20 }}>{formatMoney(quoteMinor)}</span>
              </div>
              <div>
                <span className="k">Auto-renew</span>
                <span className="v">None</span>
              </div>
            </div>
          </div>
          <div className="callout info" style={{ marginTop: 14 }}>
            <ShieldCheck size={16} /> Payment is verified on the server. The campaign only activates after payment,
            approval, eligibility and capacity checks pass.
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
          {step < 3 ? (
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
