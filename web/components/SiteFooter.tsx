import Link from 'next/link';
import { Logo } from '@/components/Logo';

const columns = [
  {
    title: 'Marketplace',
    links: [
      { href: '/vendors', label: 'Browse vendors' },
      { href: '/download', label: 'Get the app' },
      { href: '/faq', label: 'How it works' },
      { href: '/corporate', label: 'Corporate gifting' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/contact', label: 'Contact us' },
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
    ],
  },
  {
    title: 'Partners',
    links: [
      { href: '/vendor/login', label: 'Vendor dashboard' },
      { href: '/enterprise/login', label: 'Enterprise dashboard' },
      { href: '/admin/login', label: 'Admin' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="inner">
          <div>
            <Logo />
            <p className="small" style={{ marginTop: 14, maxWidth: 300 }}>
              Gift cards, experiences and corporate rewards from the best independent
              businesses in Qatar. One app, three ways to give.
            </p>
            <p className="small" style={{ marginTop: 14 }}>
              Doha, Qatar · hello@giftly.qa
            </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h4>{column.title}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Giftly. All rights reserved.</span>
          <span>Made for Qatar · English & العربية</span>
        </div>
      </div>
    </footer>
  );
}
