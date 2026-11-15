// src/lib/tutorial.ts
// The customer tour: what gift cards and gift baskets are, and how to use the
// app from discovery through redemption. Content is bilingual and lives here so
// the screen stays a thin renderer.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AccentTone } from './types';

export const TUTORIAL_KEY = 'giftly.tutorial.seen';

export type TutorialLanguage = 'en' | 'ar';

export interface CustomerTutorialStep {
  id: string;
  /** Semantic glyph key from `src/lib/glyphs.ts`. */
  icon: string;
  tone: AccentTone;
  title: Record<TutorialLanguage, string>;
  body: Record<TutorialLanguage, string>;
  tip?: Record<TutorialLanguage, string>;
}

export const CUSTOMER_TUTORIAL: CustomerTutorialStep[] = [
  {
    id: 'welcome',
    icon: 'gift',
    tone: 'pink',
    title: {
      en: 'Welcome to Giftly',
      ar: 'مرحباً بك في جيفتلي',
    },
    body: {
      en: 'Giftly is a marketplace for gift cards from local businesses. Buy a card, make it personal, and send it to someone — or keep it for yourself.',
      ar: 'جيفتلي سوق لبطاقات الهدايا من المتاجر المحلية. اشترِ بطاقة، وخصّصها، وأرسلها إلى من تحب — أو احتفظ بها لنفسك.',
    },
    tip: {
      en: 'This tour takes about a minute. You can replay it any time from Profile.',
      ar: 'تستغرق هذه الجولة دقيقة تقريباً. يمكنك إعادتها في أي وقت من حسابك.',
    },
  },
  {
    id: 'gift-cards',
    icon: 'creditCard',
    tone: 'teal',
    title: {
      en: 'Pick a card, any card',
      ar: 'اختر البطاقة التي تناسبك',
    },
    body: {
      en: 'Choose a business and a value — coffee, dinner, a spa day, an adventure, or a partner’s own codes. Every card keeps its full value until it expires.',
      ar: 'اختر متجراً وقيمة — قهوة، عشاء، يوم سبا، مغامرة، أو أكواد شريك. تحتفظ كل بطاقة بقيمتها الكاملة حتى تاريخ انتهائها.',
    },
    tip: {
      en: 'The amount you choose is the amount they can spend.',
      ar: 'المبلغ الذي تختاره هو المبلغ الذي يمكنهم إنفاقه.',
    },
  },
  {
    id: 'personalise',
    icon: 'palette',
    tone: 'lavender',
    title: {
      en: 'Make it feel personal',
      ar: 'اجعلها هدية شخصية',
    },
    body: {
      en: 'Add a message, pick a cover, and choose the delivery date. Send it now or schedule it for a birthday or a special morning.',
      ar: 'أضف رسالة، واختر التصميم، وحدّد تاريخ الإرسال. أرسلها الآن أو جدولها لعيد ميلاد أو صباح مميز.',
    },
    tip: {
      en: 'Scheduled gifts arrive on the date you choose, not before.',
      ar: 'تصل الهدايا المجدولة في التاريخ الذي تختاره، وليس قبل ذلك.',
    },
  },
  {
    id: 'send',
    icon: 'send',
    tone: 'gold',
    title: {
      en: 'Send it their way',
      ar: 'أرسلها بالطريقة التي تناسبهم',
    },
    body: {
      en: 'Send by email, WhatsApp or SMS, or copy the claim link. The recipient does not need the Giftly app to open it.',
      ar: 'أرسلها بالبريد الإلكتروني أو واتساب أو رسالة نصية، أو انسخ رابط الاستلام. لا يحتاج المستلم إلى تطبيق جيفتلي لفتحه.',
    },
    tip: {
      en: 'You can resend the link later from the gift’s page.',
      ar: 'يمكنك إعادة إرسال الرابط لاحقاً من صفحة الهدية.',
    },
  },
  {
    id: 'claim',
    icon: 'checkCircle',
    tone: 'sky',
    title: {
      en: 'One tap to claim',
      ar: 'استلام بلمسة واحدة',
    },
    body: {
      en: 'The recipient opens the link, signs in or creates a free account, and the card lands in their wallet with its balance and expiry date.',
      ar: 'يفتح المستلم الرابط، ويسجل الدخول أو ينشئ حساباً مجانياً، وتصل البطاقة إلى محفظته مع رصيدها وتاريخ انتهائها.',
    },
    tip: {
      en: 'If they already have an account, the card is added automatically.',
      ar: 'إذا كان لديهم حساب بالفعل، تُضاف البطاقة تلقائياً.',
    },
  },
  {
    id: 'redeem',
    icon: 'qr',
    tone: 'teal',
    title: {
      en: 'Use it at the counter',
      ar: 'استخدمها عند الكاشير',
    },
    body: {
      en: 'Show the QR code or read out the card code at the business. Staff scan it, the balance updates, and the receipt appears in your orders.',
      ar: 'اعرض رمز QR أو اقرأ رمز البطاقة في المتجر. يمسحه الموظف، ويتحدّث الرصيد، وتظهر الفاتورة في طلباتك.',
    },
    tip: {
      en: 'You can spend part of the balance and keep the rest for later.',
      ar: 'يمكنك إنفاق جزء من الرصيد والاحتفاظ بالباقي لوقت لاحق.',
    },
  },
  {
    id: 'baskets',
    icon: 'users',
    tone: 'pink',
    title: {
      en: 'Gift baskets, better together',
      ar: 'سلال الهدايا، أجمل معاً',
    },
    body: {
      en: 'A basket is one gift box for several cards. Create a basket, share the invite code, and friends can add a card or chip in toward the total. Everyone sees who contributed what.',
      ar: 'السلة هي صندوق هدايا واحد لعدة بطاقات. أنشئ سلة، وشارك رمز الدعوة، ويمكن للأصدقاء إضافة بطاقة أو المساهمة في المبلغ الإجمالي. يرى الجميع من ساهم وبكم.',
    },
    tip: {
      en: 'The basket stays open until you mark it ready to send.',
      ar: 'تبقى السلة مفتوحة حتى تحدّدها جاهزة للإرسال.',
    },
  },
  {
    id: 'track',
    icon: 'wallet',
    tone: 'lavender',
    title: {
      en: 'Everything in one place',
      ar: 'كل شيء في مكان واحد',
    },
    body: {
      en: 'My cards shows what you can spend, Orders keeps every purchase and receipt, and notifications tell you when a gift is claimed or redeemed.',
      ar: 'تعرض «بطاقاتي» ما يمكنك إنفاقه، وتحفظ «الطلبات» كل عملية شراء وفاتورة، وتخبرك الإشعارات عند استلام الهدية أو استخدامها.',
    },
    tip: {
      en: 'Stuck? Help & support is in Profile, and this tour can be replayed there.',
      ar: 'تحتاج مساعدة؟ الدعم موجود في حسابك، ويمكنك إعادة هذه الجولة من هناك.',
    },
  },
];

export async function hasSeenTutorial(): Promise<boolean> {
  try {
    return Boolean(await AsyncStorage.getItem(TUTORIAL_KEY));
  } catch {
    return true;
  }
}

export async function markTutorialSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    // Non-fatal: the tour may open again next launch.
  }
}
