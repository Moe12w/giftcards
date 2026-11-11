import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container narrow">
          <span className="eyebrow">Legal</span>
          <h1>Privacy policy</h1>
          <p className="lede">Last updated: 11 November 2026</p>
        </div>
      </section>
      <section className="container narrow section tight legal-copy">
        <h2>What we collect</h2>
        <p>
          Account details (name, email, phone), gift and order details, delivery details for the
          recipient, and the information you send us through support forms. Vendors provide business
          details, locations and payout information. Enterprise partners provide company and contact
          details.
        </p>

        <h2>How we use it</h2>
        <p>
          To create and secure your account, issue and deliver gifts, let vendors redeem them,
          calculate settlements, provide support, prevent fraud and meet our legal obligations. We
          also use aggregated, non-identifying information to understand which parts of the
          marketplace are working.
        </p>

        <h2>Who sees what</h2>
        <p>
          Vendors see the details needed to fulfil and redeem a gift, such as the recipient name,
          voucher code and redemption history. Enterprise partners see their own inventory and
          redemption reports. Our team sees what is needed to operate and support the platform.
          We do not sell personal data.
        </p>

        <h2>Payments</h2>
        <p>
          Card payments are processed by our licensed payment provider. Giftly does not store full
          card numbers. Payment references and status are kept so we can reconcile orders and
          refunds.
        </p>

        <h2>Storage and security</h2>
        <p>
          Data is stored with our cloud database provider using encryption in transit and at rest.
          Access is limited by role-based policies. Enterprise codes are stored encrypted and shown
          only when allocated. No system is perfect; if we become aware of a breach that affects
          you, we will tell you.
        </p>

        <h2>Retention</h2>
        <p>
          We keep account and transaction records for as long as needed to provide the service and
          meet accounting and legal requirements. Support messages are kept for two years unless
          they relate to an open dispute.
        </p>

        <h2>Your choices</h2>
        <p>
          You can ask for a copy of your data, correct it, or ask us to close your account. Some
          records must be kept for tax and accounting. Email{' '}
          <a href="mailto:privacy@giftly.qa">privacy@giftly.qa</a> and we will respond within 30
          days.
        </p>

        <h2>Cookies</h2>
        <p>
          The website uses essential cookies to keep you signed in to a dashboard. We do not use
          advertising cookies. You can clear cookies in your browser, but you will need to sign in
          again.
        </p>

        <h2>Contact</h2>
        <p>
          Giftly, Doha, Qatar. Questions? <Link href="/contact">Contact us</Link>.
        </p>
      </section>
    </>
  );
}
