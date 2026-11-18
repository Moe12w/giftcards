// web/lib/pagination.ts
// Server-side paging for the dashboard tables.
//
// Every list page reads `?page=` from the URL, turns it into a PostgREST
// `.range()` window, and asks for the total row count so the pager knows how
// many pages exist. One page of rows is fetched per request, never the whole
// table.

/** Rows per page in the admin and vendor dashboards. */
export const PAGE_SIZE = 25;

/** Reads `?page=`, clamping anything invalid back to the first page. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** The inclusive range PostgREST expects for a page. */
export function pageBounds(page: number, pageSize = PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** How many pages a result set needs; always at least one. */
export function pageCount(total: number | null | undefined, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil((total ?? 0) / pageSize));
}
