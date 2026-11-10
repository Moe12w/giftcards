// src/lib/baskets.tsx
// Collaborative gift baskets. In demo mode the store persists to AsyncStorage
// and simulates live contributions so the experience can be explored in Expo Go.
// The same actions map cleanly onto the Supabase tables in
// supabase/migrations/0008_gift_baskets.sql when credentials are configured.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from './auth';
import { MOCK_BASKETS, MOCK_OFFERS } from './mock-data';
import type {
  AccentTone,
  BasketActivity,
  BasketItem,
  BasketParticipant,
  GiftBasket,
  OccasionId,
  Offer,
} from './types';

const STORAGE_KEY = 'giftly.baskets.v1';

const PARTICIPANT_TONES: BasketParticipant['tone'][] = ['teal', 'pink', 'lavender', 'gold'];
const FRIEND_NAMES = ['Sara', 'Ahmed', 'Layla', 'Noor', 'Omar', 'Mariam', 'Faris', 'Hind'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function makeCode(): string {
  let body = '';
  for (let i = 0; i < 5; i += 1) {
    body += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `GIFT-${body}`;
}

function displayName(user: ReturnType<typeof useAuth>['user']): string {
  const full = (user?.user_metadata?.full_name as string | undefined)?.trim();
  if (full) return full;
  if (user?.email) return user.email.split('@')[0];
  return 'Demo User';
}

export interface BasketItemInput {
  offer: Offer;
  amountMinor: number;
}

export interface CreateBasketInput {
  name: string;
  recipientName: string;
  occasion: OccasionId;
  targetMinor?: number;
  items: BasketItemInput[];
  note?: string;
}

interface BasketContextValue {
  baskets: GiftBasket[];
  ready: boolean;
  activeBasket: GiftBasket | null;
  completedBaskets: GiftBasket[];
  getBasket: (id: string) => GiftBasket | null;
  getBasketByCode: (code: string) => GiftBasket | null;
  createBasket: (input: CreateBasketInput) => GiftBasket;
  addItem: (basketId: string, input: BasketItemInput) => BasketItem | null;
  removeItem: (basketId: string, itemId: string) => void;
  joinBasket: (code: string) => GiftBasket | null;
  markReady: (basketId: string) => void;
  markCompleted: (basketId: string) => void;
  sendBasket: (
    basketId: string,
    details: { recipientName?: string; message?: string },
  ) => void;
  simulateContribution: (basketId: string) => BasketItem | null;
  resetDemo: () => void;
}

const BasketContext = createContext<BasketContextValue | null>(null);

export function basketTotal(basket: GiftBasket): number {
  return basket.items.reduce((sum, item) => sum + item.amount_minor, 0);
}

export function participantTotals(basket: GiftBasket): Record<string, number> {
  return basket.items.reduce<Record<string, number>>((totals, item) => {
    totals[item.added_by_id] = (totals[item.added_by_id] ?? 0) + item.amount_minor;
    return totals;
  }, {});
}

export function basketProgress(basket: GiftBasket): number {
  if (!basket.target_minor) return 0;
  return Math.min(100, Math.round((basketTotal(basket) / basket.target_minor) * 100));
}

function toBasketItem(
  offer: Offer,
  amountMinor: number,
  participant: { id: string; name: string },
): BasketItem {
  return {
    id: makeId('bitem'),
    offer_id: offer.id,
    vendor_id: offer.vendor_id,
    vendor_name: offer.vendor?.name ?? offer.title,
    title: offer.title,
    amount_minor: amountMinor,
    icon: offer.icon,
    tone: (offer.tone ?? 'lavender') as AccentTone,
    logo_url: offer.vendor?.logo_url ?? null,
    banner_url: offer.vendor?.banner_url ?? null,
    added_by_id: participant.id,
    added_by_name: participant.name,
    added_at: new Date().toISOString(),
  };
}

function activity(
  kind: BasketActivity['kind'],
  actorName: string,
  extra: Partial<BasketActivity> = {},
): BasketActivity {
  return {
    id: makeId('activity'),
    kind,
    actor_name: actorName,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [baskets, setBaskets] = useState<GiftBasket[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as GiftBasket[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setBaskets(parsed);
              return;
            }
          } catch {
            // Fall through to the seeded demo baskets.
          }
        }
        setBaskets(MOCK_BASKETS);
      })
      .catch(() => active && setBaskets(MOCK_BASKETS))
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(baskets)).catch(() => undefined);
  }, [baskets, ready]);

  const getBasket = useCallback(
    (id: string) => baskets.find((basket) => basket.id === id) ?? null,
    [baskets],
  );

  const getBasketByCode = useCallback(
    (code: string) =>
      baskets.find((basket) => basket.code.toUpperCase() === code.trim().toUpperCase()) ?? null,
    [baskets],
  );

  const createBasket = useCallback(
    (input: CreateBasketInput) => {
      const now = new Date().toISOString();
      const ownerId = user?.id ?? 'demo-user';
      const ownerName = displayName(user);
      const owner: BasketParticipant = {
        id: ownerId,
        name: ownerName,
        is_owner: true,
        joined_at: now,
        tone: 'teal',
      };
      const items = input.items.map(({ offer, amountMinor }) => toBasketItem(offer, amountMinor, owner));
      const basket: GiftBasket = {
        id: makeId('basket'),
        code: makeCode(),
        name: input.name.trim() || input.recipientName.trim() || 'Group gift',
        recipient_name: input.recipientName.trim(),
        occasion: input.occasion,
        creator_id: ownerId,
        creator_name: ownerName,
        target_minor: input.targetMinor ?? 0,
        status: 'open',
        items,
        participants: [owner],
        activity: [
          activity('created', ownerName),
          ...items.map((item) =>
            activity('item_added', ownerName, {
              item_title: item.title,
              amount_minor: item.amount_minor,
            }),
          ),
        ],
        created_at: now,
        completed_at: null,
        note: input.note,
      };
      setBaskets((prev) => [basket, ...prev]);
      return basket;
    },
    [user],
  );

  const addItem = useCallback(
    (basketId: string, input: BasketItemInput) => {
      const basket = baskets.find((candidate) => candidate.id === basketId);
      if (!basket || basket.status === 'completed') return null;

      const ownerId = user?.id ?? 'demo-user';
      const ownerName = displayName(user);
      const participant =
        basket.participants.find((p) => p.id === ownerId) ??
        ({
          id: ownerId,
          name: ownerName,
          is_owner: basket.creator_id === ownerId,
          joined_at: new Date().toISOString(),
          tone: 'teal',
        } satisfies BasketParticipant);
      const item = toBasketItem(input.offer, input.amountMinor, participant);

      setBaskets((prev) =>
        prev.map((candidate) => {
          if (candidate.id !== basketId) return candidate;
          const participants = candidate.participants.some((p) => p.id === participant.id)
            ? candidate.participants
            : [...candidate.participants, participant];
          return {
            ...candidate,
            status: candidate.status === 'ready' ? 'open' : candidate.status,
            items: [...candidate.items, item],
            participants,
            activity: [
              activity('item_added', participant.name, {
                item_title: item.title,
                amount_minor: item.amount_minor,
              }),
              ...candidate.activity,
            ],
          };
        }),
      );
      return item;
    },
    [baskets, user],
  );

  const removeItem = useCallback((basketId: string, itemId: string) => {
    setBaskets((prev) =>
      prev.map((basket) =>
        basket.id === basketId
          ? { ...basket, items: basket.items.filter((item) => item.id !== itemId) }
          : basket,
      ),
    );
  }, []);

  const joinBasket = useCallback(
    (code: string) => {
      const match = baskets.find(
        (basket) => basket.code.toUpperCase() === code.trim().toUpperCase(),
      );
      if (!match) return null;

      const userId = user?.id ?? 'demo-user';
      const name = displayName(user);
      if (match.participants.some((participant) => participant.id === userId)) {
        return match;
      }

      const participant: BasketParticipant = {
        id: userId,
        name,
        is_owner: false,
        joined_at: new Date().toISOString(),
        tone: PARTICIPANT_TONES[match.participants.length % PARTICIPANT_TONES.length],
      };
      const joined: GiftBasket = {
        ...match,
        participants: [...match.participants, participant],
        activity: [activity('joined', name), ...match.activity],
      };
      setBaskets((prev) => prev.map((basket) => (basket.id === match.id ? joined : basket)));
      return joined;
    },
    [baskets, user],
  );

  const markReady = useCallback((basketId: string) => {
    setBaskets((prev) =>
      prev.map((basket) =>
        basket.id === basketId && basket.status !== 'completed'
          ? {
              ...basket,
              status: 'ready',
              activity: [activity('ready', basket.creator_name), ...basket.activity],
            }
          : basket,
      ),
    );
  }, []);

  const markCompleted = useCallback((basketId: string) => {
    setBaskets((prev) =>
      prev.map((basket) =>
        basket.id === basketId
          ? {
              ...basket,
              status: 'completed',
              completed_at: new Date().toISOString(),
              activity: [activity('completed', basket.creator_name), ...basket.activity],
            }
          : basket,
      ),
    );
  }, []);

  const sendBasket = useCallback(
    (basketId: string, details: { recipientName?: string; message?: string }) => {
      setBaskets((prev) =>
        prev.map((basket) => {
          if (basket.id !== basketId || basket.status === 'completed') return basket;
          return {
            ...basket,
            status: 'completed',
            completed_at: new Date().toISOString(),
            recipient_name: details.recipientName?.trim() || basket.recipient_name,
            note: details.message?.trim() || basket.note,
            activity: [activity('completed', basket.creator_name), ...basket.activity],
          };
        }),
      );
    },
    [],
  );

  const simulateContribution = useCallback(
    (basketId: string) => {
      const basket = baskets.find((candidate) => candidate.id === basketId);
      if (!basket || basket.status !== 'open') return null;

      const usedNames = new Set(basket.participants.map((p) => p.name));
      const friendName =
        FRIEND_NAMES.find((name) => !usedNames.has(name)) ??
        FRIEND_NAMES[Math.floor(Math.random() * FRIEND_NAMES.length)];

      const usedOffers = new Set(basket.items.map((item) => item.offer_id));
      const pool = MOCK_OFFERS.filter((offer) => !usedOffers.has(offer.id));
      const source = pool.length > 0 ? pool : MOCK_OFFERS;
      const offer = source[Math.floor(Math.random() * source.length)];
      const amountMinor = offer.preset_amounts_minor[0] ?? offer.min_amount_minor;

      const existing = basket.participants.find((p) => p.name === friendName);
      const participant: BasketParticipant =
        existing ??
        ({
          id: makeId('participant'),
          name: friendName,
          is_owner: false,
          joined_at: new Date().toISOString(),
          tone: PARTICIPANT_TONES[basket.participants.length % PARTICIPANT_TONES.length],
        } satisfies BasketParticipant);

      const item = toBasketItem(offer, amountMinor, participant);

      setBaskets((prev) =>
        prev.map((candidate) => {
          if (candidate.id !== basketId) return candidate;
          const participants = existing
            ? candidate.participants
            : [...candidate.participants, participant];
          return {
            ...candidate,
            items: [...candidate.items, item],
            participants,
            activity: [
              activity('item_added', friendName, {
                item_title: item.title,
                amount_minor: item.amount_minor,
              }),
              ...(existing ? [] : [activity('joined', friendName)]),
              ...candidate.activity,
            ],
          };
        }),
      );
      return item;
    },
    [baskets],
  );

  const resetDemo = useCallback(() => {
    setBaskets(MOCK_BASKETS);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
  }, []);

  const activeBasket = useMemo(() => {
    const open = baskets.find((basket) => basket.status === 'open');
    if (open) return open;
    return baskets.find((basket) => basket.status === 'ready') ?? null;
  }, [baskets]);

  const completedBaskets = useMemo(
    () => baskets.filter((basket) => basket.status === 'completed'),
    [baskets],
  );

  const value = useMemo<BasketContextValue>(
    () => ({
      baskets,
      ready,
      activeBasket,
      completedBaskets,
      getBasket,
      getBasketByCode,
      createBasket,
      addItem,
      removeItem,
      joinBasket,
      markReady,
      markCompleted,
      sendBasket,
      simulateContribution,
      resetDemo,
    }),
    [
      baskets,
      ready,
      activeBasket,
      completedBaskets,
      getBasket,
      getBasketByCode,
      createBasket,
      addItem,
      removeItem,
      joinBasket,
      markReady,
      markCompleted,
      sendBasket,
      simulateContribution,
      resetDemo,
    ],
  );

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBaskets(): BasketContextValue {
  const value = useContext(BasketContext);
  if (!value) throw new Error('useBaskets must be used inside BasketProvider');
  return value;
}
