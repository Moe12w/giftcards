// web/lib/agreement-signature.ts
// Stamps the captured signature onto the uploaded agreement PDF.
//
// The merchant signs on a canvas, and the PNG data URL is stored in
// merchant_agreement_signatures. The base agreement itself is an uploaded PDF.
// Page 6 of the current template has a "Third Party" signature block: the
// label sits at roughly x=420, y=567 and its "Signature" line at y=541 (PDF
// points, bottom-left origin), so the image is drawn just below it.
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SignatureBox {
  page: number;
  x: number;
  y: number;
  width: number;
}

export const DEFAULT_SIGNATURE_BOX: SignatureBox = {
  page: 6,
  x: 420,
  y: 498,
  width: 130,
};

/** Admin-adjustable placement, stored as a private system setting. */
export async function resolveSignatureBox(admin: AdminClient): Promise<SignatureBox> {
  const { data } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'merchant.agreement.signature')
    .maybeSingle();
  const saved = (data?.value ?? {}) as Partial<SignatureBox>;
  return {
    page: Number.isFinite(saved.page) ? Number(saved.page) : DEFAULT_SIGNATURE_BOX.page,
    x: Number.isFinite(saved.x) ? Number(saved.x) : DEFAULT_SIGNATURE_BOX.x,
    y: Number.isFinite(saved.y) ? Number(saved.y) : DEFAULT_SIGNATURE_BOX.y,
    width: Number.isFinite(saved.width) ? Number(saved.width) : DEFAULT_SIGNATURE_BOX.width,
  };
}

/** Returns a new PDF with the signature drawn under the Third Party block. */
export async function buildSignedAgreementPdf(options: {
  basePdf: Uint8Array;
  signatureData: string;
  signatoryName: string;
  signatoryRole?: string | null;
  signedAt: string;
  box?: SignatureBox;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(options.basePdf);
  const box = options.box ?? DEFAULT_SIGNATURE_BOX;
  const pageIndex = Math.min(
    Math.max(0, box.page - 1),
    Math.max(0, pdf.getPageCount() - 1),
  );
  const page = pdf.getPage(pageIndex);

  const base64 = options.signatureData.replace(/^data:image\/png;base64,/i, '');
  const pngBytes = Uint8Array.from(Buffer.from(base64, 'base64'));
  const png = await pdf.embedPng(pngBytes);
  const width = box.width > 0 ? box.width : DEFAULT_SIGNATURE_BOX.width;
  const height = (png.height / png.width) * width;
  const x = box.x;
  const y = box.y;

  page.drawImage(png, { x, y, width, height });

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const label = options.signatoryRole
    ? `${options.signatoryName} · ${options.signatoryRole}`
    : options.signatoryName;
  page.drawText(label, { x, y: Math.max(18, y - 14), size: 8, font });
  page.drawText(`Signed ${options.signedAt.slice(0, 10)}`, {
    x,
    y: Math.max(10, y - 25),
    size: 8,
    font,
  });

  return pdf.save();
}

export function safeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'file';
}
