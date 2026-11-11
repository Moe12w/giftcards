'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Flashlight,
  FlipHorizontal,
  Keyboard,
  Loader2,
  ScanLine,
  TriangleAlert,
} from 'lucide-react';
import {
  lookupScannedVoucher,
  redeemScannedVoucher,
  type ScanLookupResult,
} from '@/lib/actions/vendor';
import { formatMoney } from '@/lib/money';

const COPY = {
  en: {
    scanTitle: 'Scan the gift',
    scanBody: 'Ask the customer to open the app, or their wallet pass, and hold it up to this camera.',
    start: 'Start the camera',
    stop: 'Stop the camera',
    torch: 'Torch',
    flip: 'Flip camera',
    typeInstead: 'Type the code instead',
    cameraDenied: 'The camera could not be started.',
    cameraHint:
      'Allow camera access in your browser, or type the code instead. The camera needs a secure connection (https) outside localhost.',
    unsupported: 'This browser cannot open a camera here.',
    looking: 'Looking for a code…',
    found: 'Code found',
    giftFor: 'Gift for',
    balance: 'Balance left',
    sessionsLeft: 'Sessions left',
    amount: 'Amount to redeem (QAR)',
    sessionCount: 'Sessions to redeem',
    notes: 'Note (optional)',
    record: 'Record redemption',
    scanning: 'Scanning…',
    scanAnother: 'Scan another',
    reference: 'Reference',
    remaining: 'Remaining value',
    sessionsRemaining: 'Sessions remaining',
    done: 'Redemption recorded',
    scanPrompt: 'Point the camera at the QR code on the customer’s screen.',
    pasteTitle: 'Or paste the code',
    pastePlaceholder: 'GFT-XXXX-XXXX',
    pasteHint: 'Paste a code from a message, a receipt or a printed gift card.',
    lookUp: 'Look up',
  },
  ar: {
    scanTitle: 'امسح الهدية',
    scanBody: 'اطلب من العميل فتح التطبيق أو بطاقة المحفظة وإظهارها أمام الكاميرا.',
    start: 'تشغيل الكاميرا',
    stop: 'إيقاف الكاميرا',
    torch: 'الكشّاف',
    flip: 'تبديل الكاميرا',
    typeInstead: 'اكتب الرمز بدلاً من ذلك',
    cameraDenied: 'تعذر تشغيل الكاميرا.',
    cameraHint:
      'اسمح بالوصول إلى الكاميرا في المتصفح، أو اكتب الرمز بدلاً من ذلك. تحتاج الكاميرا إلى اتصال آمن (https) خارج localhost.',
    unsupported: 'هذا المتصفح لا يستطيع فتح الكاميرا هنا.',
    looking: 'نبحث عن رمز…',
    found: 'تم العثور على الرمز',
    giftFor: 'هدية لـ',
    balance: 'الرصيد المتبقي',
    sessionsLeft: 'الجلسات المتبقية',
    amount: 'المبلغ المطلوب استبداله (ر.ق)',
    sessionCount: 'عدد الجلسات',
    notes: 'ملاحظة (اختياري)',
    record: 'تسجيل الاستبدال',
    scanning: 'جارٍ المسح…',
    scanAnother: 'امسح بطاقة أخرى',
    reference: 'المرجع',
    remaining: 'القيمة المتبقية',
    sessionsRemaining: 'الجلسات المتبقية',
    done: 'تم تسجيل الاستبدال',
    scanPrompt: 'وجّه الكاميرا نحو رمز QR على شاشة العميل.',
    pasteTitle: 'أو الصق الرمز',
    pastePlaceholder: 'GFT-XXXX-XXXX',
    pasteHint: 'الصق رمزاً من رسالة أو إيصال أو بطاقة هدية مطبوعة.',
    lookUp: 'بحث',
  },
};

type CameraState = 'idle' | 'starting' | 'scanning' | 'blocked' | 'unsupported';

