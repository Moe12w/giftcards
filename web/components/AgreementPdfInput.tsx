'use client';

import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';

/**
 * The native `accept="application/pdf"` file input is unreliable on iOS Safari:
 * tapping it can do nothing. A real button that opens a visually hidden input,
 * with the .pdf extension included in accept, opens the Files picker reliably.
 * The input stays inside the surrounding form so the server action still gets
 * the file under the `file` key.
 */
export function AgreementPdfInput() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        id="file"
        name="file"
        type="file"
        accept=".pdf,application/pdf"
        className="visually-hidden"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
      <div className="btn-row">
        <button type="button" className="btn sm" onClick={() => inputRef.current?.click()}>
          {fileName ? <FileText size={14} /> : <Upload size={14} />}
          {fileName ?? 'Choose agreement PDF'}
        </button>
      </div>
      {fileName ? (
        <span className="small muted">Selected: {fileName}</span>
      ) : (
        <span className="hint">PDF only, up to 5 MB. Publishing a new version deactivates the previous one.</span>
      )}
    </>
  );
}
