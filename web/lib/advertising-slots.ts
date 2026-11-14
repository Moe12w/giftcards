import type { SupabaseClient } from '@supabase/supabase-js';

export interface AdvertisingSlot {
  slot_number: number;
  state: 'free' | 'occupied' | 'reserved';
  occupied_until: string | null;
  next_free_at: string | null;
}

export type AdvertisingSlotMap = Record<string, AdvertisingSlot[]>;

/**
 * Loads the availability of every sellable slot in one round trip.
 *
 * The RPC is security-definer and returns only slot state and times, so an
 * advertiser can see that slot 3 is filled until Thursday without seeing who
 * rented it. A missing RPC or an error simply yields an empty map; the wizard
 * still validates the chosen window when the campaign is saved.
 */
export async function loadAdvertisingSlotMap(supabase: SupabaseClient): Promise<AdvertisingSlotMap> {
  const { data, error } = await supabase.rpc('advertising_slot_map');
  if (error || !data) return {};

  const map: AdvertisingSlotMap = {};
  for (const row of data as Array<Record<string, any>>) {
    const key = String(row.placement_key ?? '');
    if (!key) continue;
    const state = row.state === 'occupied' || row.state === 'reserved' ? row.state : 'free';
    (map[key] ??= []).push({
      slot_number: Number(row.slot_number),
      state,
      occupied_until: row.occupied_until ?? null,
      next_free_at: row.next_free_at ?? null,
    });
  }
  return map;
}
