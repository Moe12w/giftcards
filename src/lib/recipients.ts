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

  useEffect(() => {
    reload();
  }, [reload]);

  return { recipients, loading, reload };
}
