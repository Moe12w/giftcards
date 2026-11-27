'use client';

import { useEffect, useState } from 'react';

import type { GiftCardCheckoutController } from '../controller';
import { useGiftCardCheckout } from './useGiftCardCheckout';

export interface GiftCardPaymentMethodLabels {
  title: string;
  codeLabel: string;
  codePlaceholder: string;
  validate: string;
  apply: string;
  removing: string;
  remove: string;
  validating: string;
  applying: string;
  balance: string;
  available: string;
  applied: string;
  remaining: string;
  completed: string;
  refresh: string;
  reset: string;
  retry: string;
  errorPrefix: string;
}

export const defaultLabels: GiftCardPaymentMethodLabels = {
  title: 'Pay with a gift card',
  codeLabel: 'Gift card code',
  codePlaceholder: 'GFT-XXXXXXXXXX',
  validate: 'Check card',
  apply: 'Apply to order',
  removing: 'Removing…',
  remove: 'Remove card',
  validating: 'Checking…',
  applying: 'Applying…',
  balance: 'Balance',
  available: 'Available',
  applied: 'Applied',
  remaining: 'Still to pay',
  completed: 'Payment completed',
  refresh: 'Refresh status',
  reset: 'Use another card',
  retry: 'Try again',
  errorPrefix: 'Payment issue:',
};

export interface GiftCardPaymentMethodProps {
  controller: GiftCardCheckoutController;
  labels?: Partial<GiftCardPaymentMethodLabels>;
  className?: string;
  disabled?: boolean;
  /** Optional status polling for hosts without their own order-event stream. */
  refreshIntervalMs?: number;
}

/**
 * Minimal, unstyled-by-default payment method UI.
 *
 * The host's design system wins: pass a className and CSS variables. The
 * component never receives an API key, an amount to authorise or a secret.
 */
export function GiftCardPaymentMethod({
  controller,
  labels,
  className,
  disabled = false,
  refreshIntervalMs = 0,
}: GiftCardPaymentMethodProps) {
  const t = { ...defaultLabels, ...labels };
  const checkout = useGiftCardCheckout(controller);
  const { state } = checkout;
  const [code, setCode] = useState('');
  const isValidating = state.status === 'validating';
  const isApplying = state.status === 'applying';
  const isRemoving = state.status === 'removing';

  const applied =
    state.status === 'applied' || state.status === 'removing' || state.status === 'completed'
      ? state.applied
      : null;

  useEffect(() => {
    if (!applied || refreshIntervalMs <= 0 || state.status !== 'applied') return;
    const timer = setInterval(() => {
      void controller.refresh();
    }, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [applied, refreshIntervalMs, state.status, controller]);

  const money = (minor: number, currency: string) =>
    `${(minor / 100).toFixed(2)} ${currency}`;

  return (
    <section className={className} dir="auto" aria-label={t.title}>
      <h3>{t.title}</h3>

      {!applied ? (
        <div>
          <label htmlFor="tazella-gift-card-code">{t.codeLabel}</label>
          <input
            id="tazella-gift-card-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t.codePlaceholder}
            autoComplete="off"
            disabled={disabled || isValidating || isApplying}
          />
          <div>
            <button
              type="button"
              disabled={disabled || isValidating || !code.trim()}
              onClick={() => void checkout.validate(code)}
            >
              {isValidating ? t.validating : t.validate}
            </button>
            {state.status === 'valid' && (
              <button
                type="button"
                disabled={disabled || isApplying}
                onClick={() => void checkout.apply()}
              >
                {isApplying ? t.applying : t.apply}
              </button>
            )}
          </div>

          {state.status === 'valid' && (
            <p>
              {t.balance}: {money(state.balanceMinor, state.currency ?? '')} · {t.available}:{' '}
              {money(state.availableMinor, state.currency ?? '')}
            </p>
          )}
          {state.status === 'invalid' && (
            <p role="status">
              {state.message} {state.reason}
            </p>
          )}
          {state.status === 'error' && (
            <p role="alert">
              {t.errorPrefix} {state.message}{' '}
              <button type="button" disabled={disabled} onClick={() => void checkout.reset()}>
                {state.retryable ? t.retry : t.reset}
              </button>
            </p>
          )}
        </div>
      ) : (
        <div>
          <p>
            {t.applied}: {money(applied.appliedAmountMinor, applied.currency)}
          </p>
          <p>
            {t.remaining}: {money(applied.remainingOrderAmountMinor, applied.currency)}
          </p>
          <p>
            {t.codeLabel}: {applied.card?.masked_code ?? '••••'}
          </p>
          <p>
            {t.title}: {applied.expiresAt.slice(0, 16).replace('T', ' ')}
          </p>
          {state.status === 'completed' && <p>{t.completed}</p>}
          <div>
            {state.status === 'applied' && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => void checkout.remove()}
              >
                {isRemoving ? t.removing : t.remove}
              </button>
            )}
            <button type="button" disabled={disabled} onClick={() => void checkout.refresh()}>
              {t.refresh}
            </button>
            <button type="button" disabled={disabled} onClick={() => checkout.reset()}>
              {t.reset}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
