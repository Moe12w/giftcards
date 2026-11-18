'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { resizeImage } from '@/lib/image';

const COPY = {
  en: {
    choose: 'Choose an image',
    replace: 'Replace',
    upload: 'Save image',
    uploading: 'Saving…',
    preparing: 'Preparing…',
    saved: 'Image uploaded. Save the gift to use it.',
    error: 'That image could not be uploaded.',
    tooBig: 'That image is too large. Use one under 10 MB.',
    wrongType: 'Choose a PNG, JPEG or WebP image.',
    required: 'An image is required.',
  },
  ar: {
    choose: 'اختر صورة',
    replace: 'استبدال',
    upload: 'حفظ الصورة',
    uploading: 'جارٍ الحفظ…',
    preparing: 'جارٍ التجهيز…',
    saved: 'تم رفع الصورة. احفظ الهدية لاستخدامها.',
    error: 'تعذر رفع الصورة.',
    tooBig: 'الصورة كبيرة جداً. اختر صورة أقل من 10 ميغابايت.',
    wrongType: 'اختر صورة بصيغة PNG أو JPEG أو WebP.',
    required: 'الصورة مطلوبة.',
  },
};

/**
 * Uploads a product image and keeps its public URL in a hidden form field, so
 * gift cards never depend on a hand-written image URL. Used by both the vendor
 * and enterprise product forms; the caller supplies the authorized upload
 * action for its own dashboard.
 */
export function ProductImageUpload({
  name = 'image_url',
  uploadAction,
  currentUrl,
  locale = 'en',
  required = true,
}: {
  name?: string;
  uploadAction: (formData: FormData) => Promise<{ ok: boolean; url?: string; error?: string }>;
  currentUrl: string | null;
  locale?: 'en' | 'ar';
  required?: boolean;
}) {
  const copy = COPY[locale];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState<string>(currentUrl ?? '');
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'uploading'>('idle');
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  async function onPick(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ tone: 'bad', text: copy.wrongType });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ tone: 'bad', text: copy.tooBig });
      return;
    }
    setStatus('preparing');
    setMessage(null);
    try {
      const resized = await resizeImage(file, 1200, 1200);
      const blob = new File([resized.blob], file.name, { type: resized.type });
      setPending(blob);
      setPreview(URL.createObjectURL(resized.blob));
      setStatus('idle');
    } catch {
      setStatus('idle');
      setMessage({ tone: 'bad', text: copy.error });
    }
  }

  async function upload() {
    if (!pending) return;
    setStatus('uploading');
    setMessage(null);
    const formData = new FormData();
    formData.append('file', pending, pending.name || 'product.jpg');
    try {
      const result = await uploadAction(formData);
      setStatus('idle');
      if (result?.ok && result.url) {
        setPending(null);
        setPreview(null);
        setUrl(result.url);
        setMessage({ tone: 'ok', text: copy.saved });
        return;
      }
      setMessage({ tone: 'bad', text: result?.error ?? copy.error });
    } catch {
      setStatus('idle');
      setMessage({ tone: 'bad', text: copy.error });
    }
  }

  const shown = preview ?? url;

  return (
    <div className="image-upload">
      <input type="hidden" name={name} value={url} />
      <div className="image-preview">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" />
        ) : (
          <span className="small muted">
            <ImagePlus size={18} style={{ display: 'inline', verticalAlign: '-3px' }} /> {copy.choose}
          </span>
        )}
      </div>

      <div className="btn-row">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="visually-hidden"
          onChange={(event) => {
            void onPick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn sm"
          onClick={() => inputRef.current?.click()}
          disabled={status !== 'idle'}
        >
          {status === 'preparing' ? <Loader2 size={14} /> : <ImagePlus size={14} />}
          {pending || url ? copy.replace : copy.choose}
        </button>
        {pending ? (
          <button type="button" className="btn sm primary" onClick={upload} disabled={status !== 'idle'}>
            {status === 'uploading' ? <Loader2 size={14} /> : <Upload size={14} />} {copy.upload}
          </button>
        ) : null}
      </div>

      {message ? (
        <span className={`small ${message.tone === 'bad' ? 'text-danger' : 'text-success'}`}>{message.text}</span>
      ) : required && !url ? (
        <span className="small text-danger">{copy.required}</span>
      ) : null}
    </div>
  );
}
