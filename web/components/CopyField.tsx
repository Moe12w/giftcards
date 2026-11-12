'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useLocale } from '@/components/I18nProvider';
import { pick } from '@/lib/i18n';
import { componentsCopy } from '@/lib/i18n/components';

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const locale = useLocale();
  const t = pick(componentsCopy, locale).copyField;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="copy-field">
      <input readOnly value={value} aria-label={t.inviteLink} onFocus={(event) => event.currentTarget.select()} />
      <button className="btn sm" type="button" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? t.copied : t.copy}
      </button>
    </div>
  );
}
