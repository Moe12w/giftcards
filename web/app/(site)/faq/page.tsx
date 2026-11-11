import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';

export const metadata: Metadata = { title: 'How it works' };

const sections = [
  {
    title: 'For the person sending',
    items: [
      {
        q: 'How do I buy a gift?',
        a: 'Open the Giftly app, choose a vendor, then pick a gift card amount or an experience package. Add a message and a design, choose how to send it, and pay. The gift is delivered as a link your recipient can claim.',
      },
      {
        q: 'Can I choose the amount on an experience?',
        a: 'No — experience gifts are packages created by the vendor. The vendor sets the sessions and the price, so you simply choose the package that fits. Monetary gift cards keep preset and custom amounts.',
      },
      {
        q: 'How do I send a gift on WhatsApp?',
        a: 'Choose WhatsApp as the delivery method, or tap “Send on WhatsApp” on the success screen. Giftly opens your own WhatsApp with a ready-written message and the gift link. You press send, so it comes from you.',
      },
      {
        q: 'Can I schedule a gift for later?',
        a: 'Yes. Pick a delivery date during checkout and the gift will be held until that morning. You can see scheduled gifts in your account.',
      },
      {
        q: 'Can I cancel or refund a gift?',
        a: 'Unclaimed gifts can be cancelled from your account within the cancellation window. Once a gift has been claimed, it can no longer be refunded. Contact us if something is not right.',
      },
    ],
  },
  {
    title: 'For the person receiving',
    items: [
      {
        q: 'How do I claim my gift?',
        a: 'Tap the link in the message you received. If you already have a Giftly account, sign in; if not, create one with the same email or phone number. The gift is added to My gifts automatically.',
      },
      {
        q: 'Can I spend only part of a gift card?',
        a: 'Yes. Monetary cards keep a running balance. Spend QAR 10 of a QAR 100 card and QAR 90 remains for your next visit. The balance is updated at the counter and in the app.',
      },
      {
        q: 'How do I use an experience gift?',
        a: 'Open the gift in My gifts and follow the vendor’s booking instructions. Some experiences need a booking; others can be used during opening hours. The card shows how many sessions remain.',
      },
      {
        q: 'Do gifts expire?',
        a: 'Each vendor sets an expiry for their gifts. The date is shown on the gift before you claim it and on the card afterwards. Gifts without an expiry stay valid until the balance reaches zero.',
      },
      {
        q: 'Can I add a gift to Apple or Google Wallet?',
        a: 'Yes — open a claimed gift in the app and use Add to Wallet. The pass shows the balance and a QR code that vendors scan at the counter.',
      },
    ],
  },
  {
    title: 'For vendors',
    items: [
      {
        q: 'How do I join Giftly?',
        a: 'Apply from the vendor sign-up page. Tell us about your business, what you sell and where you are. Our team reviews every application before your offers go live.',
      },
      {
        q: 'How do I redeem a gift?',
        a: 'Open the Redeem screen in your vendor dashboard, enter the card code, and choose the amount or sessions used. The balance updates instantly and a reference is recorded for your reports.',
      },
      {
        q: 'When do I get paid?',
        a: 'Vendor settlements are calculated from paid orders minus the agreed commission. Your dashboard shows sales, commission and your share. Payouts are made on the agreed settlement cycle.',
      },
      {
        q: 'Can I set my own prices and packages?',
        a: 'Yes. Monetary offers have a minimum, maximum and preset amounts. Experience offers are packages you define, with a label, number of sessions and price.',
      },
    ],
  },
  {
    title: 'For businesses',
    items: [
      {
        q: 'Can we buy gifts in bulk?',
        a: 'Yes. Enterprise partners buy codes in bulk, import them into the dashboard, and allocate them to employees or clients. Each code is encrypted at rest and only revealed when allocated.',
      },
      {
        q: 'Can we track redemptions?',
        a: 'The enterprise dashboard shows available, allocated, delivered and redeemed codes, plus reports by product and period. You can export the data whenever you need it.',
      },
      {
        q: 'Can the rewards be branded?',
        a: 'We can add a company message to the delivery email and agree a custom catalogue for larger programmes. Talk to our corporate team about what you need.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow mint">Good to know</span>
          <h1>Everything you might ask before your first gift.</h1>
          <p className="lede">
            Sending, claiming, spending and settling — here is how Giftly works on both sides of
            the gift.
          </p>
        </div>
      </section>

      <section className="container narrow section tight">
        <div className="faq-sections">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="faq-heading">{section.title}</h2>
              <div className="faq-list">
                {section.items.map((item) => (
                  <details className="faq-item" key={item.q}>
                    <summary>{item.q}</summary>
                    <div className="answer">{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card mint" style={{ marginTop: 48 }}>
          <span className="icon-tile ink">
            <MessageCircle size={22} />
          </span>
          <h2 style={{ fontSize: '1.7rem', marginTop: 14 }}>Still stuck?</h2>
          <p style={{ marginTop: 8 }}>
            Send us a note and a real person will get back to you, usually the same day.
          </p>
          <div className="btn-row" style={{ marginTop: 18 }}>
            <Link className="btn primary" href="/contact">
              Contact support <ArrowRight size={16} />
            </Link>
            <Link className="btn" href="/vendors">
              Browse vendors
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
