import Link from 'next/link';
import { Gift } from 'lucide-react';

export function Logo({ href = '/', label = 'Giftly' }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="logo" aria-label={`${label} home`}>
      <span className="logo-mark" aria-hidden="true">
        <Gift size={22} strokeWidth={2.4} />
      </span>
      {label}
    </Link>
  );
}
