'use client';

import { useState, type ReactNode } from 'react';
import { Keyboard, ScanLine } from 'lucide-react';
import { RedeemScanner } from '@/components/RedeemScanner';

const COPY = {
  en: { scan: 'Scan the gift', manual: 'Type the code' },
  ar: { scan: 'امسح الهدية', manual: 'اكتب الرمز' },
};

/**
 * The counter screen. Scanning is the first tab because that is how most
 * redemptions happen; typing the code stays one click away.
 */
export function RedeemPanel({
  manual,
  locale = 'en',
}: {
  manual: ReactNode;
  locale?: 'en' | 'ar';
}) {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const copy = COPY[locale];

  return (
    <div>
      <div className="seg-tabs" role="tablist" aria-label="Redemption method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'scan'}
          className={mode === 'scan' ? 'active' : ''}
          onClick={() => setMode('scan')}
        >
          <ScanLine size={15} /> {copy.scan}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={mode === 'manual' ? 'active' : ''}
          onClick={() => setMode('manual')}
        >
          <Keyboard size={15} /> {copy.manual}
        </button>
      </div>

      {mode === 'scan' ? (
        <RedeemScanner locale={locale} />
      ) : (
        <div id="manual" style={{ paddingTop: 18 }}>
          {manual}
        </div>
      )}
    </div>
  );
}
