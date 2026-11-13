'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { uploadAdvertisingCreativeImage } from '@/lib/actions/advertising';
import { resizeImage } from '@/lib/image';

const COPY = {
  en: {
    choose: 'Choose an image',
    replace: 'Replace',
    upload: 'Save image',
    uploading: 'Saving…',
    preparing: 'Preparing…',
    saved: 'Image uploaded. Save the campaign to use it.',
    error: 'That image could not be uploaded.',
    tooBig: 'That image is too large. Use one under 10 MB.',
    wrongType: 'Choose a PNG, JPEG or WebP image.',
    preview: 'Image preview',
  },
  ar: {
    choose: 'اختر صورة',
    replace: 'استبدال',
    upload: 'حفظ الصورة',
    uploading: 'جارٍ الحفظ…',
    preparing: 'جارٍ التجهيز…',
    saved: 'تم رفع الصورة. احفظ الحملة لاستخدامها.',
    error: 'تعذر رفع الصورة.',
    tooBig: 'الصورة كبيرة جداً. اختر صورة أقل من 10 ميغابايت.',
    wrongType: 'اختر صورة بصيغة PNG أو JPEG أو WebP.',
    preview: 'معاينة الصورة',
  },
};/**
 * Creative image upload for the campaign wizard. Vendors upload a file and the
 * wizard stores the returned public URL on the campaign creative, so campaigns
 * never depend on a hand-written image URL.
 */
export function AdvertisingCreativeImage({
  kind,
  currentUrl,
  locale = 'en',
  onUploaded,
}: {
  kind: 'image' | 'mobile_image';
  currentUrl: string | null;
  locale?: 'en' | 'ar';
  onUploaded: (url: string) => void;
}) {
  const copy = COPY[locale];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'uploading'>('idle');
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const maxWidth = kind === 'image' ? 1600 : 1600;
  const maxHeight = kind === 'image' ? 900 : 900;

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
      const resized = await resizeImage(file, maxWidth, maxHeight);
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
    formData.append('kind', kind);
    formData.append('file', pending, pending.name || `${kind}.jpg`);
    const result = await uploadAdvertisingCreativeImage(formData);
    setStatus('idle');
    if (result?.ok && result.url) {
      setPending(null);
      setPreview(null);
      onUploaded(result.url);
      setMessage({ tone: 'ok', text: copy.saved });
      return;
    }
    setMessage({ tone: 'bad', text: result?.error ?? copy.error });
  }

  const shown = preview ?? currentUrl;

  return (
    <div className="image-upload">
      <div className="image-upload-head">
        <span className="strong">{kind === 'image' ? 'Creative image' : 'Mobile image'}</span>
        <span className="small muted">
          {kind === 'image' ? 'A wide banner, at least 1200 by 600 pixels.' : 'A mobile-friendly banner, same ratio.'}
        </span>
      </div>

      <div className={`image-preview ${kind === 'image' ? 'banner' : 'banner'}`}>
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
          {pending ? copy.replace : copy.choose}
        </button>
        {pending ? (
          <button type="button" className="btn sm primary" onClick={upload} disabled={status !== 'idle'}>
            {status === 'uploading' ? <Loader2 size={14} /> : <Upload size={14} />} {copy.upload}
          </button>
        ) : null}
      </div>

      {message ? (
        <span className={`small ${message.tone === 'bad' ? 'text-danger' : 'text-success'}`}>{message.text}</span>
      ) : null}
    </div>
  );
}
