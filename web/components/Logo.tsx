import Link from 'next/link';

/**
 * The Marajukoo mark: a gift card with an M drawn as a ribbon, plus a gold
 * sparkle. Drawn inline so it stays crisp at every size and inherits the
 * sticker treatment (ink border, hard shadow) from `.logo-mark`.
 */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="1.6"
        y="6.4"
        width="28.8"
        height="21.2"
        rx="5.4"
        fill="#ffffff"
        stroke="#1c1c1c"
        strokeWidth="2.4"
      />
      <path
        d="M9.4 22.6V13.1c0-.9 1-1.3 1.6-.6l5 5.7 5-5.7c.6-.7 1.6-.3 1.6.6v9.5"
        stroke="#1c1c1c"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="9.2" r="1.8" fill="#f2b233" stroke="#1c1c1c" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ href = '/', label = 'Marajukoo' }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="logo" aria-label={`${label} home`}>
      <span className="logo-mark">
        <LogoMark />
      </span>
      <span className="logo-label">{label}</span>
    </Link>
  );
}
