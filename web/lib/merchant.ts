// web/lib/merchant.ts
// Shared, side-effect-free vocabulary for merchant (payment processing)
// onboarding. Imported by server pages, server actions and client components,
// so it must not import anything server-only.

export type MerchantOwnerType = 'vendor' | 'partner';

export type MerchantApplicationStatus =
  | 'not_started'
  | 'in_progress'
  | 'documents_required'
  | 'agreement_pending'
  | 'submitted'
  | 'under_review'
  | 'additional_information_required'
  | 'approved'
  | 'rejected'
  | 'active';

export type MerchantDocumentStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'replacement_required';

export interface MerchantApplication {
  id: string;
  owner_type: MerchantOwnerType;
  vendor_id: string | null;
  partner_id: string | null;
  status: MerchantApplicationStatus;
  step: number;
  contact_name: string | null;
  contact_role: string | null;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_type: 'home' | 'company' | null;
  cr_number: string | null;
  activity_name: string | null;
  activity_code: string | null;
  payment_methods: string[];
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_currency: string;
  agreement_id: string | null;
  agreement_signed_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantDocument {
  id: string;
  application_id: string;
  doc_type: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: MerchantDocumentStatus;
  rejection_reason: string | null;
  /** Provider submission is separate from our internal review. */
  myfatoorah_file_type: number | null;
  provider_submission_status: 'not_submitted' | 'submitted' | 'failed';
  provider_submitted_at: string | null;
  provider_document_status: string | null;
  provider_last_error: string | null;
  provider_attempts: number;
  uploaded_at?: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MerchantAgreement {
  id: string;
  version: string;
  title: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  content_sha256: string | null;
  is_active: boolean;
  created_at: string;
  deactivated_at: string | null;
}

export interface MerchantSignature {
  id: string;
  application_id: string;
  agreement_id: string;
  agreement_version: string;
  signatory_name: string;
  signatory_role: string;
  signed_at: string;
}

/** Ordered lifecycle used by the tracking timeline. */
export const MERCHANT_STATUS_ORDER: MerchantApplicationStatus[] = [
  'not_started',
  'in_progress',
  'documents_required',
  'agreement_pending',
  'submitted',
  'under_review',
  'additional_information_required',
  'approved',
  'active',
];

export function merchantStatusTone(status: MerchantApplicationStatus | string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'approved':
    case 'active':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'submitted':
    case 'under_review':
    case 'documents_required':
    case 'agreement_pending':
    case 'additional_information_required':
    case 'in_progress':
      return 'warning';
    default:
      return 'neutral';
  }
}

export interface DocTypeMeta {
  key: string;
  /** Company / corporate merchants only. */
  companyOnly: boolean;
  /** Image only (logos). */
  imageOnly: boolean;
  /** Front and back are separate keys, so both must be provided. */
  side?: 'front' | 'back';
}

/**
 * The MyFatoorah merchant file. Independent / home businesses are not asked for
 * corporate paperwork (CR, establishment card, manager's civil ID).
 */
export const MERCHANT_DOC_TYPES: DocTypeMeta[] = [
  { key: 'logo', companyOnly: false, imageOnly: true },
  { key: 'commercial_license', companyOnly: false, imageOnly: false },
  { key: 'commercial_register', companyOnly: true, imageOnly: false },
  { key: 'establishment_card', companyOnly: true, imageOnly: false },
  { key: 'owner_id_front', companyOnly: false, imageOnly: false, side: 'front' },
  { key: 'owner_id_back', companyOnly: false, imageOnly: false, side: 'back' },
  { key: 'manager_civil_id_front', companyOnly: true, imageOnly: false, side: 'front' },
  { key: 'manager_civil_id_back', companyOnly: true, imageOnly: false, side: 'back' },
  { key: 'bank_account_letter', companyOnly: false, imageOnly: false },
  { key: 'website_screenshot', companyOnly: false, imageOnly: false },
];

export const MERCHANT_DOC_KEYS = MERCHANT_DOC_TYPES.map((doc) => doc.key);

export function requiredDocKeys(businessType: 'home' | 'company' | null): string[] {
  if (businessType === 'company') return MERCHANT_DOC_KEYS;
  return MERCHANT_DOC_TYPES.filter((doc) => !doc.companyOnly).map((doc) => doc.key);
}

export function docMeta(key: string): DocTypeMeta | undefined {
  return MERCHANT_DOC_TYPES.find((doc) => doc.key === key);
}

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';
export const DOCUMENT_ACCEPT = 'application/pdf,image/png,image/jpeg,image/webp';
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

export interface PaymentMethodMeta {
  key: string;
  recommended?: boolean;
}

export const PAYMENT_METHODS: PaymentMethodMeta[] = [
  { key: 'visa_mastercard', recommended: true },
  { key: 'naps_debit', recommended: true },
  { key: 'apple_pay_naps' },
  { key: 'apple_pay_qar' },
  { key: 'amex' },
];

export const PAYMENT_METHOD_KEYS = PAYMENT_METHODS.map((method) => method.key);

/** Human labels for the payment methods, shared by the wizard and the overview. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  visa_mastercard: 'VISA / Mastercard',
  naps_debit: 'NAPS — Qatar debit card',
  apple_pay_naps: 'Apple Pay (NAPS)',
  apple_pay_qar: 'Apple Pay (QAR)',
  amex: 'AMEX',
};

/** Document names and the explanation shown beside each upload slot. */
export const MERCHANT_DOC_COPY: Record<string, { label: string; hint: string }> = {
  logo: {
    label: 'Business logo',
    hint: 'A square PNG or JPEG of your logo, at least 400 × 400 pixels.',
  },
  commercial_license: {
    label: 'Commercial license',
    hint: 'The valid commercial licence issued to the business. PDF or a clear photo.',
  },
  commercial_register: {
    label: 'Commercial register',
    hint: 'The commercial registration (CR) certificate for the company.',
  },
  establishment_card: {
    label: 'Establishment card',
    hint: 'The establishment card issued by the Ministry of Labour.',
  },
  owner_id_front: {
    label: 'Owner ID — front',
    hint: 'The front of every owner’s ID. Combine multiple owners into one PDF if needed.',
  },
  owner_id_back: {
    label: 'Owner ID — back',
    hint: 'The back of every owner’s ID. Both sides are required.',
  },
  manager_civil_id_front: {
    label: 'Manager civil ID — front',
    hint: 'The front of the authorised manager’s civil ID.',
  },
  manager_civil_id_back: {
    label: 'Manager civil ID — back',
    hint: 'The back of the authorised manager’s civil ID. Both sides are required.',
  },
  bank_account_letter: {
    label: 'Bank account letter',
    hint: 'A letter from the bank confirming the account holder name and IBAN.',
  },
  website_screenshot: {
    label: 'Website or social media screenshot',
    hint: 'A screenshot showing what you sell and how customers reach you.',
  },
};

export function isPaymentMethodKey(value: string): boolean {
  return PAYMENT_METHOD_KEYS.includes(value);
}

/** Qatari banks supported by the MyFatoorah bank list. */
export const QATAR_BANKS = [
  'Qatar National Bank (QNB)',
  'Qatar Islamic Bank (QIB)',
  'The Commercial Bank (CBQ)',
  'Doha Bank',
  'Ahli Bank',
  'Qatar International Islamic Bank (QIIB)',
  'Masraf Al Rayan',
  'Dukhan Bank',
  'Qatar Development Bank',
  'HSBC Bank Middle East — Qatar',
  'Standard Chartered — Qatar',
  'Arab Bank — Qatar',
  'Bank Saderat Iran — Qatar',
  'Other',
];

export const BUSINESS_TYPES = [
  { key: 'home', label: 'Home business / independent' },
  { key: 'company', label: 'Company / corporate' },
];

export const REPRESENTATIVE_ROLES = ['Owner', 'Manager', 'Authorised signatory', 'Finance lead'];

export const SELL_INTENTS = [
  { key: 'gift_cards' },
  { key: 'experiences' },
  { key: 'services' },
  { key: 'products' },
  { key: 'packages' },
];

/** `not_started` and `in_progress` are the only states a vendor may edit in. */
export function applicationIsEditable(status: MerchantApplicationStatus): boolean {
  return status === 'not_started' || status === 'in_progress' || status === 'documents_required' || status === 'agreement_pending' || status === 'additional_information_required';
}

/** States where the vendor is waiting on us. */
export function applicationIsLocked(status: MerchantApplicationStatus): boolean {
  return !applicationIsEditable(status) && status !== 'rejected';
}

export function signedAgreementLabel(signature: MerchantSignature | null | undefined): string {
  return signature ? `${signature.agreement_version} · ${signature.signatory_name}` : '';
}

/** Turns a Postgres exception raised by our RPCs into something a person can act on. */export function merchantErrorMessage(raw: string | undefined): string {
  const message = (raw ?? '').replace(/^.*?:\s*/, '').trim();
  switch (message) {
    case 'not_authorized':
      return 'Only the business owner or a manager can change payment details.';
    case 'application_locked':
      return 'This application has been submitted and can no longer be edited.';
    case 'business_information_incomplete':
      return 'Complete the business and representative details first.';
    case 'payment_methods_required':
      return 'Choose at least one payment method.';
    case 'documents_incomplete':
      return 'Upload every required document before submitting.';
    case 'banking_incomplete':
      return 'Add your bank details before submitting.';
    case 'agreement_not_signed':
      return 'Read and sign the payment processing agreement before submitting.';
    case 'no_active_agreement':
      return 'The agreement is not available yet. Please contact support.';
    case 'signatory_required':
      return 'Enter the signatory name and role.';
    case 'signature_required':
      return 'Draw your signature before submitting.';
    case 'consent_required':
      return 'Tick the consent box to sign.';
    case 'reason_required':
      return 'A reason is required.';
    case 'unexpected_doc_type':
      return 'That document is not part of your application.';
    case 'application_not_found':
      return 'Application not found.';
    case 'document_not_found':
      return 'Document not found.';
    case 'version_and_title_required':
      return 'Enter a version and a title for the agreement.';
    case 'file_required':
      return 'Choose the agreement file.';
    case 'invalid_status':
      return 'That status is not allowed.';
    case 'note_required':
      return 'Write a note first.';
    default:
      return message ? message.replace(/_/g, ' ') : 'Something went wrong. Please try again.';
  }
}

export interface MerchantProgressStep {
  key: string;
  label: string;
  done: boolean;
}

export interface MerchantProgress {
  steps: MerchantProgressStep[];
  done: number;
  percent: number;
  nextHref: string;
}

/**
 * Whether the application may be submitted. The "submitted" step itself can
 * never be complete before submitting, so readiness is judged on the five steps
 * that precede it, plus a signature on the agreement that is currently active.
 */
export function merchantReadyToSubmit(progress: MerchantProgress, signedCurrentVersion: boolean): boolean {
  return (
    signedCurrentVersion &&
    progress.steps.filter((step) => step.key !== 'submitted').every((step) => step.done)
  );
}

/**
 * Single source of truth for "how far along is this application", used by the
 * vendor overview, the enterprise overview, the dashboard checklist and admin.
 */
export function merchantProgress(
  application: MerchantApplication,
  documents: MerchantDocument[],
  signature: MerchantSignature | null,
  basePath: string,
): MerchantProgress {
  const required = requiredDocKeys(application.business_type);
  const uploaded = documents.filter((doc) => required.includes(doc.doc_type) && doc.status !== 'rejected');

  const businessDone =
    Boolean(application.contact_name) &&
    Boolean(application.business_name) &&
    Boolean(application.business_email) &&
    Boolean(application.business_phone) &&
    Boolean(application.business_type) &&
    (application.business_type !== 'company' || Boolean(application.cr_number));

  const methodsDone = application.payment_methods.length > 0;
  const documentsDone = uploaded.length >= required.length;
  const bankingDone =
    Boolean(application.bank_name) &&
    Boolean(application.bank_account_name) &&
    Boolean(application.bank_account_number || application.bank_iban);
  const agreementDone = Boolean(signature) || Boolean(application.agreement_signed_at);
  const submittedDone = ['submitted', 'under_review', 'additional_information_required', 'approved', 'active'].includes(
    application.status,
  );

  const steps: MerchantProgressStep[] = [
    { key: 'business', label: 'Business & representative', done: businessDone },
    { key: 'methods', label: 'Payment methods', done: methodsDone },
    { key: 'documents', label: `Documents (${uploaded.length}/${required.length})`, done: documentsDone },
    { key: 'banking', label: 'Banking details', done: bankingDone },
    { key: 'agreement', label: 'Agreement signed', done: agreementDone },
    { key: 'submitted', label: 'Submitted for review', done: submittedDone },
  ];

  const done = steps.filter((step) => step.done).length;
  const firstOpen = steps.find((step) => !step.done);

  const hrefs: Record<string, string> = {
    business: `${basePath}/application?step=1`,
    methods: `${basePath}/application?step=2`,
    documents: `${basePath}/application?step=3`,
    banking: `${basePath}/application?step=4`,
    agreement: `${basePath}/agreement`,
    submitted: `${basePath}/review`,
  };

  return {
    steps,
    done,
    percent: Math.round((done / steps.length) * 100),
    nextHref: firstOpen ? hrefs[firstOpen.key] : `${basePath}/review`,
  };
}