export function RedeemScanner({ locale = 'en' }: { locale?: 'en' | 'ar' }) {
  const copy = COPY[locale];
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pasteRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<{ stop: () => void; switchTorch?: (on: boolean) => void; switchCamera?: () => void } | null>(
    null,
  );
  const startedRef = useRef(false);

  const [camera, setCamera] = useState<CameraState>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [payload, setPayload] = useState<string | null>(null);
  const [lookup, setLookup] = useState<ScanLookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const [pasted, setPasted] = useState('');
  const [amount, setAmount] = useState('');
  const [sessions, setSessions] = useState('1');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ScanLookupResult | null>(null);

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* the camera is already gone */
    }
    controlsRef.current = null;
    startedRef.current = false;
    setCamera('idle');
    setTorchOn(false);
  }, []);

  const handleScan = useCallback(async (text: string) => {
    setPayload(text);
    setLooking(true);
    setDone(null);
    const result = await lookupScannedVoucher(text);
    setLookup(result);
    setLooking(false);
    if (result.ok && result.voucher) {
      if (result.voucher.fulfilmentType === 'monetary') {
        setAmount(((result.voucher.remainingValueMinor ?? 0) / 100).toFixed(2));
        setSessions('1');
      } else {
        setAmount('');
        setSessions(String(Math.max(1, result.voucher.remainingSessions ?? 1)));
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (startedRef.current) return;
    setCameraError(null);
    setCamera('starting');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        },
        videoRef.current ?? undefined,
        (result) => {
          if (!result) return;
          const text = result.getText();
          if (!text) return;
          try {
            controlsRef.current?.stop();
          } catch {
            /* ignore */
          }
          controlsRef.current = null;
          startedRef.current = false;
          setCamera('idle');
          void handleScan(text);
        },
      );
      controlsRef.current = controls as unknown as typeof controlsRef.current;
      startedRef.current = true;
      setCamera('scanning');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const unsupported =
        message.toLowerCase().includes('notsupported') ||
        message.toLowerCase().includes('not implemented') ||
        typeof navigator !== 'undefined' &&
          !navigator.mediaDevices?.getUserMedia;
      setCamera(unsupported ? 'unsupported' : 'blocked');
      setCameraError(message);
    }
  }, [handleScan]);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  // A handheld scanner types the code and presses enter, so keep the field
  // ready when the camera is not running.
  useEffect(() => {
    if (camera === 'idle') pasteRef.current?.focus();
  }, [camera]);

  const reset = () => {
    setPayload(null);
    setLookup(null);
    setDone(null);
    setLooking(false);
    setAmount('');
    setSessions('1');
    setNotes('');
    setCameraError(null);
  };

  async function record() {
    if (!payload) return;
    setBusy(true);
    const result = await redeemScannedVoucher({
      payload,
      amount: amount.trim() || null,
      sessions: sessions.trim() || null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (result.ok) {
      setDone(result);
      setLookup(null);
    } else {
      setLookup(result);
    }
  }

  const voucher = lookup?.ok ? lookup.voucher : undefined;

  if (done?.ok) {
    return (
      <div className="scan-result">
        <div className="scan-result-head">
          <span className="icon-tile mint">
            <CheckCircle2 size={20} />
          </span>
          <div>
            <h3>{copy.done}</h3>
            <span className="small muted">{done.voucher?.title}</span>
          </div>
        </div>
        <div className="split-list" style={{ marginTop: 14 }}>
          <div>
            <span className="k">{copy.reference}</span>
            <span className="v mono">{done.reference ?? '—'}</span>
          </div>
          <div>
            <span className="k">{copy.remaining}</span>
            <span className="v">
              {done.remaining !== undefined ? formatMoney(done.remaining) : '—'}
            </span>
          </div>
          <div>
            <span className="k">{copy.sessionsRemaining}</span>
            <span className="v">{done.sessions ?? '—'}</span>
          </div>
        </div>
        <button className="btn primary" type="button" onClick={reset} style={{ marginTop: 16 }}>
          <ScanLine size={16} /> {copy.scanAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="scan-wrap">
      <div className="scan-stage">
        <video ref={videoRef} className="scan-video" muted playsInline />
        {camera !== 'scanning' ? (
          <div className="scan-placeholder">
            <span className="icon-tile lavender">
              <Camera size={22} />
            </span>
            <p className="small muted" style={{ maxWidth: 320, textAlign: 'center' }}>
              {copy.scanBody}
            </p>
            {camera === 'starting' ? (
              <span className="small muted">
                <Loader2 size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                {copy.scanning}
              </span>
            ) : null}
            {camera === 'blocked' || camera === 'unsupported' ? (
              <div className="callout error" style={{ textAlign: 'left' }}>
                <strong>
                  <TriangleAlert size={14} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                  {copy.cameraDenied}
                </strong>
                <span className="small" style={{ display: 'block', marginTop: 4 }}>
                  {copy.cameraHint}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="scan-reticle" aria-hidden="true">
            <span />
          </div>
        )}
      </div>

      <div className="scan-controls">
        {camera === 'scanning' ? (
          <>
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                try {
                  controlsRef.current?.switchTorch?.(!torchOn);
                  setTorchOn((value) => !value);
                } catch {
                  /* no torch on this camera */
                }
              }}
            >
              <Flashlight size={15} /> {copy.torch}
            </button>
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                try {
                  controlsRef.current?.switchCamera?.();
                } catch {
                  /* only one camera */
                }
              }}
            >
              <FlipHorizontal size={15} /> {copy.flip}
            </button>
            <button className="btn sm ghost" type="button" onClick={stopCamera}>
              <CameraOff size={15} /> {copy.stop}
            </button>
          </>
        ) : (
          <button className="btn primary" type="button" onClick={startCamera} disabled={camera === 'starting'}>
            <Camera size={16} /> {copy.start}
          </button>
        )}
      </div>

      {camera === 'scanning' && !payload ? (
        <p className="small muted" style={{ textAlign: 'center' }}>
          <ScanLine size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {copy.looking}{' '}
          {copy.scanPrompt}
        </p>
      ) : null}

      <form
        className="scan-paste"
        onSubmit={(event) => {
          event.preventDefault();
          if (pasted.trim()) void handleScan(pasted.trim());
        }}
      >
        <label htmlFor="scan-paste">{copy.pasteTitle}</label>
        <div className="scan-paste-row">
          <input
            id="scan-paste"
            ref={pasteRef}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={copy.pastePlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn sm" type="submit">
            {copy.lookUp}
          </button>
        </div>
        <span className="hint">{copy.pasteHint}</span>
      </form>

      {looking ? (
        <p className="small muted" style={{ textAlign: 'center' }}>
          <Loader2 size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> {copy.found}
        </p>
      ) : null}

      {lookup && !lookup.ok ? (
        <div className="callout error" role="alert">
          <strong>
            <TriangleAlert size={15} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
            {lookup.error}
          </strong>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn sm" type="button" onClick={reset}>
              {copy.scanAnother}
            </button>
            <a className="btn sm ghost" href="#manual">
              <Keyboard size={14} /> {copy.typeInstead}
            </a>
          </div>
        </div>
      ) : null}

      {voucher ? (
        <div className="scan-voucher">
          <div className="scan-voucher-head">
            <div>
              <span className="small muted">{copy.found}</span>
              <h3>{voucher.title}</h3>
              <span className="small muted">
                {voucher.recipient ? `${voucher.recipient} · ` : ''}
                <span className="mono">{voucher.code}</span>
              </span>
            </div>
            <span className={`tag ${voucher.fulfilmentType === 'monetary' ? 'mint' : 'lavender'}`}>
              {voucher.fulfilmentType === 'monetary' ? 'Gift card' : 'Experience'}
            </span>
          </div>

          <div className="split-list" style={{ marginTop: 12 }}>
            <div>
              <span className="k">
                {voucher.fulfilmentType === 'monetary' ? copy.balance : copy.sessionsLeft}
              </span>
              <span className="v">
                {voucher.fulfilmentType === 'monetary'
                  ? formatMoney(voucher.remainingValueMinor ?? 0)
                  : `${voucher.remainingSessions ?? 0}${voucher.totalSessions ? ` / ${voucher.totalSessions}` : ''}`}
              </span>
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: 14 }}>
            {voucher.fulfilmentType === 'monetary' ? (
              <div className="field">
                <label htmlFor="scan-amount">{copy.amount}</label>
                <input
                  id="scan-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="25.00"
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="scan-sessions">{copy.sessionCount}</label>
                <input
                  id="scan-sessions"
                  inputMode="numeric"
                  value={sessions}
                  onChange={(event) => setSessions(event.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="scan-notes">{copy.notes}</label>
              <input
                id="scan-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Table 4"
              />
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" type="button" onClick={record} disabled={busy}>
              {busy ? (
                <Loader2 size={15} />
              ) : (
                <CheckCircle2 size={15} />
              )}{' '}
              {copy.record}
            </button>
            <button className="btn sm ghost" type="button" onClick={reset}>
              {copy.scanAnother}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
