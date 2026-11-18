// web/components/Pager.tsx
// The page control under a dashboard table.
//
// It is a server component: the links carry the current filters plus the page
// number, so changing page never drops a search or status filter, and no
// client JavaScript is needed.
import Link from 'next/link';

import { common } from '@/lib/i18n/common';
import { fill, pick } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { pageCount } from '@/lib/pagination';

export async function Pager({
  page,
  total,
  basePath,
  params,
}: {
  page: number;
  total: number;
  basePath: string;
  /** Current filters, carried into every page link. */
  params?: Record<string, string | undefined>;
}) {
  const pages = pageCount(total);
  if (pages <= 1) return null;

  const locale = await getLocale();
  const copy = pick(common, locale).pagination;
  const current = Math.min(Math.max(page, 1), pages);

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set('page', String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav className="pager" aria-label={fill(copy.pageOf, { page: current, total: pages })}>
      {current > 1 ? (
        <Link className="btn sm ghost" href={href(current - 1)} rel="prev">
          {copy.previous}
        </Link>
      ) : (
        <span className="btn sm ghost" aria-disabled="true">
          {copy.previous}
        </span>
      )}
      <span className="small muted">{fill(copy.pageOf, { page: current, total: pages })}</span>
      {current < pages ? (
        <Link className="btn sm ghost" href={href(current + 1)} rel="next">
          {copy.next}
        </Link>
      ) : (
        <span className="btn sm ghost" aria-disabled="true">
          {copy.next}
        </span>
      )}
    </nav>
  );
}
