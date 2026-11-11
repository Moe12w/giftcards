'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { removeVendorImage, uploadVendorImage } from '@/lib/actions/vendor';
import { formatBytes, resizeImage } from '@/lib/image';

const COPY = {
  en: {
    logo: 'Logo',
    banner: 'Banner',
    choose: 'Choose an image',
    replace: 'Replace',
    remove: 'Remove',
    upload: 'Save image',
    uploading: 'Saving…',
    preparing: 'Preparing…',
    saved: 'Image updated. It is live on the website and in the app.',
    removed: 'Image removed.',
    error: 'That image could not be uploaded.',
    tooBig: 'That image is too large. Use one under 10 MB.',
    wrongType: 'Choose a PNG, JPEG or WebP image.',
    hintLogo: 'A square logo, at least 400 by 400 pixels.',
    hintBanner: 'A wide banner, at least 1400 by 500 pixels.',
    noImage: 'No image yet',
  },
  ar: {
    logo: 'الشعار',
    banner: 'الغلاف',
    choose: 'اختر صورة',
    replace: 'استبدال',
    remove: 'إزالة',
    upload: 'حفظ الصورة',
    uploading: 'جارٍ الحفظ…',
    preparing: 'جارٍ التجهيز…',
    saved: 'تم تحديث الصورة، وهي الآن على الموقع وفي التطبيق.',
    removed: 'تمت إزالة الصورة.',
    error: 'تعذر رفع الصورة.',
    tooBig: 'الصورة كبيرة جداً. اختر صورة أقل من 10 ميغابايت.',
    wrongType: 'اختر صورة بصيغة PNG أو JPEG أو WebP.',
    hintLogo: 'شعار مربع، لا يقل عن 400 في 400 بكسل.',
    hintBanner: 'غلاف عريض، لا يقل عن 1400 في 500 بكسل.',
    noImage: 'لا توجد صورة بعد',
  },
};

export function VendorImageUpload({
  kind,
  currentUrl,
  locale = 'en',
}: {
  kind: 'logo' | 'banner';
  currentUrl: string | null;
  locale?: 'en' | 'ar';
}) {
  const copy = COPY[locale];
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'uploading'>('idle');
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const isLogo = kind === 'logo';
  const maxWidth = isLogo ? 600 : 1600;
  const maxHeight = isLogo ? 600 : 900;

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
    const result = await uploadVendorImage(formData);
    setStatus('idle');
    if (result?.ok) {
      setPending(null);
      setPreview(null);
      setMessage({ tone: 'ok', text: copy.saved });
      router.refresh();
      return;
    }
    setMessage({ tone: 'bad', text: result?.error ?? copy.error });
  }

  async function remove() {
    setStatus('uploading');
    setMessage(null);
    const result = await removeVendorImage(kind);
    setStatus('idle');
    if (result?.ok) {
      setPending(null);
      setPreview(null);
      setMessage({ tone: 'ok', text: copy.removed });
      router.refresh();
      return;
    }
    setMessage({ tone: 'bad', text: result?.error ?? copy.error });
  }

  const shown = preview ?? currentUrl;

  return (
    <div className="image-upload">
      <div className="image-upload-head">
        <span className="strong">{isLogo ? copy.logo : copy.banner}</span>
        <span className="small muted">{isLogo ? copy.hintLogo : copy.hintBanner}</span>
      </div>

      <div className={`image-preview ${isLogo ? 'logo' : 'banner'}`}>
        {shown ? (
          <img src={shown} alt="" />
        ) : (
          <span className="small muted">
            <ImagePlus size={18} style={{ display: 'inline', verticalAlign: '-3px' }} /> {copy.noImage}
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
          {status === 'preparing' ? (
            <Loader2 size={14} />
          ) : (
            <Upload size={14} />
          )}
          {pending ? copy.replace : copy.choose}
        </button>
        {pending ? (
          <button type="button" className="btn sm primary" onClick={upload} disabled={status !== 'idle'}>
            {status === 'uploading' ? <Loader2 size={14} /> : <Upload size={14} />} {copy.upload}
          </button>
        ) : null}
        {currentUrl ? (
          <button type="button" className="btn sm ghost" onClick={remove} disabled={status !== 'idle'}>
            <Trash2 size={14} /> {copy.remove}
          </button>
        ) : null}
      </div>

      {message ? (
        <span className={`small ${message.tone === 'bad' ? 'text-danger' : 'text-success'}`}>
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
