import { revalidatePath } from 'next/cache';

/**
 * Public pages are prerendered under /en and /ar, so an admin/vendor change
 * has to invalidate both copies. Keeping this in one place avoids forgetting
 * a locale when a new page is added.
 */
export function revalidatePublicPath(path: string) {
  revalidatePath(`/en${path}`);
  revalidatePath(`/ar${path}`);
}
