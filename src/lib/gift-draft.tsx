// src/lib/gift-draft.tsx
// Shared state for the multi-step gift journey. Persisted so switching tabs or
// closing a screen does not lose the customer's progress.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_COVER_ID } from './gift-covers';
import type { Recipient } from './types';

export type DeliveryMethod = 'email' | 'sms' | 'link' | 'whatsapp';

export interface CardBackAttachment {
  id: string;
  type: 'photo' | 'gif' | 'video' | 'audio';
  uri?: string;
  url?: string;
  durationMs?: number;
  mimeType?: string;
}

/** One item pinned to the back of a gift card. */
export interface CardBackMedia {
  id: string;
  type: 'note' | 'photo' | 'gif' | 'video' | 'audio';
  /** Local file URI on device, remote URL once uploaded. Not used for notes. */
  uri?: string;
  /** Writing on a note paper. */
  text?: string;
  url?: string;
  durationMs?: number;
  mimeType?: string;
  /** Media attached to a note paper. */
  attachments?: CardBackAttachment[];
}

/**
 * What the sender pinned onto the card: a picture, GIF, video or voice note
 * from the phone, or one sticker from the sheet. `uri` is the local file while
 * the draft is on the device; `url` is set once checkout uploads the file to
 * storage. Null means the plain designed cover is sent.
 */
export type GiftMedia =
  | { type: 'photo'; uri: string; url?: string }
  | { type: 'gif'; uri: string; url?: string }
  | { type: 'video'; uri: string; url?: string; durationMs?: number }
  | { type: 'audio'; uri: string; url?: string; durationMs?: number }
  | { type: 'sticker'; stickerId: string };

export interface GiftDraft {
  offerId: string | null;
  /** Vendor package chosen for an experience gift. Null for money cards. */
  variantId: string | null;
  amountMinor: number;
  design: string;
  recipient: Recipient | null;
  deliveryMethod: DeliveryMethod;
  deliveryDate: string | null;
  message: string;
  /** Card cover id from `src/lib/gift-covers.ts`. */
  cover: string;
  media: GiftMedia | null;
  /** Collection of items on the back of the card (message is separate). */
  cardBackItems: CardBackMedia[];
  /** Media attached to the main message note. */
  mainAttachments: CardBackAttachment[];
  theme: string;
  wrapping: string;
  /** Basket code when joining an existing gift basket. */
  basketCode: string | null;
}

const STORAGE_KEY = 'tazella.gift-draft';

export const EMPTY_DRAFT: GiftDraft = {
  offerId: null,
  variantId: null,
  amountMinor: 0,
  design: 'classic',
  recipient: null,
  deliveryMethod: 'email',
  deliveryDate: null,
  message: '',
  cover: DEFAULT_COVER_ID,
  media: null,
  cardBackItems: [],
  mainAttachments: [],
  theme: 'confetti',
  wrapping: 'ribbon',
  basketCode: null,
};

interface GiftDraftContextValue {
  draft: GiftDraft;
  ready: boolean;
  update: (patch: Partial<GiftDraft>) => void;
  reset: () => void;
}

const GiftDraftContext = createContext<GiftDraftContextValue | null>(null);

export function GiftDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<GiftDraft>(EMPTY_DRAFT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (active && raw) {
          try {
            setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<GiftDraft>) });
          } catch {
            // Ignore a corrupt draft and start fresh.
          }
        }
      })
      .catch(() => undefined)
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => undefined);
  }, [draft, ready]);

  const update = useCallback((patch: Partial<GiftDraft>) => {
    setDraft((prev) => {
      // Ignore a patch that would not change anything. Screens often sync the
      // same offer into the draft from an effect; returning the previous object
      // lets React bail out instead of rendering again.
      const changed = (Object.keys(patch) as (keyof GiftDraft)[]).some(
        (key) => !Object.is(prev[key], patch[key]),
      );
      return changed ? { ...prev, ...patch } : prev;
    });
  }, []);

  const reset = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ draft, ready, update, reset }), [draft, ready, update, reset]);

  return <GiftDraftContext.Provider value={value}>{children}</GiftDraftContext.Provider>;
}

export function useGiftDraft(): GiftDraftContextValue {
  const value = useContext(GiftDraftContext);
  if (!value) {
    throw new Error('useGiftDraft must be used inside GiftDraftProvider');
  }
  return value;
}
