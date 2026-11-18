/**
 * Status shown in the admin lists for a business's MyFatoorah supplier.
 *
 * A supplier code is the only proof one exists, but repeated create attempts
 * leave other traces. The claim RPC blocks retries for ten minutes, so a claim
 * older than that with no code is a failed/abandoned attempt, not work in
 * progress.
 */
export function supplierListStatus(supplier: {
  code: string | null;
  status: string | null;
  lastError: string | null;
  claimedAt: string | null;
}): string {
  if (supplier.code) return supplier.status || 'pending';
  if (supplier.lastError) return 'failed';
  if (supplier.claimedAt) {
    const age = Date.now() - new Date(supplier.claimedAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age < 10 * 60 * 1000) return 'in_progress';
    return 'failed';
  }
  return 'not_started';
}
