import Link from 'next/link';
import { requireApprovedBusinessBuyer } from '@/lib/auth';
import { signOut } from '@/lib/actions/auth';
import { Logo } from '@/components/Logo';

export default async function BusinessPortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireApprovedBusinessBuyer();

  return (
    <div className="dash-layout">
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <Logo href="/business" />
          <div>
            <p className="small strong">Business / Bulk Buyer</p>
            <p className="small muted">{ctx.account.company_name}</p>
          </div>
        </div>
        <nav className="dash-nav" aria-label="Business portal">
          <Link href="/business">Bulk deals</Link>
          <Link href="/business/orders">Orders & invoices</Link>
          <Link href="/">Public site</Link>
          <Link href="/contact">Support</Link>
        </nav>
        <div style={{ marginTop: 'auto', padding: 16 }}>
          <form action={signOut}>
            <button className="btn sm ghost" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="dash-main">
        <header className="dash-topbar">
          <div>
            <p className="eyebrow lavender">Approved business account</p>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{ctx.account.company_name}</h2>
          </div>
          <div className="btn-row">
            <span className="tag success">Bulk pricing unlocked</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
