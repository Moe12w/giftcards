'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { TutorialArt } from '@/components/TutorialArt';
import { completeTutorial } from '@/lib/actions/tutorial';
import type { TutorialScript, TutorialStep } from '@/lib/tutorial';

interface TutorialContextValue {
  open: (stepId?: string) => void;
  close: () => void;
  isOpen: boolean;
  locale: 'en' | 'ar';
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

/** Lets any page open the walkthrough at the right step. */
export function useTutorial() {
  const context = useContext(TutorialContext);
  if (!context) {
    return {
      open: () => undefined,
      close: () => undefined,
      isOpen: false,
      locale: 'en' as const,
    };
  }
  return context;
}

const COPY = {
  en: {
    skip: 'Skip the guide',
    next: 'Next',
    back: 'Back',
    finish: 'Finish',
    step: 'Step',
    of: 'of',
    tip: 'Good to know',
    takeMeThere: 'Take me there',
    close: 'Close the guide',
    label: 'Tutorial',
  },
  ar: {
    skip: 'تخطَّ الدليل',
    next: 'التالي',
    back: 'السابق',
    finish: 'إنهاء',
    step: 'الخطوة',
    of: 'من',
    tip: 'معلومة مهمة',
    takeMeThere: 'اذهب إلى الصفحة',
    close: 'أغلق الدليل',
    label: 'الدليل',
  },
};

export function TutorialProvider({
  script,
  locale,
  autoOpen,
  children,
}: {
  script: TutorialScript;
  locale: 'en' | 'ar';
  autoOpen: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const startedRef = useRef(false);

  const copy = COPY[locale];
  const rtl = locale === 'ar';
  const steps = script.steps ?? [];
  const step: TutorialStep | undefined = steps[index];
  const isLast = index === steps.length - 1;

  const close = useCallback(() => {
    setIsOpen(false);
    if (restoreFocusRef.current) restoreFocusRef.current.focus();
  }, []);

  const open = useCallback(
    (stepId?: string) => {
      if (stepId) {
        const found = steps.findIndex((item) => item.id === stepId);
        if (found >= 0) setIndex(found);
      }
      setIsOpen(true);
    },
    [steps],
  );

  // Brand new accounts get the walkthrough on their first visit.
  useEffect(() => {
    if (!autoOpen || startedRef.current) return;
    startedRef.current = true;
    const timer = window.setTimeout(() => setIsOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [autoOpen]);

  const finish = useCallback(() => {
    setIsOpen(false);
    void completeTutorial();
    if (restoreFocusRef.current) restoreFocusRef.current.focus();
  }, []);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => current + 1);
  }, [finish, isLast]);

  const goBack = useCallback(() => {
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  // Keyboard support: escape skips, arrows move between steps.
  useEffect(() => {
    if (!isOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key === 'ArrowRight' && !rtl) {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowLeft' && !rtl) {
        event.preventDefault();
        goBack();
      }
      if (event.key === 'ArrowLeft' && rtl) {
        event.preventDefault();
        goNext();
      }
      if (event.key === 'ArrowRight' && rtl) {
        event.preventDefault();
        goBack();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, goBack, goNext, isOpen, rtl]);

  // Move focus into the panel and keep it there while the guide is open.
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    return () => {
      if (restoreFocusRef.current && document.body.contains(restoreFocusRef.current)) {
        restoreFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  const contextValue = useMemo<TutorialContextValue>(
    () => ({ open, close, isOpen, locale }),
    [close, isOpen, locale, open],
  );

  const stepTitle = step ? (rtl ? step.titleAr : step.title) : '';
  const stepBody = step ? (rtl ? step.bodyAr : step.body) : '';
  const stepTip = step ? (rtl ? step.tipAr : step.tip) : undefined;

  return (
    <TutorialContext.Provider value={contextValue}>
      {children}

      {isOpen && step ? (
        <div className="tut-overlay" role="dialog" aria-modal="true" aria-label={script.title}>
          <button
            type="button"
            className="tut-backdrop"
            aria-label={copy.close}
            onClick={finish}
          />
          <div
            className="tut-panel"
            dir={rtl ? 'rtl' : 'ltr'}
            ref={panelRef}
            tabIndex={-1}
            role="document"
          >
            <header className="tut-head">
              <div className="tut-head-copy">
                <span className="eyebrow mint">{rtl ? script.titleAr : script.title}</span>
                <p className="small muted">
                  {copy.step} {index + 1} {copy.of} {steps.length}
                </p>
              </div>
              <button type="button" className="tut-close" onClick={finish} aria-label={copy.close}>
                <X size={18} />
              </button>
            </header>

            <div className="tut-progress" aria-hidden="true">
              <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
            </div>

            <div className="tut-body">
              <div className="tut-art-wrap">
                <TutorialArt art={step.art} key={`${step.id}-${index}`} />
              </div>
              <div className="tut-copy">
                <h3 key={step.id} className="tut-title">
                  {stepTitle}
                </h3>
                <p key={`${step.id}-body`} className="tut-text">
                  {stepBody}
                </p>
                {stepTip ? (
                  <div className="callout info tut-tip">
                    <strong>{copy.tip}</strong>
                    <span>{stepTip}</span>
                  </div>
                ) : null}
                {step.href ? (
                  <Link className="btn sm ghost tut-link" href={step.href} onClick={finish}>
                    {copy.takeMeThere}
                    <ArrowRight size={14} style={rtl ? { transform: 'scaleX(-1)' } : undefined} />
                  </Link>
                ) : null}
              </div>
            </div>

            <footer className="tut-foot">
              <div className="tut-dots" aria-hidden="true">
                {steps.map((item, dotIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`tut-dot${dotIndex === index ? ' active' : ''}${dotIndex < index ? ' done' : ''}`}
                    onClick={() => setIndex(dotIndex)}
                    aria-label={`${copy.step} ${dotIndex + 1}`}
                  >
                    {dotIndex < index ? <Check size={9} /> : null}
                  </button>
                ))}
              </div>
              <div className="tut-actions">
                <button type="button" className="btn sm ghost" onClick={finish}>
                  {copy.skip}
                </button>
                {index > 0 ? (
                  <button type="button" className="btn sm" onClick={goBack}>
                    <ArrowLeft size={14} style={rtl ? { transform: 'scaleX(-1)' } : undefined} />
                    {copy.back}
                  </button>
                ) : null}
                <button type="button" className="btn sm primary" onClick={goNext}>
                  {isLast ? copy.finish : copy.next}
                  {isLast ? <Check size={15} /> : <ArrowRight size={14} style={rtl ? { transform: 'scaleX(-1)' } : undefined} />}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </TutorialContext.Provider>
  );
}
