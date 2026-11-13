'use client';

import { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';

export interface RecipientUploadLabels {
  pasteHere: string;
  uploadFile: string;
  templateHint: string;
  assign: string;
  parsed: string;
  invalid: string;
}

/**
 * Paste a list of people, or upload a CSV file. Each row becomes one gift
 * card: name, email and an optional message.
 */
export function BulkRecipientsUpload({
  action,
  orderId,
  quantity,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  orderId: string;
  quantity: number;
  labels: RecipientUploadLabels;
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setText(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsText(file);
  }

  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const valid = rows.filter((line, index) => {
    const cells = line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const email = (cells[1] ?? '').toLowerCase();
    if (index === 0 && !email.includes('@')) return false;
    return email.includes('@');
  });

  return (
    <form action={action} className="form">
      <input type="hidden" name="order_id" value={orderId} />
      <div className="field">
        <label htmlFor="recipients">{labels.pasteHere}</label>
        <textarea
          id="recipients"
          name="recipients"
          rows={10}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={labels.templateHint}
        />
        <span className="hint">{labels.templateHint}</span>
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
        <button className="btn sm" type="button" onClick={() => fileRef.current?.click()}>
          <FileUp size={15} /> {labels.uploadFile}
        </button>
        {fileName ? <span className="small muted">{fileName}</span> : null}
        {text ? (
          <span className="small muted">
            {labels.parsed.replace('{count}', String(valid.length))}
            {rows.length - valid.length > 0
              ? ` · ${labels.invalid.replace('{count}', String(rows.length - valid.length))}`
              : ''}
          </span>
        ) : null}
      </div>

      <button className="btn primary" type="submit" disabled={valid.length === 0}>
        {labels.assign}
      </button>
      {quantity ? <span className="small muted" style={{ marginInlineStart: 10 }}>({quantity})</span> : null}
    </form>
  );
}
