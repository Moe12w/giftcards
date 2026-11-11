'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

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
      <input readOnly value={value} aria-label="Invite link" onFocus={(event) => event.currentTarget.select()} />
      <button className="btn sm" type="button" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
