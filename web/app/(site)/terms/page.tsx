import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Terms of service' };

export default function TermsPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">Legal</span>
          <h1>Terms of service</h1>
          <p className="lede">Last updated: 11 November 2026</p>
        </div>
      </section>
      <section className="container narrow section tight legal-copy">
        <h2>1. About Giftly</h2>
        <p>
          Giftly is a marketplace that connects customers with independent businesses in Qatar. We
          provide the platform for buying, sending and tracking gift cards and experience
          packages. The goods and services themselves are supplied by the vendor named on the gift.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You must provide accurate details and keep your sign-in credentials secure. You are
          responsible for activity under your account. Vendors and enterprise partners must have
          authority to act for the business they register.
        </p>

        <h2>3. Buying a gift</h2>
        <p>
          Prices are shown in Qatari riyals and include the vendor&apos;s price. Experience gifts
          are sold as fixed packages set by the vendor; monetary gifts can be bought at preset or
          custom amounts within the vendor&apos;s limits. An order is confirmed when payment is
          authorised and the gift is issued.
        </p>

        <h2>4. Delivery and claiming</h2>
        <p>
          Gift links are delivered to the contact details you provide. You are responsible for
          checking those details. A gift can be claimed once, by the first person who signs in and
          opens the link. Unclaimed gifts remain available to the buyer to resend or cancel within
          the cancellation window.
        </p>

        <h2>5. Using a gift</h2>
        <p>
          Monetary gifts keep a balance and can be spent in parts until the balance reaches zero.
          Experience gifts have a set number of sessions. Vendors may require a booking. Expiry
          dates are shown before purchase and on the gift. Gifts cannot be exchanged for cash
          unless required by law.
        </p>

        <h2>6. Vendor obligations</h2>
        <p>
          Vendors must honour valid gifts, keep their offers and opening details accurate, and
          redeem only through the Giftly tools. Vendors are responsible for the services they
          supply and for their own licences and insurance.
        </p>

        <h2>7. Refunds and disputes</h2>
        <p>
          Unclaimed gifts may be cancelled in line with the refund window shown at checkout. Once a
          gift has been claimed, refunds are at the vendor&apos;s discretion except where the law
          requires otherwise. Contact us if a gift cannot be used and we will help resolve it with
          the vendor.
        </p>

        <h2>8. Acceptable use</h2>
        <p>
          Do not use Giftly for fraud, money laundering, resale of gift codes without permission,
          or any unlawful purpose. We may suspend accounts or void gifts where we reasonably
          suspect abuse.
        </p>

        <h2>9. Liability</h2>
        <p>
          We run the marketplace with reasonable care, but we do not control vendor premises or
          services. To the extent permitted by Qatari law, our liability is limited to the value of
          the affected order.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about these terms? Email <a href="mailto:hello@giftly.qa">hello@giftly.qa</a> or
          use the <Link href="/contact">contact form</Link>.
        </p>
      </section>
    </>
  );
}
