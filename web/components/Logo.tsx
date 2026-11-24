import Link from 'next/link';

/**
 * The Tazilla lockup: `Ta | Zilla`, drawn as vector artwork in `public/brand`.
 * The light file uses ink for the cream/white surfaces the site is built on;
 * the dark file is white, for ink-coloured surfaces.
 */
export function Logo({
  href = '/',
  label = 'Tazilla',
  tone = 'light',
}: {
  href?: string;
  label?: string;
  tone?: 'light' | 'dark';
}) {
  return (
    <Link href={href} className="logo" aria-label={`${label} home`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG lockup, nothing to optimise */}
      <img
        className="logo-lockup"
        src={tone === 'dark' ? '/brand/tazilla-lockup-dark.svg' : '/brand/tazilla-lockup-light.svg'}
        alt=""
        width={151}
        height={34}
        decoding="async"
      />
    </Link>
  );
}
