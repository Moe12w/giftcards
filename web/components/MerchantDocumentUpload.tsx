'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { removeMerchantDocument, uploadMerchantDocument } from '@/lib/actions/merchant';
import { DOCUMENT_MAX_BYTES } from '@/lib/merchant';

export interface UploadedDocument {
  id: string;
  file_name: string;
  status: string;
  rejection_reason: string | null;
}

export interface UploadCopy {
  upload: string;
  replace: string;
  remove: string;
  preview: string;
  uploading: string;
  saved: string;
  failed: string;
  tooLarge: string;
  formats: string;
}

const STATUS_TONE: Record<string, string> = {
  approved: 'success',
  rejected: 'danger',
  replacement_required: 'danger',
  pending_review: 'warning',
};

/**
 * One document slot. Uploads immediately so a merchant can stop halfway through
 * the application and come back later without losing anything.
 */
export function MerchantDocumentUpload({
  applicationId,
  docType,
  label,
  hint,
  accept,
  document,
  copy,
}: {
  applicationId: string;
  docType: string;
  label: string;
  hint: string;
  accept: string;
  document: UploadedDocument | null;
  copy: UploadCopy;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage(null);

    if (file.size > DOCUMENT_MAX_BYTES) {
      setMessage({ tone: 'bad', text: copy.tooLarge });
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('application_id', applicationId);
    formData.append('doc_type', docType);
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadMerchantDocument(formData);
      if (result?.ok) {
        setMessage({ tone: 'ok', text: copy.saved });
        router.refresh();
      } else {
        setMessage({ tone: 'bad', text: result?.error ?? copy.failed });
      }
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  return (
    <div className="panel" style={{ padding: 16, display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <strong>{label}</strong>
          <div className="small muted" style={{ marginTop: 4 }}>{hint}</div>
        </div>
        {document ? (
          <span className={`tag ${STATUS_TONE[document.status] ?? 'neutral'}`}>
            {document.status.replace(/_/g, ' ')}
          </span>
        ) : (
          <span className="tag neutral">—</span>
        )}
      </div>

      {document ? (
        <div className="callout" style={{ display: 'grid', gap: 8 }}>
          <span className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FileText size={15} /> {document.file_name}
          </span>
          {document.rejection_reason ? (
            <span className="small" style={{ color: 'var(--danger)' }}>
              {document.rejection_reason}
            </span>
          ) : null}
          <div className="btn-row">
            <a className="btn sm ghost" href={`/api/merchant-documents/${document.id}`} target="_blank" rel="noreferrer">
              {copy.preview}
            </a>
            <button className="btn sm" type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
              <RefreshCw size={14} /> {copy.replace}
            </button>
            <form action={removeMerchantDocument}>
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="document_id" value={document.id} />
              <button className="btn sm ghost" type="submit">
                <Trash2 size={14} /> {copy.remove}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="btn-row">
          <button className="btn sm primary" type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
            {pending ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}{' '}
            {pending ? copy.uploading : copy.upload}
          </button>
          <span className="small muted">{copy.formats}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={onChange}
        aria-label={label}
      />

      {message ? (
        <span className="small" style={{ color: message.tone === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
          {message.tone === 'ok' ? <CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> : null}{' '}
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
