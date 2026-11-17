import { describe, expect, it } from 'vitest';

import {
  MERCHANT_DOC_KEYS,
  applicationIsEditable,
  applicationIsLocked,
  isPaymentMethodKey,
  merchantErrorMessage,
  merchantProgress,
  merchantReadyToSubmit,
  requiredDocKeys,
  type MerchantApplication,
  type MerchantDocument,
  type MerchantSignature,
} from './merchant';

function application(overrides: Partial<MerchantApplication> = {}): MerchantApplication {
  return {
    id: 'app-1',
    owner_type: 'vendor',
    vendor_id: 'vendor-1',
    partner_id: null,
    status: 'not_started',
    step: 1,
    contact_name: null,
    contact_role: null,
    business_name: null,
    business_email: null,
    business_phone: null,
    business_type: null,
    cr_number: null,
    activity_name: null,
    activity_code: null,
    payment_methods: [],
    bank_name: null,
    bank_account_name: null,
    bank_account_number: null,
    bank_iban: null,
    bank_currency: 'QAR',
    agreement_id: null,
    agreement_signed_at: null,
    submitted_at: null,
    reviewed_at: null,
    decision_note: null,
    activated_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function document(docType: string, overrides: Partial<MerchantDocument> = {}): MerchantDocument {
  return {
    id: `doc-${docType}`,
    application_id: 'app-1',
    doc_type: docType,
    storage_path: `vendor/vendor-1/app-1/${docType}.pdf`,
    file_name: `${docType}.pdf`,
    mime_type: 'application/pdf',
    size_bytes: 1024,
    status: 'pending_review',
    rejection_reason: null,
    reviewed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const completeApplication = () =>
  application({
    contact_name: 'Noura',
    contact_role: 'Owner',
    business_name: 'Noura Studio',
    business_email: 'noura@example.qa',
    business_phone: '+97455555555',
    business_type: 'home',
    payment_methods: ['visa_mastercard'],
    bank_name: 'Qatar National Bank (QNB)',
    bank_account_name: 'Noura Studio',
    bank_iban: 'QA00TEST000000000000000000',
  });

describe('requiredDocKeys', () => {
  it('asks home businesses for the six independent documents', () => {
    expect(requiredDocKeys('home')).toEqual([
      'logo',
      'commercial_license',
      'owner_id_front',
      'owner_id_back',
      'bank_account_letter',
      'website_screenshot',
    ]);
  });

  it('asks companies for the full corporate set', () => {
    expect(requiredDocKeys('company')).toEqual(MERCHANT_DOC_KEYS);
    expect(requiredDocKeys('company')).toContain('commercial_register');
    expect(requiredDocKeys('company')).toContain('establishment_card');
    expect(requiredDocKeys('company')).toContain('manager_civil_id_front');
  });

  it('falls back to the independent set before a business type is chosen', () => {
    expect(requiredDocKeys(null)).toEqual(requiredDocKeys('home'));
  });
});

describe('merchantProgress', () => {
  it('starts at zero for a brand new application', () => {
    const progress = merchantProgress(application(), [], null, '/vendor/payments');
    expect(progress.done).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.nextHref).toBe('/vendor/payments/application?step=1');
  });

  it('counts documents, banking and signature', () => {
    const app = completeApplication();
    const docs = requiredDocKeys('home').map((key) => document(key));
    const signature: MerchantSignature = {
      id: 'sig-1',
      application_id: 'app-1',
      agreement_id: 'agreement-1',
      agreement_version: '2026-01',
      signatory_name: 'Noura',
      signatory_role: 'Owner',
      signed_at: '2026-01-02T00:00:00.000Z',
    };

    const progress = merchantProgress(app, docs, signature, '/vendor/payments');
    // business, methods, documents, banking, agreement — all done except submit.
    expect(progress.done).toBe(5);
    expect(progress.percent).toBe(83);
    expect(progress.nextHref).toBe('/vendor/payments/review');
  });

  it('treats rejected documents as missing', () => {
    const app = completeApplication();
    const docs = requiredDocKeys('home').map((key) =>
      document(key, key === 'logo' ? { status: 'rejected' } : {}),
    );
    const progress = merchantProgress(app, docs, null, '/vendor/payments');
    const documentsStep = progress.steps.find((step) => step.key === 'documents');
    expect(documentsStep?.done).toBe(false);
    expect(documentsStep?.label).toBe('Documents (5/6)');
  });

  it('marks submitted applications as submitted', () => {
    const app = completeApplication();
    app.status = 'under_review';
    app.submitted_at = '2026-01-03T00:00:00.000Z';
    const progress = merchantProgress(app, [], null, '/enterprise/payments');
    const submitted = progress.steps.find((step) => step.key === 'submitted');
    expect(submitted?.done).toBe(true);
  });
});

describe('merchantReadyToSubmit', () => {
  const completeProgress = () => {
    const app = completeApplication();
    const docs = requiredDocKeys('home').map((key) => document(key));
    const signature: MerchantSignature = {
      id: 'sig-1',
      application_id: 'app-1',
      agreement_id: 'agreement-1',
      agreement_version: '2026-01',
      signatory_name: 'Noura',
      signatory_role: 'Owner',
      signed_at: '2026-01-02T00:00:00.000Z',
    };
    return { app, docs, signature, progress: merchantProgress(app, docs, signature, '/vendor/payments') };
  };

  it('is ready when the five pre-submission steps are done and the current version is signed', () => {
    const { progress } = completeProgress();
    expect(progress.percent).toBe(83);
    expect(merchantReadyToSubmit(progress, true)).toBe(true);
  });

  it('is not ready without a signature on the active version', () => {
    const { progress } = completeProgress();
    expect(merchantReadyToSubmit(progress, false)).toBe(false);
  });

  it('is not ready while a document is still missing', () => {
    const { app, signature } = completeProgress();
    const docs = requiredDocKeys('home')
      .filter((key) => key !== 'bank_account_letter')
      .map((key) => document(key));
    const progress = merchantProgress(app, docs, signature, '/vendor/payments');
    expect(merchantReadyToSubmit(progress, true)).toBe(false);
  });

  it('is not ready without banking details', () => {
    const { app, docs, signature } = completeProgress();
    app.bank_iban = null;
    app.bank_account_number = null;
    const progress = merchantProgress(app, docs, signature, '/vendor/payments');
    expect(merchantReadyToSubmit(progress, true)).toBe(false);
  });
});

describe('applicationIsEditable', () => {
  it('allows editing before and after a document revision request', () => {
    expect(applicationIsEditable('not_started')).toBe(true);
    expect(applicationIsEditable('in_progress')).toBe(true);
    expect(applicationIsEditable('documents_required')).toBe(true);
    expect(applicationIsEditable('additional_information_required')).toBe(true);
  });

  it('locks the application once it is in review', () => {
    expect(applicationIsEditable('submitted')).toBe(false);
    expect(applicationIsEditable('under_review')).toBe(false);
    expect(applicationIsEditable('approved')).toBe(false);
    expect(applicationIsEditable('active')).toBe(false);
    expect(applicationIsLocked('under_review')).toBe(true);
  });
});

describe('isPaymentMethodKey', () => {
  it('accepts the supported methods only', () => {
    expect(isPaymentMethodKey('visa_mastercard')).toBe(true);
    expect(isPaymentMethodKey('apple_pay_qar')).toBe(true);
    expect(isPaymentMethodKey('bitcoin')).toBe(false);
  });
});

describe('merchantErrorMessage', () => {
  it('turns RPC errors into actionable copy', () => {
    expect(merchantErrorMessage('P0001: documents_incomplete')).toContain('Upload every required document');
    expect(merchantErrorMessage('agreement_not_signed')).toContain('sign the payment processing agreement');
    expect(merchantErrorMessage('application_locked')).toContain('can no longer be edited');
  });

  it('has a safe fallback', () => {
    expect(merchantErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});
