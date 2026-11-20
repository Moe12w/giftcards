// src/lib/recipients.ts
// The customer's saved recipients, read from the database.
import { useCallback, useEffect, useState } from 'react';

import { listRecipients } from './data';
import type { Recipient } from './types';

export function useRecipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setRecipients(await listRecipients());
    } catch {
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // The fetch applies its rows after the await, so mounting never writes
  // state synchronously from the effect body. reload() stays for callers.
  useEffect(() => {
    let active = true;
    listRecipients()
      .then((rows) => {
        if (active) setRecipients(rows);
      })
      .catch(() => {
        if (active) setRecipients([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { recipients, loading, reload };
}
