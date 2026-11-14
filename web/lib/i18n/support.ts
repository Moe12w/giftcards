// web/lib/i18n/support.ts
// The words on the support ticket page inside every dashboard.
import type { Copy } from './index';

const en = {
  eyebrow: 'Help & support',
  title: 'Support tickets',
  description: 'Send a request to the Giftly team and follow its status here.',
  newTicket: 'New request',
  subject: 'Subject',
  subjectPlaceholder: 'What do you need help with?',
  message: 'Message',
  messagePlaceholder: 'Tell us what happened, with any order or card reference.',
  reference: 'Order or card reference (optional)',
  send: 'Send to support',
  sent: 'Your request was sent to the Giftly team.',
  history: 'Your requests',
  historyHint: 'Everything you send here also appears in the admin inbox.',
  empty: 'No requests yet',
  emptyBody: 'Anything you send from this page appears here and in the admin dashboard.',
  sentOn: 'Sent',
  missing: 'Add a subject and a message before sending.',
  replyNote: 'We reply by email within one business day.',
  reply: 'Reply',
  replyPlaceholder: 'Add more detail or answer the team.',
  sendReply: 'Send reply',
  noReplies: 'No replies yet. The team will answer here.',
  supportTeam: 'Giftly support',
};

const ar: typeof en = {
  eyebrow: 'المساعدة والدعم',
  title: 'تذاكر الدعم',
  description: 'أرسل طلباً إلى فريق غيفتلي وتابع حالته من هنا.',
  newTicket: 'طلب جديد',
  subject: 'الموضوع',
  subjectPlaceholder: 'بماذا تحتاج المساعدة؟',
  message: 'الرسالة',
  messagePlaceholder: 'أخبرنا بما حدث، مع رقم الطلب أو البطاقة إن وُجد.',
  reference: 'رقم الطلب أو البطاقة (اختياري)',
  send: 'إرسال إلى الدعم',
  sent: 'تم إرسال طلبك إلى فريق غيفتلي.',
  history: 'طلباتك',
  historyHint: 'كل ما ترسله هنا يظهر أيضاً في صندوق المسؤول.',
  empty: 'لا توجد طلبات بعد',
  emptyBody: 'أي طلب ترسله من هذه الصفحة يظهر هنا وفي لوحة المسؤول.',
  sentOn: 'أُرسل',
  missing: 'أضف موضوعاً ورسالة قبل الإرسال.',
  replyNote: 'نرد بالبريد الإلكتروني خلال يوم عمل واحد.',
  reply: 'الرد',
  replyPlaceholder: 'أضف تفاصيل أكثر أو أجب الفريق.',
  sendReply: 'إرسال الرد',
  noReplies: 'لا توجد ردود بعد. سيجيب الفريق هنا.',
  supportTeam: 'دعم غيفتلي',
};

export const supportCopy: Copy<typeof en> = { en, ar };
export type SupportCopyShape = typeof en;
